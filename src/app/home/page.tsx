"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CalendarView } from "@/components/CalendarView";
import { DateNotes } from "@/components/DateNotes";
import { ItemCard } from "@/components/ItemCard";
import { RequireAuth } from "@/components/RequireAuth";
import { useSelectableGroups } from "@/hooks/useSelectableGroups";
import { dateKeyJst, upcomingRangeEndKey, type UpcomingRange } from "@/lib/dateUtils";
import { fetchGroupMembers, type MemberWithProfile } from "@/lib/families";
import { fetchHolidays } from "@/lib/holidays";
import { fetchItems, sortItemsForHome, sortItemsForSelectedDate } from "@/lib/items";
import { fetchNoteDatesInRange } from "@/lib/notes";
import { createClient } from "@/lib/supabase/client";
import type { Item, ItemType } from "@/types/database";

function itemCalendarDateKey(item: Item): string {
  return dateKeyJst(item.due_at) || dateKeyJst(item.start_at);
}

/** ステータスに関わらず期限日時を過ぎているかどうか（完了非表示チェックがオフのとき、完了済みでも期限超過欄に出せるようステータスは見ない） */
function isPastDue(item: Item, now: Date): boolean {
  return item.due_at !== null && new Date(item.due_at).getTime() < now.getTime();
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
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  // 最初に開いたときから当日を選択した状態にしておく（今日の予定・メモがすぐ見えるようにするため）。
  // メモの編集画面から戻ってきたときは、date クエリパラメータで選択日付を復元する。
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(searchParams.get("date") || todayKey);
  const [upcomingRange, setUpcomingRange] = useState<UpcomingRange>("month");
  const [hideCompleted, setHideCompleted] = useState(false);
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
    if (dateParam) setSelectedDateKey(dateParam);
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
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (!items) {
    return <p className="text-gray-400">読み込み中...</p>;
  }

  const memberNameOf = (id: string | null) => members.find((m) => m.profile_id === id)?.profile.display_name;

  const overdueItems = sortItemsForHome(visibleItems.filter((item) => isPastDue(item, now)));
  const upcomingRangeEnd = upcomingRangeEndKey(upcomingRange, now);
  const upcomingItems = sortItemsForHome(
    visibleItems.filter(
      (item) => !isPastDue(item, now) && itemCalendarDateKey(item) >= todayKey && itemCalendarDateKey(item) <= upcomingRangeEnd
    )
  );
  const selectedDateItems = selectedDateKey
    ? sortItemsForSelectedDate(visibleItems.filter((item) => itemCalendarDateKey(item) === selectedDateKey))
    : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        {selectableGroups.length > 1 && group ? (
          <select
            value={group.group.id}
            onChange={(e) => handleSelectGroup(e.target.value)}
            aria-label="家族グループを切り替える"
            className="max-w-[60%] truncate rounded-lg border border-gray-600 bg-gray-800 px-2 py-1.5 text-xl font-bold text-gray-100"
          >
            {selectableGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        ) : (
          <h1 className="text-xl font-bold text-gray-100">{group?.group.name}</h1>
        )}
        <Link
          href="/items/new"
          className="flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
        >
          + 新規登録
        </Link>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <button onClick={goToPrevMonth} className="min-h-10 min-w-10 rounded-lg border border-gray-600 text-gray-300">
            ＜
          </button>
          <h2 className="text-base font-bold text-gray-100">
            {year}年{month + 1}月
          </h2>
          <button onClick={goToNextMonth} className="min-h-10 min-w-10 rounded-lg border border-gray-600 text-gray-300">
            ＞
          </button>
        </div>
        <CalendarView
          year={year}
          month={month}
          todayKey={todayKey}
          selectedDateKey={selectedDateKey}
          typesByDate={typesByDate}
          noteDates={noteDates}
          holidays={holidays}
          onSelectDate={(dateKey) => setSelectedDateKey((prev) => (prev === dateKey ? null : dateKey))}
        />
      </section>

      <label className="flex items-center gap-2 self-start text-sm text-gray-300">
        <input
          type="checkbox"
          checked={hideCompleted}
          onChange={(e) => setHideCompleted(e.target.checked)}
          className="h-4 w-4 rounded border-gray-600"
        />
        完了を非表示にする
      </label>

      {selectedDateKey && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-400">{selectedDateKey}</h2>
            <button onClick={() => setSelectedDateKey(null)} className="text-xs font-semibold text-blue-400">
              閉じる
            </button>
          </div>
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
            <p className="text-sm text-gray-500">この日の予定・実施作業はありません</p>
          ) : (
            <div className="flex flex-col gap-3">
              {selectedDateItems.map((item) => (
                <ItemCard key={item.id} item={item} assigneeName={memberNameOf(item.assignee_id)} />
              ))}
            </div>
          )}
        </section>
      )}

      <Section
        title="期限超過"
        items={overdueItems}
        emptyText="期限超過の項目はありません"
        memberNameOf={memberNameOf}
        forceOverdue
      />
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-400">今後の予定</h2>
          <div className="flex flex-wrap gap-1">
            {UPCOMING_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setUpcomingRange(option.value)}
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
          <p className="text-sm text-gray-500">今後の予定・実施作業はありません</p>
        ) : (
          <div className="flex flex-col gap-3">
            {upcomingItems.map((item) => (
              <ItemCard key={item.id} item={item} assigneeName={memberNameOf(item.assignee_id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Section({
  title,
  items,
  emptyText,
  memberNameOf,
  forceOverdue = false,
}: {
  title: string;
  items: Item[];
  emptyText: string;
  memberNameOf: (id: string | null) => string | undefined;
  /** trueの場合、そのセクション内の全項目に「期限超過」バッジを表示する（完了済みでも一覧に出す欄で、表示の一貫性を保つため） */
  forceOverdue?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold text-gray-400">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              assigneeName={memberNameOf(item.assignee_id)}
              overdue={forceOverdue ? true : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function HomePage() {
  return (
    <RequireAuth requireGroup showNav>
      <Suspense fallback={<p className="text-gray-400">読み込み中...</p>}>
        <HomeContent />
      </Suspense>
    </RequireAuth>
  );
}
