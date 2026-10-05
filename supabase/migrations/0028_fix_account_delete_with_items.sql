-- YARURU: 0027で追加したトリガーにより、アカウント削除が失敗するようになった不具合を修正する
--
-- items.created_byは「プロフィールが削除されたらNULLにする」外部キー（0005）になっている。
-- 外部キーによるNULL化もitemsのUPDATEとして扱われ、BEFORE UPDATEトリガーが発火するため、
-- 0027のitems_prevent_owner_changeが「作成者は変更できません」で拒否し、アカウント削除全体が取り消されていた。
--
-- 対策：外部キーの連鎖処理（アカウント削除→プロフィール削除→作成者のNULL化）から呼ばれた場合だけ、NULLへの変更を許可する。
-- 連鎖処理は内部トリガー経由で実行されるためトリガーの入れ子の深さ（pg_trigger_depth）が2以上になる。
-- アプリ（PostgREST）からの直接のUPDATEは深さ1のため、作成者の書き換えは引き続き拒否される。
create or replace function public.items_prevent_owner_change()
returns trigger
language plpgsql
as $$
begin
  if new.group_id is distinct from old.group_id then
    raise exception 'チケットを別の家族グループへ移すことはできません';
  end if;
  if new.created_by is distinct from old.created_by
     and not (new.created_by is null and pg_trigger_depth() > 1) then
    raise exception 'チケットの作成者は変更できません';
  end if;
  return new;
end;
$$;

-- 実行後の確認用（アカウント削除を本番で試さずに、トリガーの判定だけを確認する）：
-- 次のSQLは「アプリから直接、作成者を書き換えようとした場合」を再現し、エラーになれば正しい。
-- begin;
--   update public.items set created_by = null where id = (select id from public.items where created_by is not null limit 1);
-- rollback;
-- → 「チケットの作成者は変更できません」と表示されれば正しい（最後のrollbackにより、データは変更されない）。
