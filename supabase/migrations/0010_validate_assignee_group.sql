-- YARURU: itemsの担当者(assignee_id)が、そのチケットの家族グループのメンバーであることをDB側でも検証する
-- UI側（ItemForm・BulkActionBar）では既にグループメンバーのみを候補にしているが、
-- 複数グループ横断のまとめて変更などで他グループのメンバーを設定できてしまう抜け道を塞ぐための保険。
-- assignee_idが変更されない更新（例: ステータスだけの変更）では検証しない
-- （メンバー削除後に残った過去の担当者設定を持つチケットの、無関係な更新まで失敗させないため）。

create or replace function public.items_validate_assignee()
returns trigger
language plpgsql
as $$
begin
  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and not exists (
       select 1 from public.family_members
       where group_id = new.group_id and profile_id = new.assignee_id
     ) then
    raise exception '担当者はそのグループのメンバーである必要があります';
  end if;
  return new;
end;
$$;

create trigger items_validate_assignee_trigger
  before insert or update on public.items
  for each row execute function public.items_validate_assignee();
