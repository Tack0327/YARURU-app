-- YARURU: 家族向け予定・ToDo共有アプリ 初期スキーマ

create extension if not exists "pgcrypto";

-- プロフィール（auth.usersに1:1で紐づく）
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) > 0),
  created_at timestamptz not null default now()
);

-- 家族グループ
create table public.family_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) > 0),
  invite_code text not null unique,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- 家族グループのメンバー
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.family_groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (group_id, profile_id)
);

create index family_members_profile_id_idx on public.family_members (profile_id);
create index family_members_group_id_idx on public.family_members (group_id);

-- 予定・ToDo
create table public.items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.family_groups (id) on delete cascade,
  type text not null check (type in ('event', 'todo')),
  title text not null check (char_length(title) > 0),
  description text,
  start_at timestamptz,
  due_at timestamptz,
  assignee_id uuid references public.profiles (id) on delete set null,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'done')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index items_group_id_idx on public.items (group_id);
create index items_group_status_idx on public.items (group_id, status);
create index items_group_due_at_idx on public.items (group_id, due_at);
create index items_assignee_id_idx on public.items (assignee_id);
