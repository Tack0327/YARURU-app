import type { Item } from "@/types/database";
import { dueDeadlineMs } from "./dateUtils";

const NOTIFY_BEFORE_DUE_MS = 24 * 60 * 60 * 1000;

/**
 * 通知が必要かどうかの判定ロジック。
 * 将来LINE Messaging APIで送信する際も、この判定結果に対してsendNotificationを呼ぶだけでよいように
 * 「判定」と「送信」を分離している（MVPでは送信処理は未実装）。
 */
export function shouldNotifyForItem(
  item: Pick<Item, "status" | "due_at"> & Partial<Pick<Item, "is_all_day">>,
  now: Date = new Date()
): boolean {
  if (item.status === "done" || !item.due_at) return false;
  // 終日の項目は期限日が終わるまでを期限内とする（画面の期限超過の判定と揃えるため、dateUtilsの同じ関数を使う）
  return dueDeadlineMs(item.due_at, item.is_all_day ?? false) - now.getTime() <= NOTIFY_BEFORE_DUE_MS;
}

export type NotificationPayload = {
  itemId: string;
  title: string;
  dueAt: string | null;
  assigneeId: string | null;
};

/** MVPでは未実装。将来LINE Messaging APIと連携する送信処理をここに実装する。 */
export async function sendNotification(_payload: NotificationPayload): Promise<void> {
  return;
}
