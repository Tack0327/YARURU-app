-- YARURU: 予定の終了時刻・終日・繰り返しに対応する列を追加

alter table public.items
  add column end_at timestamptz,
  add column is_all_day boolean not null default false,
  add column recurrence_freq text check (recurrence_freq in ('daily', 'weekly', 'biweekly', 'monthly')),
  add column recurrence_group_id uuid;

create index items_recurrence_group_id_idx on public.items (recurrence_group_id);
