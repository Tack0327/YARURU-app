import type { ItemStatus } from "@/types/database";

const STATUS_LABEL: Record<ItemStatus, string> = {
  not_started: "未対応",
  in_progress: "対応中",
  done: "完了",
};

const STATUS_CLASS: Record<ItemStatus, string> = {
  // 「未対応」はグレーの塗りにすると「グレーアウト＝完了・無効」という一般的なUIの見た目と衝突し、
  // 完了（緑）と誤認されやすいため、塗りではなく枠線のみのニュートラルな表示にする
  not_started: "border border-gray-400 bg-transparent text-gray-200",
  in_progress: "bg-blue-900 text-blue-300",
  done: "bg-green-900 text-green-300",
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function OverdueBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-red-950 px-2.5 py-1 text-xs font-semibold text-red-300">
      期限超過
    </span>
  );
}
