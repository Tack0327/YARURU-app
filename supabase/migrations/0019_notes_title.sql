-- YARURU: メモ・日記にタイトルを追加する
-- タイトルだけ・詳細だけの入力でも保存できるよう、contentのNOT NULL制約を緩め、
-- タイトル・詳細のどちらか一方は入っていることをDB側でも保証する。

alter table public.notes add column title text;

alter table public.notes alter column content drop not null;
alter table public.notes drop constraint if exists notes_content_check;

alter table public.notes
  add constraint notes_title_or_content_check
  check (coalesce(title, '') <> '' or coalesce(content, '') <> '');
