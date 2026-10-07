import Link from "next/link";
import { dateKeyJst, formatDateTimeJst, formatShortDateKey, isOverdue } from "@/lib/dateUtils";
import { ITEM_TYPE_ACCENT, ITEM_TYPE_LABEL, RECURRENCE_FREQ_LABEL, type Item } from "@/types/database";
import { OverdueBadge, StatusBadge } from "./StatusBadge";

/** カード下段の日付。時刻は左端の列に出すため、ここでは日付（曜日付き）だけにする */
function scheduleText(item: Item): string | null {
  if (item.type === "event") {
    return item.start_at ? formatShortDateKey(dateKeyJst(item.start_at)) : null;
  }
  return item.due_at ? `期限: ${formatShortDateKey(dateKeyJst(item.due_at))}` : null;
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
  showCompletedAt = false,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: {
  item: Item;
  assigneeName?: string;
  groupName?: string;
  /** 指定すると期限超過バッジの表示・非表示をステータスに関わらず強制する（一覧の分類とバッジ表示を一致させたい場合に使う） */
  overdue?: boolean;
  /** 完了日を表示する（完了履歴の画面で使う） */
  showCompletedAt?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const overdue = overdueOverride ?? isOverdue(item.due_at, item.status, new Date(), item.is_all_day);
  const schedule = scheduleText(item);
  const time = timeInfo(item);
  const completedText =
    showCompletedAt && item.completed_at ? `完了: ${formatShortDateKey(dateKeyJst(item.completed_at))}` : null;

  // 期限超過は、バッジに加えて枠と時刻も赤にして、一覧の中で目に留まるようにする
  const className = `block rounded-xl border-y border-r bg-gray-800 p-4 shadow-sm border-l-4 ${ITEM_TYPE_ACCENT[item.type].border} ${
    overdue ? "border-red-800" : "border-gray-700"
  } ${selectionMode ? (selected ? "bg-blue-950 ring-2 ring-blue-500" : "") : "active:bg-gray-700"}`;

  const body = (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {selectionMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            aria-label={`${item.title}を選択`}
            className="size-4 shrink-0 rounded border-gray-600"
          />
        )}
        <span className="rounded bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-300">
          {ITEM_TYPE_LABEL[item.type]}
        </span>
        <StatusBadge status={item.status} />
        {overdue && <OverdueBadge />}
        {item.recurrence_freq && (
          <span className="rounded bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-400">
            <span aria-hidden="true">🔁 </span>
            {RECURRENCE_FREQ_LABEL[item.recurrence_freq]}
          </span>
        )}
      </div>
      {/* 一覧では2行までにする（全文は詳細画面で見られる）。URLなど空白の無い長い文字列でもはみ出さないよう折り返す */}
      <p
        className={`mb-1 line-clamp-2 break-words text-base font-semibold ${
          item.status === "done" ? "text-gray-300" : "text-gray-100"
        }`}
      >
        {item.title}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
        {schedule && <span className="tabular-nums">{schedule}</span>}
        {completedText && <span className="tabular-nums">{completedText}</span>}
        {assigneeName && <span className="font-semibold text-gray-200">担当: {assigneeName}</span>}
        {groupName && <span>グループ: {groupName}</span>}
      </div>
    </>
  );

  const content = (
    <div className="flex gap-3">
      <div className="flex w-12 shrink-0 flex-col items-center justify-start pt-0.5 text-center tabular-nums">
        {time.allDay ? (
          <span className={`text-xs font-bold ${overdue ? "text-red-400" : "text-gray-400"}`}>終日</span>
        ) : (
          <>
            {time.start && (
              <span className={`text-sm font-bold ${overdue ? "text-red-400" : "text-gray-300"}`}>{time.start}</span>
            )}
            {time.end && <span className={`text-xs ${overdue ? "text-red-400" : "text-gray-400"}`}>〜{time.end}</span>}
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
