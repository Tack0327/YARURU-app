-- YARURU: 家族グループの管理者(owner)を、同じグループの他のメンバーへ委譲する機能
-- 管理者が脱退・退会する前に、まず別のメンバーへ管理者を引き継げるようにする。

-- 管理者を委譲する（現在の管理者本人、またはスーパー管理者のみ実行可能）
create or replace function public.transfer_group_ownership(p_group_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_owner uuid;
begin
  select profile_id into v_current_owner
  from public.family_members
  where group_id = p_group_id and role = 'owner';

  if v_current_owner is null then
    raise exception 'このグループには管理者がいません';
  end if;

  if v_current_owner <> auth.uid() and not public.is_super_admin() then
    raise exception '権限がありません';
  end if;

  if not exists (
    select 1 from public.family_members
    where group_id = p_group_id and profile_id = p_new_owner_id
  ) then
    raise exception '指定されたメンバーはこのグループに所属していません';
  end if;

  if p_new_owner_id = v_current_owner then
    return;
  end if;

  update public.family_members set role = 'member' where group_id = p_group_id and profile_id = v_current_owner;
  update public.family_members set role = 'owner' where group_id = p_group_id and profile_id = p_new_owner_id;
end;
$$;

grant execute on function public.transfer_group_ownership(uuid, uuid) to authenticated;

-- 脱退時のメッセージを、管理者委譲という具体的な対処方法が分かるように更新する
create or replace function public.leave_family_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.family_members
  where group_id = p_group_id and profile_id = auth.uid();

  if v_role is null then
    raise exception 'このグループに所属していません';
  end if;

  if v_role = 'owner' then
    raise exception '管理者はこのままでは脱退できません。先に別のメンバーへ管理者を委譲してください';
  end if;

  delete from public.family_members
  where group_id = p_group_id and profile_id = auth.uid();
end;
$$;

-- アカウント削除時、他にメンバーがいるグループの管理者になっている場合は、先に管理者の委譲を必須にする
-- （そのまま削除すると、グループが管理者不在のまま残ってしまうため）
create or replace function public.delete_user_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_blocking_group text;
begin
  if auth.uid() <> p_user_id and not public.is_super_admin() then
    raise exception '権限がありません';
  end if;

  select fg.name into v_blocking_group
  from public.family_members fm
  join public.family_groups fg on fg.id = fm.group_id
  where fm.profile_id = p_user_id
    and fm.role = 'owner'
    and exists (
      select 1 from public.family_members other
      where other.group_id = fm.group_id and other.profile_id <> p_user_id
    )
  limit 1;

  if v_blocking_group is not null then
    raise exception '「%」の管理者になっています。削除する前に、そのグループで別のメンバーへ管理者を委譲してください', v_blocking_group;
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;
