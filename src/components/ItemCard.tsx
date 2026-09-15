import Link from "next/link";
import { formatDateTimeJst, isOverdue } from "@/lib/dateUtils";
import { ITEM_TYPE_ACCENT, ITEM_TYPE_LABEL, RECURRENCE_FREQ_LABEL, type Item } from "@/types/database";
import { OverdueBadge, StatusBadge } from "./StatusBadge";

function scheduleText(item: Item): string | null {
  if (item.type === "event") {
    if (!item.start_at) return null;
    const datePart = formatDateTimeJst(item.start_at).slice(0, 10);
    if (item.is_all_day) return `${datePart}（終日）`;
    const startTime = formatDateTimeJst(item.start_at).slice(11);
    const endTime = item.end_at ? formatDateTimeJst(item.end_at).slice(11) : null;
    return endTime ? `${datePart} ${startTime}〜${endTime}` : `${datePart} ${startTime}〜`;
  }

  if (!item.due_at) return null;
  if (item.is_all_day) return `期限: ${formatDateTimeJst(item.due_at).slice(0, 10)}（終日）`;
  return `期限: ${formatDateTimeJst(item.due_at)}`;
}

export function ItemCard({
  item,
  assigneeName,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: {
  item: Item;
  assigneeName?: string;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const overdue = isOverdue(item.due_at, item.status);
  const schedule = scheduleText(item);

  const className = `block rounded-xl border-y border-r border-gray-200 bg-white p-4 shadow-sm border-l-4 ${ITEM_TYPE_ACCENT[item.type].border} ${
    selectionMode ? (selected ? "bg-blue-50 ring-2 ring-blue-500" : "") : "active:bg-gray-50"
  }`;

  const content = (
    <>
      <div className="mb-2 flex items-center gap-2">
        {selectionMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            aria-label={`${item.title}を選択`}
            className="h-4 w-4 shrink-0 rounded border-gray-300"
          />
        )}
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {ITEM_TYPE_LABEL[item.type]}
        </span>
        <StatusBadge status={item.status} />
        {overdue && <OverdueBadge />}
        {item.recurrence_freq && (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            🔁 {RECURRENCE_FREQ_LABEL[item.recurrence_freq]}
          </span>
        )}
      </div>
      <p className="mb-1 text-base font-semibold text-gray-900">{item.title}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
        {schedule && <span>{schedule}</span>}
        {assigneeName && <span>担当: {assigneeName}</span>}
      </div>
    </>
  );

  if (selectionMode) {
    return (
      <div onClick={onToggleSelect} className={`${className} cursor-pointer`}>
        {content}
      </div>
    );
  }

  return (
    <Link href={`/items/${item.id}`} className={className}>
      {content}
    </Link>
  );
}
