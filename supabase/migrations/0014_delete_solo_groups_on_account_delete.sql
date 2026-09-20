-- YARURU: アカウント削除時、自分ひとりだけが所属している家族グループも同時に削除する
-- （そのまま残すと、誰も操作できないグループとチケットが永久に残ってしまうため）

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

  -- 自分ひとりだけが所属している家族グループは、アカウント削除と同時に削除する
  -- （items/family_membersはfamily_groupsのon delete cascadeで連鎖削除される）
  delete from public.family_groups
  where id in (
    select fm.group_id
    from public.family_members fm
    where fm.profile_id = p_user_id
      and not exists (
        select 1 from public.family_members other
        where other.group_id = fm.group_id and other.profile_id <> p_user_id
      )
  );

  delete from auth.users where id = p_user_id;
end;
$$;
