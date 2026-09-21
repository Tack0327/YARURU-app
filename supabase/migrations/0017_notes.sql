-- YARURU: 選択した日付ごとのメモ・日記機能
-- 1人が1日につき1件、公開範囲（家族全員に共有 / 自分だけ）を選んで書ける。
-- （注: この一意制約はのちに0018で「公開範囲ごとに1件、最大2件/日」に変更されている）

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.family_groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  note_date date not null,
  content text not null check (char_length(content) > 0),
  visibility text not null default 'private' check (visibility in ('shared', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, profile_id, note_date)
);

create index notes_group_date_idx on public.notes (group_id, note_date);

create or replace function public.notes_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger notes_before_update
  before update on public.notes
  for each row execute function public.notes_set_updated_at();

alter table public.notes enable row level security;

grant select, insert, update, delete on public.notes to authenticated;

-- 閲覧: 自分自身のメモは常に見える。他人のメモは公開範囲が「共有」かつ同じグループのメンバーの場合のみ見える。
create policy "notes_select" on public.notes
  for select using (
    profile_id = auth.uid()
    or (visibility = 'shared' and public.is_member_of_group(group_id))
    or public.is_super_admin()
  );

-- 作成: 自分自身の名前で、自分が所属するグループにのみ作成できる
create policy "notes_insert" on public.notes
  for insert with check (
    profile_id = auth.uid() and public.is_member_of_group(group_id)
  );

-- 更新・削除: 本人のみ（他人のメモは公開範囲に関わらず変更できない）
create policy "notes_update" on public.notes
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "notes_delete" on public.notes
  for delete using (profile_id = auth.uid() or public.is_super_admin());
