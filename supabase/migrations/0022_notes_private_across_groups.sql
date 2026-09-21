-- YARURU: 「自分だけ」メモを、家族グループに関わらず本人につき1日1件の共通メモに変更する
-- （これまではグループごとに別々のメモとして扱われていたが、個人の日記としては
-- どのグループを見ていても同じ内容であるべきなので、グループへの紐づけをやめる）
-- グループが削除されても「自分だけ」メモは残るよう、group_idをnull許容にして解放する。

alter table public.notes alter column group_id drop not null;

alter table public.notes drop constraint if exists notes_shared_requires_group_check;
alter table public.notes add constraint notes_shared_requires_group_check
  check (visibility = 'private' or group_id is not null);

-- 移行前に、同じ本人・日付で複数グループ分に分かれてしまっている「自分だけ」メモがあれば、
-- 最後に更新されたものだけを残して統合する。
with ranked as (
  select id, row_number() over (
    partition by profile_id, note_date
    order by updated_at desc, id desc
  ) as rn
  from public.notes
  where visibility = 'private'
)
delete from public.notes n
using ranked r
where n.id = r.id and r.rn > 1;

update public.notes set group_id = null where visibility = 'private';

drop index if exists notes_private_unique_idx;
create unique index if not exists notes_private_unique_idx
  on public.notes (profile_id, note_date) where visibility = 'private';

-- notes_insertは元々「グループのメンバーであること」を全件に要求していたが、
-- 「自分だけ」メモはgroup_idを持たなくなったため、共有メモのときだけこの要件を課す。
drop policy if exists "notes_insert" on public.notes;
create policy "notes_insert" on public.notes
  for insert with check (
    profile_id = auth.uid()
    and (visibility = 'private' or public.is_member_of_group(group_id))
  );
