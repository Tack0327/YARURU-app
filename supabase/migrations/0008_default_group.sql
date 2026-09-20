-- YARURU: ログイン後に最初に表示する家族グループ（デフォルト表示）を設定できるようにする
-- profilesには既にRLSの update ポリシー（本人のみ）があるため、新たなポリシーは不要。

alter table public.profiles
  add column if not exists default_group_id uuid references public.family_groups (id) on delete set null;
