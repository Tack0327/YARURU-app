-- YARURU: スーパー管理者が、自分の所属していない家族グループを直接削除することを制限する
-- そのグループにまだ管理者(owner)が残っている場合は削除できないようにし、
-- 先にその管理者のアカウントを削除させる（アカウント削除側で、単独所属グループの連鎖削除・
-- 他メンバーがいる場合の管理者委譲必須化が既に実装されているため、削除の入口をそちらに一本化する）。
-- グループの管理者本人が自分のグループを削除する操作（設定画面）は、従来どおり許可する。

create or replace function public.delete_family_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owner boolean;
begin
  select exists (
    select 1 from public.family_members
    where group_id = p_group_id and profile_id = auth.uid() and role = 'owner'
  ) into v_is_owner;

  if not v_is_owner and not public.is_super_admin() then
    raise exception '権限がありません';
  end if;

  if not v_is_owner and exists (
    select 1 from public.family_members where group_id = p_group_id and role = 'owner'
  ) then
    raise exception 'このグループには管理者がいるため削除できません。先にその管理者のアカウントを削除してください';
  end if;

  delete from public.family_groups where id = p_group_id;
end;
$$;
