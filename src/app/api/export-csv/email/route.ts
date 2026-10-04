import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { buildItemsCsv, CSV_EXPORT_MAX_ITEMS, csvFileName } from "@/lib/csvExport";
import { fetchGroupMembersForGroups } from "@/lib/families";
import { fetchItemsByIds } from "@/lib/items";
import { MailerNotConfiguredError, sendMailWithAttachment } from "@/lib/mailer";
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

  const body = (await request.json().catch(() => null)) as { itemIds?: unknown } | null;
  const itemIds = body?.itemIds;
  if (
    !Array.isArray(itemIds) ||
    itemIds.length === 0 ||
    itemIds.length > CSV_EXPORT_MAX_ITEMS ||
    !itemIds.every((id) => typeof id === "string")
  ) {
    return errorResponse(`チケットを1〜${CSV_EXPORT_MAX_ITEMS}件選択してください。`, 400);
  }

  try {
    const items = await fetchItemsByIds(supabase, itemIds);
    if (items.length === 0) return errorResponse("出力できるチケットがありません。", 404);

    const members = await fetchGroupMembersForGroups(supabase, [...new Set(items.map((item) => item.group_id))]);
    const memberNameOf = (id: string | null) => members.find((m) => m.profile_id === id)?.profile.display_name;
    const csv = buildItemsCsv(items, memberNameOf);

    await sendMailWithAttachment({
      to: email,
      subject: `【YARURU】チケットCSV（${items.length}件）`,
      text: `YARURUで選択したチケット${items.length}件のCSVを添付します。\nJiraの「CSVのインポート」で取り込む際は、日付形式に「yyyy-MM-dd HH:mm」を指定してください。`,
      attachment: { filename: csvFileName(), content: csv, contentType: "text/csv; charset=utf-8" },
    });

    return NextResponse.json({ count: items.length });
  } catch (err) {
    if (err instanceof MailerNotConfiguredError) {
      return errorResponse("メール送信の設定がされていません。管理者にお問い合わせください。", 500);
    }
    console.error("CSVのメール送信に失敗しました", err);
    return errorResponse("メールの送信に失敗しました。時間をおいて再度お試しください。", 500);
  }
}
