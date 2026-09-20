-- YARURU: 家族グループの削除機能
-- items.group_id / family_members.group_id は既に on delete cascade のため、
-- family_groups を削除すれば関連するチケット・メンバーも自動的に削除される。
-- family_groupsには元々delete用のRLSポリシーが存在しないため、SECURITY DEFINER関数経由でのみ削除を許可する。

create or replace function public.delete_family_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.family_members
    where group_id = p_group_id and profile_id = auth.uid() and role = 'owner'
  ) and not public.is_super_admin() then
    raise exception '権限がありません';
  end if;

  delete from public.family_groups where id = p_group_id;
end;
$$;

grant execute on function public.delete_family_group(uuid) to authenticated;
