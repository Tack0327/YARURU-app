-- YARURU: 他人の「自分だけ」メモが見えてしまう不具合の対策として、notesのRLSポリシーを再定義する
-- （意図した内容と実際に適用されている内容がずれていないか、念のため作り直して確実にする）

drop policy if exists "notes_select" on public.notes;
create policy "notes_select" on public.notes
  for select using (
    profile_id = auth.uid()
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
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "notes_delete" on public.notes;
create policy "notes_delete" on public.notes
  for delete using (profile_id = auth.uid() or public.is_super_admin());
