-- YARURU: 「家族に共有」メモを、投稿者ごとではなく1日1件・グループ全体で共有する1件に変更する
-- （これまでは「共有」を選んでも投稿者ごとに別々のメモとして扱われ、他の人には別枠で見えてしまっていた）
-- 「自分だけ」は引き続き本人のみ閲覧・編集できる。「家族に共有」はグループの誰でも閲覧・編集でき、
-- 編集するとprofile_idが「最後に編集した人」に更新される。

-- 一意制約を追加する前に、同じグループ・日付で複数人が作成してしまった「共有」メモが重複していれば、
-- 最後に更新されたものだけを残して統合する。
delete from public.notes a
using public.notes b
where a.visibility = 'shared'
  and b.visibility = 'shared'
  and a.group_id = b.group_id
  and a.note_date = b.note_date
  and a.id <> b.id
  and (a.updated_at, a.id) < (b.updated_at, b.id);

alter table public.notes drop constraint if exists notes_group_id_profile_id_note_date_visibility_key;

create unique index if not exists notes_private_unique_idx
  on public.notes (group_id, profile_id, note_date) where visibility = 'private';

create unique index if not exists notes_shared_unique_idx
  on public.notes (group_id, note_date) where visibility = 'shared';

drop policy if exists "notes_select" on public.notes;
create policy "notes_select" on public.notes
  for select using (
    (visibility = 'private' and profile_id = auth.uid())
    or (visibility = 'shared' and public.is_member_of_group(group_id))
    or public.is_super_admin()
  );

drop policy if exists "notes_insert" on public.notes;
create policy "notes_insert" on public.notes
  for insert with check (
    profile_id = auth.uid() and public.is_member_of_group(group_id)
  );

drop policy if exists "notes_update" on public.notes;
create policy "notes_update" on public.notes
  for update using (
    (visibility = 'private' and profile_id = auth.uid())
    or (visibility = 'shared' and public.is_member_of_group(group_id))
  )
  with check (
    profile_id = auth.uid()
    and (
      visibility = 'private'
      or (visibility = 'shared' and public.is_member_of_group(group_id))
    )
  );

drop policy if exists "notes_delete" on public.notes;
create policy "notes_delete" on public.notes
  for delete using (
    (visibility = 'private' and profile_id = auth.uid())
    or (visibility = 'shared' and public.is_member_of_group(group_id))
    or public.is_super_admin()
  );
