-- YARURU: 未ログイン（anonキー）からRPC関数を実行できてしまう問題を修正する
--
-- delete_user_account・transfer_group_ownershipは「auth.uid() <> 対象」で本人確認をしていたが、
-- 未ログインだとauth.uid()がNULLになり、比較結果もNULL（=偽扱い）になるため「権限がありません」が出ずに処理が進んでいた。
-- また関数の実行権限は既定でpublic/anonにも付いているため、アプリに埋め込まれた公開キーだけで外部から呼び出せた。
-- 対策として (1) 未ログインを最初に拒否し、NULLでも正しく判定できる比較にする (2) 全RPC関数からanon/publicの実行権限を外す。

-- 1-1. アカウント削除（本文は0014と同じ。先頭の判定のみ変更）
create or replace function public.delete_user_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_blocking_group text;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  if auth.uid() is distinct from p_user_id and not public.is_super_admin() then
    raise exception '権限がありません';
  end if;

  select fg.name into v_blocking_group
  from public.family_members fm
  join public.family_groups fg on fg.id = fm.group_id
  where fm.profile_id = p_user_id
    and fm.role = 'owner'
    and exists (
      select 1 from public.family_members other
      where other.group_id = fm.group_id and other.profile_id <> p_user_id
    )
  limit 1;

  if v_blocking_group is not null then
    raise exception '「%」の管理者になっています。削除する前に、そのグループで別のメンバーへ管理者を委譲してください', v_blocking_group;
  end if;

  -- 自分ひとりだけが所属している家族グループは、アカウント削除と同時に削除する
  -- （items/family_membersはfamily_groupsのon delete cascadeで連鎖削除される）
  delete from public.family_groups
  where id in (
    select fm.group_id
    from public.family_members fm
    where fm.profile_id = p_user_id
      and not exists (
        select 1 from public.family_members other
        where other.group_id = fm.group_id and other.profile_id <> p_user_id
      )
  );

  delete from auth.users where id = p_user_id;
end;
$$;

-- 1-2. 管理者の委譲（本文は0013と同じ。先頭の判定のみ変更）
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
  where group_id = p_group_id and role = 'owner';

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

  update public.family_members set role = 'member' where group_id = p_group_id and profile_id = v_current_owner;
  update public.family_members set role = 'owner' where group_id = p_group_id and profile_id = p_new_owner_id;
end;
$$;

-- 1-3. 管理者を委譲してからアカウント削除（本文は0024と同じ。先頭の判定を追加）
create or replace function public.delete_account_with_transfers(p_user_id uuid, p_transfers jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer jsonb;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  for v_transfer in select * from jsonb_array_elements(p_transfers)
  loop
    perform public.transfer_group_ownership(
      (v_transfer ->> 'group_id')::uuid,
      (v_transfer ->> 'new_owner_id')::uuid
    );
  end loop;

  perform public.delete_user_account(p_user_id);
end;
$$;

-- 2. アプリから呼ぶRPC関数（トリガー用の関数を除く全16件）の実行を、ログイン済みユーザーに限定する。
-- Supabaseは関数を作るとanonにも実行権限を付けるため、publicだけでなくanonからも明示的に外す。
-- RLSのポリシー内で使うis_member_of_group・is_super_adminも、未ログインの利用者は使わないため同様に外す。
do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.is_member_of_group(uuid)',
    'public.is_super_admin()',
    'public.generate_invite_code()',
    'public.create_family_group(text)',
    'public.join_family_group(text)',
    'public.regenerate_invite_code(uuid)',
    'public.remove_family_member(uuid, uuid)',
    'public.delete_family_group(uuid)',
    'public.leave_family_group(uuid)',
    'public.set_default_group(uuid)',
    'public.transfer_group_ownership(uuid, uuid)',
    'public.delete_user_account(uuid)',
    'public.delete_account_with_transfers(uuid, jsonb)',
    'public.list_all_accounts()',
    'public.upsert_private_note(date, text, text)',
    'public.upsert_shared_note(uuid, date, text, text)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon', v_signature);
    execute format('grant execute on function %s to authenticated, service_role', v_signature);
  end loop;
end;
$$;

-- 実行後の確認用（すべて false になっていればよい）：
-- select p.oid::regprocedure as fn, has_function_privilege('anon', p.oid, 'execute') as anon_can_execute
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype
-- order by 1;
