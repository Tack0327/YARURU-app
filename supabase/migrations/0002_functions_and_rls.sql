-- YARURU: 関数・トリガー・RLSポリシー

-- 新規ユーザー登録時にprofilesへ自動作成
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- items更新時、statusの変化に応じてcompleted_atを自動設定・解除し、updated_atを更新する
create or replace function public.items_set_audit_fields()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger items_before_update
  before update on public.items
  for each row execute function public.items_set_audit_fields();

-- 招待コード生成ヘルパー（8桁の英数字）
create or replace function public.generate_invite_code()
returns text
language sql
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

-- 自分が指定グループのメンバーかどうかを判定する
-- family_members自体のRLSポリシーから参照しても再帰しないよう SECURITY DEFINER にする
create or replace function public.is_member_of_group(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.family_members
    where group_id = p_group_id and profile_id = auth.uid()
  );
$$;

-- 家族グループを新規作成し、自分をownerとして登録する
create or replace function public.create_family_group(p_name text)
returns public.family_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.family_groups;
begin
  insert into public.family_groups (name, invite_code, created_by)
  values (p_name, public.generate_invite_code(), auth.uid())
  returning * into v_group;

  insert into public.family_members (group_id, profile_id, role)
  values (v_group.id, auth.uid(), 'owner');

  return v_group;
end;
$$;

-- 招待コードで家族グループに参加する
create or replace function public.join_family_group(p_invite_code text)
returns public.family_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.family_groups;
begin
  select * into v_group
  from public.family_groups
  where invite_code = p_invite_code;

  if not found then
    raise exception '招待コードが見つかりません';
  end if;

  insert into public.family_members (group_id, profile_id, role)
  values (v_group.id, auth.uid(), 'member')
  on conflict (group_id, profile_id) do nothing;

  return v_group;
end;
$$;

grant execute on function public.is_member_of_group(uuid) to authenticated;
grant execute on function public.create_family_group(text) to authenticated;
grant execute on function public.join_family_group(text) to authenticated;

-- RLS有効化
alter table public.profiles enable row level security;
alter table public.family_groups enable row level security;
alter table public.family_members enable row level security;
alter table public.items enable row level security;

grant select, update on public.profiles to authenticated;
grant select on public.family_groups to authenticated;
grant select on public.family_members to authenticated;
grant select, insert, update, delete on public.items to authenticated;

-- profiles: 自分自身、または同じグループに所属するメンバーの表示名を参照できる
create policy "profiles_select_self_or_group_member" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.family_members me
      join public.family_members other on other.group_id = me.group_id
      where me.profile_id = auth.uid() and other.profile_id = public.profiles.id
    )
  );

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- family_groups: 所属メンバーのみ参照可能。作成・参加はSECURITY DEFINER関数経由のみ
create policy "family_groups_select_member" on public.family_groups
  for select using (public.is_member_of_group(id));

-- family_members: 同じグループのメンバー同士は参照可能。追加はSECURITY DEFINER関数経由のみ
create policy "family_members_select_group" on public.family_members
  for select using (public.is_member_of_group(group_id));

-- items: 同じ家族グループのメンバーのみ閲覧・登録・編集・削除できる
create policy "items_select_group" on public.items
  for select using (public.is_member_of_group(group_id));

create policy "items_insert_group" on public.items
  for insert with check (
    public.is_member_of_group(group_id) and created_by = auth.uid()
  );

create policy "items_update_group" on public.items
  for update using (public.is_member_of_group(group_id))
  with check (public.is_member_of_group(group_id));

create policy "items_delete_group" on public.items
  for delete using (public.is_member_of_group(group_id));
