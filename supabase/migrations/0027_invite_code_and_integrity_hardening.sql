-- YARURU: 招待コードの強化と、家族グループ・チケットのデータ整合性の強化
--
-- 1. 招待コードを8桁から12桁にする（総当たりで見つけにくくする。既存のコードは再発行するまでそのまま使える）
-- 2. 招待コードでの参加に試行回数の制限を設ける（1時間に10回まで失敗できる）
-- 3. メンバーを削除したら招待コードを作り直す（削除した人が覚えている同じコードで再参加できないようにする）
-- 4. 管理者（owner）が1グループに1人だけになるよう保証する（管理者の委譲を同時に行ったときに2人にならないようにする）
-- 5. チケットを別の家族グループへ移したり、作成者を書き換えたりする更新を禁止する
-- 6. 選択したチケットのまとめて削除を1つのリクエストで行う（件数が多いとURLが長すぎて失敗するのを防ぐ）

-- 1. 招待コード（12桁の英数字。16進数12桁で約281兆通り）
create or replace function public.generate_invite_code()
returns text
language sql
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
$$;

-- 2. 招待コードでの参加の試行記録（関数経由でのみ読み書きする。RLSを有効にしてポリシーを作らないことで直接のアクセスを禁止する）
create table if not exists public.invite_code_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null
);

create index if not exists invite_code_attempts_user_attempted_at_idx
  on public.invite_code_attempts (user_id, attempted_at desc);

alter table public.invite_code_attempts enable row level security;

-- 招待コードが見つからない場合は、例外ではなくNULLを返す
-- （例外を投げると、失敗の記録まで取り消されて試行回数の制限が効かなくなるため）
create or replace function public.join_family_group(p_invite_code text)
returns public.family_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.family_groups;
  v_recent_failures integer;
begin
  if v_uid is null then
    raise exception 'ログインが必要です';
  end if;

  -- 同じユーザーの同時リクエストで制限をすり抜けないよう、ユーザー単位で直列化する
  perform pg_advisory_xact_lock(hashtext('invite_code_attempts:' || v_uid::text));

  delete from public.invite_code_attempts where user_id = v_uid and attempted_at < now() - interval '1 day';

  select count(*) into v_recent_failures
    from public.invite_code_attempts
    where user_id = v_uid and succeeded = false and attempted_at > now() - interval '1 hour';
  if v_recent_failures >= 10 then
    raise exception '招待コードの入力に続けて失敗したため、しばらく参加できません。1時間ほど待ってから再度お試しください';
  end if;

  select * into v_group
  from public.family_groups
  where invite_code = upper(trim(p_invite_code));

  if not found then
    insert into public.invite_code_attempts (user_id, succeeded) values (v_uid, false);
    return null;
  end if;

  insert into public.invite_code_attempts (user_id, succeeded) values (v_uid, true);

  insert into public.family_members (group_id, profile_id, role)
  values (v_group.id, v_uid, 'member')
  on conflict (group_id, profile_id) do nothing;

  return v_group;
end;
$$;

-- 3. メンバーの削除（本文は0004と同じ。未ログインの拒否と、削除後の招待コードの作り直しを追加）
create or replace function public.remove_family_member(p_group_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  if not exists (
    select 1 from public.family_members
    where group_id = p_group_id and profile_id = auth.uid() and role = 'owner'
  ) then
    raise exception '権限がありません';
  end if;

  if p_profile_id is not distinct from auth.uid() then
    raise exception '自分自身を削除することはできません';
  end if;

  delete from public.family_members
  where group_id = p_group_id and profile_id = p_profile_id;

  update public.family_groups
  set invite_code = public.generate_invite_code()
  where id = p_group_id;
end;
$$;

-- 4. 管理者は1グループに1人だけ
-- 既にデータが不整合（管理者が2人以上のグループがある）場合は、ここで分かりやすいエラーにして止める
do $$
begin
  if exists (
    select group_id from public.family_members where role = 'owner' group by group_id having count(*) > 1
  ) then
    raise exception '管理者が2人以上いる家族グループがあります。先に1人にしてから、このSQLを実行してください';
  end if;
end;
$$;

create unique index if not exists family_members_one_owner_per_group
  on public.family_members (group_id) where role = 'owner';

-- 管理者の委譲（本文は0026と同じ。現在の管理者の行をロックし、同時に委譲されても順番に処理されるようにする）
create or replace function public.transfer_group_ownership(p_group_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  select profile_id into v_current_owner
  from public.family_members
  where group_id = p_group_id and role = 'owner'
  for update;

  if v_current_owner is null then
    raise exception 'このグループには管理者がいません';
  end if;

  if v_current_owner is distinct from auth.uid() and not public.is_super_admin() then
    raise exception '権限がありません';
  end if;

  if not exists (
    select 1 from public.family_members
    where group_id = p_group_id and profile_id = p_new_owner_id
  ) then
    raise exception '指定されたメンバーはこのグループに所属していません';
  end if;

  if p_new_owner_id = v_current_owner then
    return;
  end if;

  -- 一意制約（管理者は1人）に違反しないよう、先に現在の管理者を一般メンバーに戻してから新しい管理者にする
  update public.family_members set role = 'member' where group_id = p_group_id and profile_id = v_current_owner;
  update public.family_members set role = 'owner' where group_id = p_group_id and profile_id = p_new_owner_id;
end;
$$;

-- 5. チケットの家族グループ・作成者は変更できないようにする
-- 画面からは変更しないが、APIを直接呼ぶと別のグループへ移せてしまい、担当者の所属チェック（0010）も行われなかったため
create or replace function public.items_prevent_owner_change()
returns trigger
language plpgsql
as $$
begin
  if new.group_id is distinct from old.group_id then
    raise exception 'チケットを別の家族グループへ移すことはできません';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'チケットの作成者は変更できません';
  end if;
  return new;
end;
$$;

drop trigger if exists items_prevent_owner_change_trigger on public.items;
create trigger items_prevent_owner_change_trigger
  before update on public.items
  for each row execute function public.items_prevent_owner_change();

-- 6. まとめて削除（SECURITY INVOKERのため、呼び出したユーザーのRLSがそのまま適用される）
create or replace function public.bulk_delete_items(p_item_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.items where id = any(p_item_ids);
end;
$$;

-- 実行権限（新規・変更した関数。Supabaseは既定でanonにも付けるため明示的に外す）
revoke execute on function public.generate_invite_code() from public, anon;
grant execute on function public.generate_invite_code() to authenticated, service_role;
revoke execute on function public.join_family_group(text) from public, anon;
grant execute on function public.join_family_group(text) to authenticated, service_role;
revoke execute on function public.remove_family_member(uuid, uuid) from public, anon;
grant execute on function public.remove_family_member(uuid, uuid) to authenticated, service_role;
revoke execute on function public.transfer_group_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_group_ownership(uuid, uuid) to authenticated, service_role;
revoke execute on function public.bulk_delete_items(uuid[]) from public, anon;
grant execute on function public.bulk_delete_items(uuid[]) to authenticated, service_role;
