-- YARURU: notesテーブルの一意制約を、公開範囲ごとに1件（最大2件/日）持てるように変更する
-- 0017実行時点では group_id, profile_id, note_date のみの一意制約だったため、
-- 「家族に共有」と「自分だけ」を同じ日に両方保存できるよう visibility も制約に含める。

alter table public.notes drop constraint if exists notes_group_id_profile_id_note_date_key;

alter table public.notes
  add constraint notes_group_id_profile_id_note_date_visibility_key
  unique (group_id, profile_id, note_date, visibility);
