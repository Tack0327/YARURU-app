"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CalendarView, MonthGridView } from "@/components/CalendarView";
import { DateNotes } from "@/components/DateNotes";
import { ItemCard } from "@/components/ItemCard";
import { LoadError } from "@/components/LoadError";
import { RequireAuth } from "@/components/RequireAuth";
import { useSelectableGroups } from "@/hooks/useSelectableGroups";
import {
  dateKeyJst,
  dueDeadlineMs,
  formatLongDateKey,
  isOverdue,
  upcomingRangeEndKey,
  type UpcomingRange,
} from "@/lib/dateUtils";
import { fetchGroupMembers, type MemberWithProfile } from "@/lib/families";
import { fetchHolidays } from "@/lib/holidays";
import { fetchItems, sortItemsForHome, sortItemsForSelectedDate } from "@/lib/items";
import { fetchNoteDatesInRange } from "@/lib/notes";
import { createClient } from "@/lib/supabase/client";
import { HIDE_COMPLETED_STORAGE_KEY } from "@/lib/userPreferences";
import type { Item, ItemType } from "@/types/database";

function itemCalendarDateKey(item: Item): string {
  return dateKeyJst(item.due_at) || dateKeyJst(item.start_at);
}

/** ステータスに関わらず期限日時を過ぎているかどうか（期限切れの完了済み項目を「今後の予定」にも出さないため、ステータスは見ない） */
function isPastDue(item: Item, now: Date): boolean {
  return item.due_at !== null && dueDeadlineMs(item.due_at, item.is_all_day) <= now.getTime();
}

const UPCOMING_RANGE_OPTIONS: { value: UpcomingRange; label: string }[] = [
  { value: "week", label: "1週間以内" },
  { value: "month", label: "1か月以内" },
  { value: "3months", label: "3か月以内" },
  { value: "6months", label: "6か月以内" },
];

function HomeContent() {
  const { user, group, groups, selectGroup, viewGroupAsAdmin } = useAuth();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<Item[] | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const selectableGroups = useSelectableGroups();

  function handleSelectGroup(groupId: string) {
    const isOwnGroup = groups.some((g) => g.group.id === groupId);
    if (isOwnGroup) {
      selectGroup(groupId);
      return;
    }
    const targetGroup = selectableGroups.find((g) => g.id === groupId);
    if (targetGroup) viewGroupAsAdmin(targetGroup);
  }

  const now = new Date();
  const todayKey = dateKeyJst(now.toISOString());
  const initialDateParam = searchParams.get("date");
  const [year, setYear] = useState(initialDateParam ? Number(initialDateParam.slice(0, 4)) : now.getFullYear());
  const [month, setMonth] = useState(initialDateParam ? Number(initialDateParam.slice(5, 7)) - 1 : now.getMonth());
  // 最初に開いたときから当日を選択した状態にしておく（今日の予定・メモがすぐ見えるようにするため）。
  // メモの編集画面から戻ってきたときは、date クエリパラメータで選択日付を復元する。
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(initialDateParam || todayKey);
  // 「閉じる」を押しても選択日付そのものは覚えておき、「開く」で同じ日付をすぐ再表示できるようにする
  const [dateSectionOpen, setDateSectionOpen] = useState(true);
  // 開いてすぐ今月の日付が見えるよう日表示（days）から始める。月の見出しを押すと月選択（months）に切り替わる
  const [calendarMode, setCalendarMode] = useState<"months" | "days">("days");
  const [upcomingRange, setUpcomingRange] = useState<UpcomingRange>("month");
  // 「完了を非表示にする」の状態は、他の画面へ移動して戻ってきても保つためにブラウザに保存する（ログアウト時に消える）
  const [hideCompleted, setHideCompleted] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(HIDE_COMPLETED_STORAGE_KEY) === "true"
  );

  function handleToggleHideCompleted(checked: boolean) {
    setHideCompleted(checked);
    window.localStorage.setItem(HIDE_COMPLETED_STORAGE_KEY, String(checked));
  }
  const [noteDates, setNoteDates] = useState<Set<string>>(new Set());
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    // 祝日は内閣府の公式データを日次で再取得しているだけなので、取得に失敗してもカレンダー自体は表示を続ける
    fetchHolidays()
      .then(setHolidays)
      .catch(() => {});
  }, []);

  // メモの編集画面は保存・削除後に /home?date=...&t=... へ遷移してくる。
  // tは毎回変わる値のため、同じ日付に戻ってきた場合でも下のuseEffectを再実行させ、
  // メモ欄・カレンダーの印を必ず最新化できる（tが無いと、日付が同じ場合は再取得が起きない）。
  const refreshToken = searchParams.get("t") ?? "";

  useEffect(() => {
    const dateParam = searchParams.get("date");
    if (dateParam) {
      setSelectedDateKey(dateParam);
      setDateSectionOpen(true);
      setCalendarMode("days");
      setYear(Number(dateParam.slice(0, 4)));
      setMonth(Number(dateParam.slice(5, 7)) - 1);
    }
    // refreshTokenは、同じ日付に戻ってきたときでもこの効果を再実行させるための依存値
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const loadNoteDates = useCallback(async () => {
    if (!group || !user) return;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const startKey = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    try {
      const dates = await fetchNoteDatesInRange(supabase, group.group.id, user.id, startKey, endKey);
      setNoteDates(dates);
    } catch {
      setNoteDates(new Set());
    }
  }, [supabase, group, user, year, month]);

  useEffect(() => {
    loadNoteDates();
    // refreshTokenは、メモの編集画面から戻ってきたときにこの効果を再実行させるための依存値
  }, [loadNoteDates, refreshToken]);

  const load = useCallback(async () => {
    if (!group) return;
    setError(null);
    try {
      const [fetchedItems, fetchedMembers] = await Promise.all([
        fetchItems(supabase, group.group.id),
        fetchGroupMembers(supabase, group.group.id),
      ]);
      setItems(fetchedItems);
      setMembers(fetchedMembers);
    } catch {
      setError("データの取得に失敗しました。通信状況をご確認のうえ再度お試しください。");
    }
  }, [supabase, group]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleItems = useMemo(() => {
    const all = items ?? [];
    return hideCompleted ? all.filter((item) => item.status !== "done") : all;
  }, [items, hideCompleted]);

  const typesByDate = useMemo(() => {
    const map = new Map<string, Set<ItemType>>();
    for (const item of visibleItems) {
      const key = itemCalendarDateKey(item);
      if (!key) continue;
      const types = map.get(key) ?? new Set<ItemType>();
      types.add(item.type);
      map.set(key, types);
    }
    return map;
  }, [visibleItems]);

  const typesByYearMonth = useMemo(() => {
    const map = new Map<string, Set<ItemType>>();
    for (const item of visibleItems) {
      const key = itemCalendarDateKey(item);
      if (!key) continue;
      const yearMonthKey = key.slice(0, 7);
      const types = map.get(yearMonthKey) ?? new Set<ItemType>();
      types.add(item.type);
      map.set(yearMonthKey, types);
    }
    return map;
  }, [visibleItems]);

  function goToPrevYear() {
    setYear((y) => y - 1);
  }

  function goToNextYear() {
    setYear((y) => y + 1);
  }

  function goToPrevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  if (error) {
    return <LoadError message={error} onRetry={load} />;
  }

  if (!items) {
    return (
      <p role="status" className="text-gray-400">
        読み込み中...
      </p>
    );
  }

  const memberNameOf = (id: string | null) => members.find((m) => m.profile_id === id)?.profile.display_name;

  const overdueItems = sortItemsForHome(
    visibleItems.filter((item) => isOverdue(item.due_at, item.status, now, item.is_all_day))
  );
  const upcomingRangeEnd = upcomingRangeEndKey(upcomingRange, now);
  const upcomingItems = sortItemsForHome(
    visibleItems.filter(
      (item) => !isPastDue(item, now) && itemCalendarDateKey(item) >= todayKey && itemCalendarDateKey(item) <= upcomingRangeEnd
    )
  );
  const selectedDateItems = selectedDateKey
    ? sortItemsForSelectedDate(visibleItems.filter((item) => itemCalendarDateKey(item) === selectedDateKey))
    : [];
  // 日付を選んでいるときは、その日を初期値にした登録画面を開く
  const newItemHref =
    selectedDateKey && dateSectionOpen ? `/items/new?date=${encodeURIComponent(selectedDateKey)}` : "/items/new";

  return (
    <div className="flex flex-col gap-8">
      {/* グループの切り替え欄を出すときも、見出しで移動する人のためにページの見出しを置いておく */}
      {selectableGroups.length > 1 && <h1 className="sr-only">ホーム（{group?.group.name}）</h1>}
      <div className="flex items-center justify-between gap-3">
        {selectableGroups.length > 1 && group ? (
          <select
            value={group.group.id}
            onChange={(e) => handleSelectGroup(e.target.value)}
            aria-label="グループを切り替える"
            className="max-w-[60%] appearance-none truncate rounded-lg border border-gray-600 bg-gray-800 px-2 py-1.5 text-xl font-bold text-gray-100"
          >
            {selectableGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        ) : (
          <h1 className="min-w-0 truncate text-xl font-bold text-gray-100">{group?.group.name}</h1>
        )}
        <Link
          href={newItemHref}
          className="flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
        >
          + 追加
        </Link>
      </div>

      {/* 一番急ぐものなので、1件以上あるときだけ最初に出す */}
      {overdueItems.length > 0 && (
        <section aria-labelledby="overdue-heading">
          <h2 id="overdue-heading" className="mb-3 text-sm font-bold text-red-400">
            期限超過（{overdueItems.length}件）
          </h2>
          <ItemCardList items={overdueItems} memberNameOf={memberNameOf} />
        </section>
      )}

      <section aria-label="カレンダー">
        {calendarMode === "months" ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={goToPrevYear}
                aria-label="前の年"
                className="min-h-10 min-w-10 rounded-lg border border-gray-600 text-gray-300"
              >
                <span aria-hidden="true">＜</span>
              </button>
              <h2 className="text-base font-bold text-gray-100">{year}年</h2>
              <button
                type="button"
                onClick={goToNextYear}
                aria-label="次の年"
                className="min-h-10 min-w-10 rounded-lg border border-gray-600 text-gray-300"
              >
                <span aria-hidden="true">＞</span>
              </button>
            </div>
            <MonthGridView
              year={year}
              todayYear={now.getFullYear()}
              todayMonth={now.getMonth()}
              selectedMonth={null}
              typesByYearMonth={typesByYearMonth}
              onSelectMonth={(selectedMonth) => {
                setMonth(selectedMonth);
                setCalendarMode("days");
              }}
            />
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={goToPrevMonth}
                aria-label="前の月"
                className="min-h-10 min-w-10 rounded-lg border border-gray-600 text-gray-300"
              >
                <span aria-hidden="true">＜</span>
              </button>
              <button
                type="button"
                onClick={() => setCalendarMode("months")}
                aria-label={`${year}年${month + 1}月（押すと月を選べます）`}
                className="flex min-h-10 items-center gap-1 rounded-lg border border-gray-600 px-3 text-base font-bold text-gray-100 tabular-nums"
              >
                {year}年{month + 1}月
                <span aria-hidden className="text-xs text-gray-400">▾</span>
              </button>
              <button
                type="button"
                onClick={goToNextMonth}
                aria-label="次の月"
                className="min-h-10 min-w-10 rounded-lg border border-gray-600 text-gray-300"
              >
                <span aria-hidden="true">＞</span>
              </button>
            </div>
            <CalendarView
              year={year}
              month={month}
              todayKey={todayKey}
              selectedDateKey={dateSectionOpen ? selectedDateKey : null}
              typesByDate={typesByDate}
              noteDates={noteDates}
              holidays={holidays}
              onSelectDate={(dateKey) => {
                if (selectedDateKey === dateKey && dateSectionOpen) {
                  setDateSectionOpen(false);
                } else {
                  setSelectedDateKey(dateKey);
                  setDateSectionOpen(true);
                }
              }}
            />
          </>
        )}
      </section>

      <label className="flex items-center gap-2 self-start text-sm text-gray-300">
        <input
          type="checkbox"
          checked={hideCompleted}
          onChange={(e) => handleToggleHideCompleted(e.target.checked)}
          className="size-4 rounded border-gray-600"
        />
        完了を非表示にする
      </label>

      {selectedDateKey && (
        <section aria-labelledby="selected-date-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="selected-date-heading" className="text-sm font-bold text-gray-400">
              {formatLongDateKey(selectedDateKey)}
            </h2>
            <button
              type="button"
              onClick={() => setDateSectionOpen((prev) => !prev)}
              aria-expanded={dateSectionOpen}
              aria-controls="selected-date-panel"
              className="min-h-8 px-1 text-xs font-semibold text-blue-400"
            >
              {dateSectionOpen ? "閉じる" : "開く"}
            </button>
          </div>
          {dateSectionOpen && (
            <div id="selected-date-panel">
              {holidays.get(selectedDateKey) && (
                <p className="mb-3 text-sm font-semibold text-red-400">{holidays.get(selectedDateKey)}</p>
              )}
              {group && user && (
                <div className="mb-3">
                  <DateNotes
                    groupId={group.group.id}
                    userId={user.id}
                    dateKey={selectedDateKey}
                    members={members}
                    refreshToken={refreshToken}
                  />
                </div>
              )}
              {selectedDateItems.length === 0 ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-sm text-gray-400">この日の予定・作業はありません</p>
                  <Link href={newItemHref} className="text-sm font-semibold text-blue-400">
                    + この日に追加
                  </Link>
                </div>
              ) : (
                <ItemCardList items={selectedDateItems} memberNameOf={memberNameOf} />
              )}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="upcoming-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="upcoming-heading" className="text-sm font-bold text-gray-400">
            今後の予定・作業
          </h2>
          <div role="group" aria-label="表示する期間" className="flex flex-wrap gap-1">
            {UPCOMING_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setUpcomingRange(option.value)}
                aria-pressed={upcomingRange === option.value}
                className={`min-h-8 rounded-full border px-3 text-xs font-semibold ${
                  upcomingRange === option.value
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-600 text-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {upcomingItems.length === 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm text-gray-400">この期間の予定・作業はありません</p>
            <Link href="/items/new" className="text-sm font-semibold text-blue-400">
              + 追加
            </Link>
          </div>
        ) : (
          <ItemCardList items={upcomingItems} memberNameOf={memberNameOf} />
        )}
      </section>
    </div>
  );
}

function ItemCardList({
  items,
  memberNameOf,
}: {
  items: Item[];
  memberNameOf: (id: string | null) => string | undefined;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <ItemCard item={item} assigneeName={memberNameOf(item.assignee_id)} />
        </li>
      ))}
    </ul>
  );
}

export default function HomePage() {
  return (
    <RequireAuth requireGroup showNav>
      <Suspense
        fallback={
          <p role="status" className="text-gray-400">
            読み込み中...
          </p>
        }
      >
        <HomeContent />
      </Suspense>
    </RequireAuth>
  );
}
