-- YARURU: notesの3件の不具合をまとめて修正する
-- 1) 共有メモの visibility/group_id を更新経由で書き換えられてしまう抜け道を塞ぐ
-- 2) 共有メモの「最後に編集した人」のアカウントが削除されると、共有メモ自体が連鎖削除されてしまう問題を修正
-- 3) メモ保存が「検索→挿入or更新」の非アトミック処理で、同時保存時に片方が失敗して内容が消える問題を、
--    DB側のON CONFLICTによる本当のUPSERTに変更して解消する

-- 1) visibility・group_idは作成後に変更できないようにする（公開範囲の後からの書き換えを禁止）
create or replace function public.notes_prevent_visibility_change()
returns trigger
language plpgsql
as $$
begin
  if new.visibility is distinct from old.visibility or new.group_id is distinct from old.group_id then
    raise exception '公開範囲は後から変更できません';
  end if;
  return new;
end;
$$;

drop trigger if exists notes_prevent_visibility_change_trigger on public.notes;
create trigger notes_prevent_visibility_change_trigger
  before update on public.notes
  for each row execute function public.notes_prevent_visibility_change();

-- 2) 共有メモのprofile_id（最後に編集した人）は「編集者情報」であり「所有者」ではないため、
--    そのアカウントが削除されても共有メモ自体は残す。「自分だけ」メモは本人のものなので、
--    アカウント削除時に一緒に削除する。
alter table public.notes alter column profile_id drop not null;

alter table public.notes drop constraint if exists notes_profile_id_fkey;
alter table public.notes add constraint notes_profile_id_fkey
  foreign key (profile_id) references public.profiles (id) on delete set null;

create or replace function public.notes_cleanup_private_on_profile_delete()
returns trigger
language plpgsql
as $$
begin
  delete from public.notes where profile_id = old.id and visibility = 'private';
  return old;
end;
$$;

drop trigger if exists notes_cleanup_private_before_profile_delete on public.profiles;
create trigger notes_cleanup_private_before_profile_delete
  before delete on public.profiles
  for each row execute function public.notes_cleanup_private_on_profile_delete();

-- 3) アプリからの直接のinsert/updateを禁止し、以下のSECURITY DEFINER関数経由のみに一本化する
--    （これにより、上の1)のポリシー抜け道も含めて公開範囲の書き換えができなくなる）
revoke insert, update on public.notes from authenticated;

create or replace function public.upsert_private_note(p_note_date date, p_title text, p_content text)
returns public.notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note public.notes;
begin
  if coalesce(p_title, '') = '' and coalesce(p_content, '') = '' then
    raise exception 'タイトルか詳細のどちらかを入力してください';
  end if;

  insert into public.notes (group_id, profile_id, note_date, title, content, visibility)
  values (null, auth.uid(), p_note_date, p_title, p_content, 'private')
  on conflict (profile_id, note_date) where visibility = 'private'
  do update set title = excluded.title, content = excluded.content
  returning * into v_note;

  return v_note;
end;
$$;

grant execute on function public.upsert_private_note(date, text, text) to authenticated;

create or replace function public.upsert_shared_note(p_group_id uuid, p_note_date date, p_title text, p_content text)
returns public.notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note public.notes;
begin
  if not public.is_member_of_group(p_group_id) then
    raise exception '権限がありません';
  end if;

  if coalesce(p_title, '') = '' and coalesce(p_content, '') = '' then
    raise exception 'タイトルか詳細のどちらかを入力してください';
  end if;

  insert into public.notes (group_id, profile_id, note_date, title, content, visibility)
  values (p_group_id, auth.uid(), p_note_date, p_title, p_content, 'shared')
  on conflict (group_id, note_date) where visibility = 'shared'
  do update set title = excluded.title, content = excluded.content, profile_id = excluded.profile_id
  returning * into v_note;

  return v_note;
end;
$$;

grant execute on function public.upsert_shared_note(uuid, date, text, text) to authenticated;
