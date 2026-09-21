-- YARURU: スーパー管理者による家族グループ削除の制限（0015）を撤廃する
-- 削除前にメンバー数・チケット数を警告表示し、それでも削除するかをアプリ側で確認する運用に変更したため、
-- DB側で「管理者が残っている間は削除不可」と強制する必要がなくなった。
-- （0007_delete_family_groupと同じ内容に戻す）

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
