import type { Item } from "@/types/database";

const NOTIFY_BEFORE_DUE_MS = 24 * 60 * 60 * 1000;

/**
 * 通知が必要かどうかの判定ロジック。
 * 将来LINE Messaging APIで送信する際も、この判定結果に対してsendNotificationを呼ぶだけでよいように
 * 「判定」と「送信」を分離している（MVPでは送信処理は未実装）。
 */
export function shouldNotifyForItem(item: Pick<Item, "status" | "due_at">, now: Date = new Date()): boolean {
  if (item.status === "done" || !item.due_at) return false;
  const dueAtMs = new Date(item.due_at).getTime();
  return dueAtMs - now.getTime() <= NOTIFY_BEFORE_DUE_MS;
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
