-- YARURU: CSVメール送信の失敗時に送信枠を戻せるようにし、管理者の同時委譲時のメッセージを分かりやすくする

-- 1. CSVメール送信の枠を戻す
-- claim_csv_email_slot（0025）で枠を確保した後、Gmailの一時的なエラーなどで送信に失敗すると、
-- 送っていないのに「60秒待って」と表示され、1日20回の枠も減ってしまっていた。
-- 送信に失敗したときにサーバー（API）から呼び、直前（5分以内）に確保した最新の1件だけを取り消す。
create or replace function public.release_csv_email_slot()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'ログインが必要です';
  end if;

  -- claim_csv_email_slotと同じロックで直列化し、確保と取り消しが入れ違いにならないようにする
  perform pg_advisory_xact_lock(hashtext('csv_email_sends:' || v_uid::text));

  delete from public.csv_email_sends
  where id = (
    select id from public.csv_email_sends
    where user_id = v_uid and sent_at > now() - interval '5 minutes'
    order by sent_at desc
    limit 1
  );
end;
$$;

revoke execute on function public.release_csv_email_slot() from public, anon;
grant execute on function public.release_csv_email_slot() to authenticated, service_role;

-- 2. 管理者の委譲（本文は0027と同じ。同時に委譲されたときのメッセージのみ変更）
-- 2人が同時に委譲すると、後から処理された側は「for update」で待った後、すでに一般メンバーに変わった行を読み直すため、
-- 管理者が見つからず「このグループには管理者がいません」という誤解を招くメッセージになっていた。
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
    -- ロックを待っている間に他の人が先に委譲を終えた場合は、新しい管理者がいるので競合として案内する
    if exists (select 1 from public.family_members where group_id = p_group_id and role = 'owner') then
      raise exception '他の操作と同時に実行されたため、管理者を変更できませんでした。画面を再読み込みしてから再度お試しください';
    end if;
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

revoke execute on function public.transfer_group_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_group_ownership(uuid, uuid) to authenticated, service_role;
