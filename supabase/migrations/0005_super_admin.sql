-- YARURU: スーパー管理者機能（全グループのチケット操作・アカウント削除）
-- 対象は特定の1アカウント（メールアドレスで判定）のみ。通常ユーザーの家族グループ間の分離には影響しない。

-- 呼び出し元がスーパー管理者かどうかを判定する
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid() and lower(email) = lower('Hisataka.Takagi.ym@renesas.com')
  );
$$;

grant execute on function public.is_super_admin() to authenticated;

-- アカウント削除時に、そのユーザーが作成した項目・グループが道連れで消えないようにする
-- （created_byは監査用の参照であり、アプリの認可判定には使われていないため null 化してよい）
alter table public.items alter column created_by drop not null;
alter table public.items drop constraint if exists items_created_by_fkey;
alter table public.items
  add constraint items_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.family_groups alter column created_by drop not null;
alter table public.family_groups drop constraint if exists family_groups_created_by_fkey;
alter table public.family_groups
  add constraint family_groups_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null;

-- アカウントを削除する（本人自身、またはスーパー管理者のみ実行可能）
create or replace function public.delete_user_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() <> p_user_id and not public.is_super_admin() then
    raise exception '権限がありません';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

grant execute on function public.delete_user_account(uuid) to authenticated;

-- スーパー管理者向け: 全アカウント一覧（メールアドレスはauth.users側にしかないため関数経由で返す）
create or replace function public.list_all_accounts()
returns table (id uuid, email text, display_name text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_super_admin() then
    raise exception '権限がありません';
  end if;

  return query
    select p.id, u.email, p.display_name, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at asc;
end;
$$;

grant execute on function public.list_all_accounts() to authenticated;

-- 既存RLSポリシーをスーパー管理者にも許可するよう更新
drop policy if exists "profiles_select_self_or_group_member" on public.profiles;
create policy "profiles_select_self_or_group_member" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.family_members me
      join public.family_members other on other.group_id = me.group_id
      where me.profile_id = auth.uid() and other.profile_id = public.profiles.id
    )
    or public.is_super_admin()
  );

drop policy if exists "family_groups_select_member" on public.family_groups;
create policy "family_groups_select_member" on public.family_groups
  for select using (public.is_member_of_group(id) or public.is_super_admin());

drop policy if exists "family_members_select_group" on public.family_members;
create policy "family_members_select_group" on public.family_members
  for select using (public.is_member_of_group(group_id) or public.is_super_admin());

drop policy if exists "items_select_group" on public.items;
create policy "items_select_group" on public.items
  for select using (public.is_member_of_group(group_id) or public.is_super_admin());

drop policy if exists "items_insert_group" on public.items;
create policy "items_insert_group" on public.items
  for insert with check (
    (public.is_member_of_group(group_id) or public.is_super_admin()) and created_by = auth.uid()
  );

drop policy if exists "items_update_group" on public.items;
create policy "items_update_group" on public.items
  for update using (public.is_member_of_group(group_id) or public.is_super_admin())
  with check (public.is_member_of_group(group_id) or public.is_super_admin());

drop policy if exists "items_delete_group" on public.items;
create policy "items_delete_group" on public.items
  for delete using (public.is_member_of_group(group_id) or public.is_super_admin());
