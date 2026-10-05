import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  buildItemsCsv,
  CSV_EMAIL_DAILY_LIMIT,
  CSV_EMAIL_MIN_INTERVAL_SECONDS,
  CSV_PURPOSE_LABEL,
  csvFileName,
  parseCsvEmailRequest,
} from "@/lib/csvExport";
import { fetchGroupMembersForGroups } from "@/lib/families";
import { fetchItemsByIds } from "@/lib/items";
import { isMailerConfigured, MailerNotConfiguredError, sendMailWithAttachment } from "@/lib/mailer";
import { createClient } from "@/lib/supabase/server";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * 選択したチケットのCSVを、ログイン中の本人のメールアドレス宛に添付して送る。
 * 宛先はリクエストからは受け取らず、CSVの中身もクライアントから受け取らずにサーバー側で作り直す
 * （他人宛ての送信や、閲覧権限の無いデータの送信に悪用されないようにするため）。
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  // 通信エラーまで「未ログイン」と表示すると原因を誤解させるため、区別して返す
  if (isAuthRetryableFetchError(authError)) {
    console.error("認証サーバーに接続できませんでした", authError);
    return errorResponse("認証サーバーに接続できませんでした。時間をおいて再度お試しください。", 503);
  }
  const email = auth.user?.email;
  if (!email) return errorResponse("ログインしてください。", 401);

  const parsed = parseCsvEmailRequest(await request.json().catch(() => null));
  if (!parsed.ok) return errorResponse(parsed.error, 400);
  const { itemIds, purpose } = parsed;

  // 送信できない設定のまま送信回数だけを消費しないよう、回数制限の確認より前に調べる
  if (!isMailerConfigured()) {
    return errorResponse("メール送信の設定がされていません。管理者にお問い合わせください。", 500);
  }

  let slotClaimed = false;
  try {
    const items = await fetchItemsByIds(supabase, itemIds);
    if (items.length === 0) return errorResponse("出力できるチケットがありません。", 404);

    // 連打でGmailの1日の送信上限を使い切り、パスワード再設定メールまで届かなくなることを防ぐ
    const { data: slot, error: slotError } = await supabase.rpc("claim_csv_email_slot");
    if (slotError) throw slotError;
    if (slot === "too_soon") {
      return errorResponse(`続けて送信できません。${CSV_EMAIL_MIN_INTERVAL_SECONDS}秒ほど待ってから再度お試しください。`, 429);
    }
    if (slot === "daily_limit") {
      return errorResponse(`メールで送れるのは1日${CSV_EMAIL_DAILY_LIMIT}回までです。ダウンロードをご利用ください。`, 429);
    }
    slotClaimed = true;

    const members = await fetchGroupMembersForGroups(supabase, [...new Set(items.map((item) => item.group_id))]);
    const memberNameOf = (id: string | null) => members.find((m) => m.profile_id === id)?.profile.display_name;
    const csv = buildItemsCsv(items, memberNameOf, purpose);

    const note =
      purpose === "jira"
        ? "Jiraの「CSVのインポート」で取り込む際は、日付形式に「yyyy-MM-dd HH:mm」を指定してください。"
        : "Excelで開いたときに数式として実行されないよう、「= + - @」で始まる値の先頭に「'」を付けています。";
    await sendMailWithAttachment({
      to: email,
      subject: `【YARURU】チケットCSV・${CSV_PURPOSE_LABEL[purpose]}（${items.length}件）`,
      text: `YARURUで選択したチケット${items.length}件のCSV（${CSV_PURPOSE_LABEL[purpose]}）を添付します。\n${note}`,
      attachment: { filename: csvFileName(purpose), content: csv, contentType: "text/csv; charset=utf-8" },
    });

    return NextResponse.json({ count: items.length });
  } catch (err) {
    // 送信枠を確保した後に失敗した場合は、送っていないのに回数だけ減らないよう枠を戻す
    // （戻す処理自体が失敗しても、利用者に返すのは送信失敗のメッセージでよいため結果は無視する）
    if (slotClaimed) await supabase.rpc("release_csv_email_slot");
    if (err instanceof MailerNotConfiguredError) {
      return errorResponse("メール送信の設定がされていません。管理者にお問い合わせください。", 500);
    }
    console.error("CSVのメール送信に失敗しました", err);
    return errorResponse("メールの送信に失敗しました。時間をおいて再度お試しください。", 500);
  }
}
