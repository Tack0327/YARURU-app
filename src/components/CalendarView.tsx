"use client";

import { ITEM_TYPE_ACCENT, type ItemType } from "@/types/database";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const ALL_ITEM_TYPES: ItemType[] = ["event", "todo"];

export type CalendarDay = {
  dateKey: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  types: ItemType[];
  hasNote: boolean;
  /** 0=日曜 ... 6=土曜 */
  dayOfWeek: number;
  holidayName: string | null;
};

export function buildCalendarDays(
  year: number,
  month: number,
  todayKey: string,
  typesByDate: Map<string, Set<ItemType>>,
  noteDates: Set<string> = new Set(),
  holidays: Map<string, string> = new Map()
): CalendarDay[] {
  const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
  const startWeekday = firstDayOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysInPrevMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const days: CalendarDay[] = [];

  for (let i = 0; i < startWeekday; i += 1) {
    const dayOfMonth = daysInPrevMonth - startWeekday + i + 1;
    days.push({
      dateKey: "",
      dayOfMonth,
      isCurrentMonth: false,
      isToday: false,
      types: [],
      hasNote: false,
      dayOfWeek: i,
      holidayName: null,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const types = typesByDate.get(dateKey);
    days.push({
      dateKey,
      dayOfMonth: day,
      isCurrentMonth: true,
      isToday: dateKey === todayKey,
      types: types ? ALL_ITEM_TYPES.filter((type) => types.has(type)) : [],
      hasNote: noteDates.has(dateKey),
      dayOfWeek: new Date(Date.UTC(year, month, day)).getUTCDay(),
      holidayName: holidays.get(dateKey) ?? null,
    });
  }

  while (days.length % 7 !== 0) {
    const dayOfMonth = days.length - (startWeekday + daysInMonth) + 1;
    days.push({
      dateKey: "",
      dayOfMonth,
      isCurrentMonth: false,
      isToday: false,
      types: [],
      hasNote: false,
      dayOfWeek: days.length % 7,
      holidayName: null,
    });
  }

  return days;
}

/** 平日は既定色、土曜は薄い青、日曜・祝日は薄い赤で表示する */
function dayTextColor(day: CalendarDay): string {
  if (day.holidayName || day.dayOfWeek === 0) return "text-red-400";
  if (day.dayOfWeek === 6) return "text-blue-400";
  return "text-gray-300";
}

export function CalendarView({
  year,
  month,
  todayKey,
  selectedDateKey,
  typesByDate,
  noteDates,
  holidays,
  onSelectDate,
}: {
  year: number;
  month: number;
  todayKey: string;
  selectedDateKey: string | null;
  typesByDate: Map<string, Set<ItemType>>;
  /** メモ・日記が書かれている日付（カレンダーに青い印を付けるために使う） */
  noteDates?: Set<string>;
  /** 日付キー→祝日名。土日・祝日をカレンダー上で別色にするために使う */
  holidays?: Map<string, string>;
  onSelectDate: (dateKey: string) => void;
}) {
  const days = buildCalendarDays(year, month, todayKey, typesByDate, noteDates, holidays);

  return (
    <div>
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-500">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <button
            key={`${day.dateKey || "pad"}-${index}`}
            type="button"
            disabled={!day.isCurrentMonth}
            onClick={() => day.isCurrentMonth && onSelectDate(day.dateKey)}
            className={`flex min-h-14 flex-col items-center justify-center rounded-lg border text-sm ${
              !day.isCurrentMonth
                ? "border-transparent text-gray-600"
                : day.dateKey === selectedDateKey
                  ? "border-blue-600 bg-blue-950 text-blue-300"
                  : day.isToday
                    ? "border-blue-300 text-blue-300"
                    : `border-gray-700 ${dayTextColor(day)}`
            }`}
          >
            <span>{day.dayOfMonth}</span>
            {(day.types.length > 0 || day.hasNote) && (
              <span className="mt-0.5 flex gap-0.5">
                {day.types.map((type) => (
                  <span key={type} className={`h-1.5 w-1.5 rounded-full ${ITEM_TYPE_ACCENT[type].dot}`} />
                ))}
                {day.hasNote && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
