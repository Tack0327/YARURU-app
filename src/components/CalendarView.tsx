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
};

export function buildCalendarDays(
  year: number,
  month: number,
  todayKey: string,
  typesByDate: Map<string, Set<ItemType>>,
  noteDates: Set<string> = new Set()
): CalendarDay[] {
  const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
  const startWeekday = firstDayOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysInPrevMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const days: CalendarDay[] = [];

  for (let i = 0; i < startWeekday; i += 1) {
    const dayOfMonth = daysInPrevMonth - startWeekday + i + 1;
    days.push({ dateKey: "", dayOfMonth, isCurrentMonth: false, isToday: false, types: [], hasNote: false });
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
    });
  }

  while (days.length % 7 !== 0) {
    const dayOfMonth = days.length - (startWeekday + daysInMonth) + 1;
    days.push({ dateKey: "", dayOfMonth, isCurrentMonth: false, isToday: false, types: [], hasNote: false });
  }

  return days;
}

export function CalendarView({
  year,
  month,
  todayKey,
  selectedDateKey,
  typesByDate,
  noteDates,
  onSelectDate,
}: {
  year: number;
  month: number;
  todayKey: string;
  selectedDateKey: string | null;
  typesByDate: Map<string, Set<ItemType>>;
  /** メモ・日記が書かれている日付（カレンダーに青い印を付けるために使う） */
  noteDates?: Set<string>;
  onSelectDate: (dateKey: string) => void;
}) {
  const days = buildCalendarDays(year, month, todayKey, typesByDate, noteDates);

  return (
    <div>
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-400">
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
                ? "border-transparent text-gray-300"
                : day.dateKey === selectedDateKey
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : day.isToday
                    ? "border-blue-300 text-blue-700"
                    : "border-gray-100 text-gray-700"
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
