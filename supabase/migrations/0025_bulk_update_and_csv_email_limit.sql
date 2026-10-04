-- YARURU: チケット一覧の一括変更を1回のトランザクションにまとめ、CSVメール送信に回数制限を設ける

-- 1. 一括変更（担当者・ステータス・開始日・期限日）
-- これまではクライアント側で「担当者・ステータスの一括更新」と「日付の1件ずつの更新」を別々に送っていたため、
-- 途中で通信が切れると一部の項目だけが変更された中途半端な状態が残っていた。
-- 1つの関数の中で行うことで、途中で例外が起きた場合はすべて自動的に取り消される。
-- SECURITY INVOKERのため、呼び出したユーザーのRLS（自分の家族グループの項目のみ更新可）がそのまま適用される。
create or replace function public.bulk_update_items(
  p_item_ids uuid[],
  p_set_assignee boolean,
  p_assignee_id uuid,
  p_status text,
  p_date_updates jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row jsonb;
begin
  if p_set_assignee or p_status is not null then
    update public.items
      set assignee_id = case when p_set_assignee then p_assignee_id else assignee_id end,
          status = coalesce(p_status, status)
      where id = any(p_item_ids);
  end if;

  -- 日付は項目ごとに値が異なる（各項目の時刻を保ったまま日付だけ変える）ため、1件ずつ更新する。
  -- キーが含まれる列だけを変更し、p_item_idsに含まれない項目は更新しない。
  for v_row in select value from jsonb_array_elements(coalesce(p_date_updates, '[]'::jsonb)) loop
    update public.items
      set start_at = case when v_row ? 'start_at' then (v_row ->> 'start_at')::timestamptz else start_at end,
          end_at = case when v_row ? 'end_at' then (v_row ->> 'end_at')::timestamptz else end_at end,
          due_at = case when v_row ? 'due_at' then (v_row ->> 'due_at')::timestamptz else due_at end
      where id = (v_row ->> 'id')::uuid
        and id = any(p_item_ids);
  end loop;
end;
$$;

revoke execute on function public.bulk_update_items(uuid[], boolean, uuid, text, jsonb) from public, anon;
grant execute on function public.bulk_update_items(uuid[], boolean, uuid, text, jsonb) to authenticated;

-- 2. CSVメール送信の回数制限
-- 連打などでGmailの1日の送信上限を使い切ると、パスワード再設定メールまで届かなくなるため、
-- 1人あたり「前回から60秒以上空ける」「1日（Asia/Tokyo）20回まで」に制限する。
-- 送信記録は関数経由でのみ読み書きする（RLSを有効にしてポリシーを作らないことで、直接のアクセスを禁止する）。
create table if not exists public.csv_email_sends (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now()
);

create index if not exists csv_email_sends_user_sent_at_idx on public.csv_email_sends (user_id, sent_at desc);

alter table public.csv_email_sends enable row level security;

-- 送信してよければ送信枠を1つ消費して'ok'を、制限中なら'too_soon'または'daily_limit'を返す。
-- 制限値はクライアントから指定させない（指定できると制限をすり抜けられるため、関数内に固定する）。
create or replace function public.claim_csv_email_slot()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_last_sent_at timestamptz;
  v_today_count integer;
begin
  if v_uid is null then
    raise exception 'ログインが必要です';
  end if;

  -- 同じユーザーの同時リクエストで制限をすり抜けないよう、ユーザー単位で直列化する
  perform pg_advisory_xact_lock(hashtext('csv_email_sends:' || v_uid::text));

  -- 判定に使わない古い記録は都度削除し、テーブルが肥大化しないようにする
  delete from public.csv_email_sends where user_id = v_uid and sent_at < now() - interval '2 days';

  select max(sent_at) into v_last_sent_at from public.csv_email_sends where user_id = v_uid;
  if v_last_sent_at is not null and v_last_sent_at > now() - interval '60 seconds' then
    return 'too_soon';
  end if;

  select count(*) into v_today_count
    from public.csv_email_sends
    where user_id = v_uid
      and sent_at >= (date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo');
  if v_today_count >= 20 then
    return 'daily_limit';
  end if;

  insert into public.csv_email_sends (user_id) values (v_uid);
  return 'ok';
end;
$$;

revoke execute on function public.claim_csv_email_slot() from public, anon;
grant execute on function public.claim_csv_email_slot() to authenticated;
