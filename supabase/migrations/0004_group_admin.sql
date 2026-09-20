-- YARURU: 家族グループ管理者向け機能（招待コード再発行・メンバー削除）
-- 1人が複数の家族グループに所属できる前提は元々のスキーマ（family_membersにprofile_id単体のunique制約がない）で成立している。

-- 招待コードを再発行する（そのグループのownerのみ実行可能）
create or replace function public.regenerate_invite_code(p_group_id uuid)
returns public.family_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.family_groups;
begin
  if not exists (
    select 1 from public.family_members
    where group_id = p_group_id and profile_id = auth.uid() and role = 'owner'
  ) then
    raise exception '権限がありません';
  end if;

  update public.family_groups
  set invite_code = public.generate_invite_code()
  where id = p_group_id
  returning * into v_group;

  return v_group;
end;
$$;

-- グループからメンバーを削除する（そのグループのownerのみ実行可能。自分自身は削除できない）
create or replace function public.remove_family_member(p_group_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.family_members
    where group_id = p_group_id and profile_id = auth.uid() and role = 'owner'
  ) then
    raise exception '権限がありません';
  end if;

  if p_profile_id = auth.uid() then
    raise exception '自分自身を削除することはできません';
  end if;

  delete from public.family_members
  where group_id = p_group_id and profile_id = p_profile_id;
end;
$$;

grant execute on function public.regenerate_invite_code(uuid) to authenticated;
grant execute on function public.remove_family_member(uuid, uuid) to authenticated;
