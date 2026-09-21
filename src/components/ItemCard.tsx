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

/** カード左端に表示する時間情報。終日の場合はallDayのみtrueにし、時刻を持たない */
type ItemTimeInfo = { allDay: boolean; start: string | null; end: string | null };

function timeInfo(item: Item): ItemTimeInfo {
  if (item.is_all_day) return { allDay: true, start: null, end: null };

  const endIso = item.type === "event" ? item.end_at : item.due_at;
  return {
    allDay: false,
    start: item.start_at ? formatDateTimeJst(item.start_at).slice(11) : null,
    end: endIso ? formatDateTimeJst(endIso).slice(11) : null,
  };
}

export function ItemCard({
  item,
  assigneeName,
  groupName,
  overdue: overdueOverride,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: {
  item: Item;
  assigneeName?: string;
  groupName?: string;
  /** 指定すると期限超過バッジの表示・非表示をステータスに関わらず強制する（一覧の分類とバッジ表示を一致させたい場合に使う） */
  overdue?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const overdue = overdueOverride ?? isOverdue(item.due_at, item.status);
  const schedule = scheduleText(item);
  const time = timeInfo(item);

  const className = `block rounded-xl border-y border-r border-gray-200 bg-white p-4 shadow-sm border-l-4 ${ITEM_TYPE_ACCENT[item.type].border} ${
    selectionMode ? (selected ? "bg-blue-50 ring-2 ring-blue-500" : "") : "active:bg-gray-50"
  }`;

  const body = (
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
        {groupName && <span>家族: {groupName}</span>}
      </div>
    </>
  );

  const content = (
    <div className="flex gap-3">
      <div className="flex w-12 shrink-0 flex-col items-center justify-start pt-0.5 text-center">
        {time.allDay ? (
          <span className="text-xs font-bold text-gray-500">終日</span>
        ) : (
          <>
            {time.start && <span className="text-sm font-bold text-gray-700">{time.start}</span>}
            {time.end && <span className="text-xs text-gray-400">〜{time.end}</span>}
          </>
        )}
      </div>
      <div className="min-w-0 flex-1">{body}</div>
    </div>
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
