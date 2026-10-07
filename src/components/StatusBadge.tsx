import type { ItemStatus } from "@/types/database";

const STATUS_LABEL: Record<ItemStatus, string> = {
  not_started: "未対応",
  in_progress: "対応中",
  done: "完了",
};

// 色は種別（予定=緑・実施作業=黄）と期限超過（赤）に使うため、状況は色ではなく形と記号で見分けられるようにする。
// 「未対応」は枠線のみ、「対応中」は濃い塗りに●、「完了」は控えめな塗りに✓
const STATUS_CLASS: Record<ItemStatus, string> = {
  not_started: "border border-gray-400 bg-transparent text-gray-200",
  in_progress: "bg-gray-200 text-gray-900",
  done: "bg-gray-700 text-gray-300",
};

const STATUS_MARK: Partial<Record<ItemStatus, string>> = {
  in_progress: "●",
  done: "✓",
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  const mark = STATUS_MARK[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[status]}`}
    >
      {mark && <span aria-hidden="true">{mark}</span>}
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
