"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CalendarView } from "@/components/CalendarView";
import { ItemCard } from "@/components/ItemCard";
import { RequireAuth } from "@/components/RequireAuth";
import { dateKeyJst, isActiveOnDate, isOverdue } from "@/lib/dateUtils";
import { fetchGroupMembers, type MemberWithProfile } from "@/lib/families";
import { fetchItems, sortItemsForHome } from "@/lib/items";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/types/database";

function itemCalendarDateKey(item: Item): string {
  return dateKeyJst(item.due_at) || dateKeyJst(item.start_at);
}

function HomeContent() {
  const { group } = useAuth();
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<Item[] | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const todayKey = dateKeyJst(now.toISOString());
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

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

  const countByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items ?? []) {
      const key = itemCalendarDateKey(item);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [items]);

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
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!items) {
    return <p className="text-gray-500">読み込み中...</p>;
  }

  const memberNameOf = (id: string | null) => members.find((m) => m.profile_id === id)?.profile.display_name;

  const overdueItems = sortItemsForHome(items.filter((item) => isOverdue(item.due_at, item.status, now)));
  const todayItems = sortItemsForHome(
    items.filter(
      (item) => !isOverdue(item.due_at, item.status, now) && isActiveOnDate(item.start_at, item.due_at, todayKey)
    )
  );
  const upcomingItems = sortItemsForHome(
    items.filter(
      (item) =>
        !isOverdue(item.due_at, item.status, now) &&
        !isActiveOnDate(item.start_at, item.due_at, todayKey) &&
        item.status !== "done"
    )
  );
  const selectedDateItems = selectedDateKey ? items.filter((item) => itemCalendarDateKey(item) === selectedDateKey) : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{group?.group.name}</h1>
        <Link
          href="/items/new"
          className="flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
        >
          + 新規登録
        </Link>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <button onClick={goToPrevMonth} className="min-h-10 min-w-10 rounded-lg border border-gray-300 text-gray-600">
            ＜
          </button>
          <h2 className="text-base font-bold text-gray-900">
            {year}年{month + 1}月
          </h2>
          <button onClick={goToNextMonth} className="min-h-10 min-w-10 rounded-lg border border-gray-300 text-gray-600">
            ＞
          </button>
        </div>
        <CalendarView
          year={year}
          month={month}
          todayKey={todayKey}
          selectedDateKey={selectedDateKey}
          countByDate={countByDate}
          onSelectDate={(dateKey) => setSelectedDateKey((prev) => (prev === dateKey ? null : dateKey))}
        />
      </section>

      {selectedDateKey && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-500">{selectedDateKey}</h2>
            <button onClick={() => setSelectedDateKey(null)} className="text-xs font-semibold text-blue-600">
              閉じる
            </button>
          </div>
          {selectedDateItems.length === 0 ? (
            <p className="text-sm text-gray-400">この日の予定・実施作業はありません</p>
          ) : (
            <div className="flex flex-col gap-3">
              {selectedDateItems.map((item) => (
                <ItemCard key={item.id} item={item} assigneeName={memberNameOf(item.assignee_id)} />
              ))}
            </div>
          )}
        </section>
      )}

      <Section title="期限超過" items={overdueItems} emptyText="期限超過の項目はありません" memberNameOf={memberNameOf} />
      <Section
        title="今日の予定"
        items={todayItems}
        emptyText="今日の予定・実施作業はありません"
        memberNameOf={memberNameOf}
      />
      <Section
        title="今後の予定"
        items={upcomingItems}
        emptyText="今後の予定・実施作業はありません"
        memberNameOf={memberNameOf}
      />
    </div>
  );
}

function Section({
  title,
  items,
  emptyText,
  memberNameOf,
}: {
  title: string;
  items: Item[];
  emptyText: string;
  memberNameOf: (id: string | null) => string | undefined;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold text-gray-500">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} assigneeName={memberNameOf(item.assignee_id)} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function HomePage() {
  return (
    <RequireAuth requireGroup showNav>
      <HomeContent />
    </RequireAuth>
  );
}
