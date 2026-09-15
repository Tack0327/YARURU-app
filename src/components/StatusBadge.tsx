import type { ItemStatus } from "@/types/database";

const STATUS_LABEL: Record<ItemStatus, string> = {
  not_started: "未対応",
  in_progress: "対応中",
  done: "完了",
};

const STATUS_CLASS: Record<ItemStatus, string> = {
  not_started: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
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
    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
      期限超過
    </span>
  );
}
