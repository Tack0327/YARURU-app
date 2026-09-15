"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CalendarView } from "@/components/CalendarView";
import { ItemCard } from "@/components/ItemCard";
import { RequireAuth } from "@/components/RequireAuth";
import { formatDateTimeJst } from "@/lib/dateUtils";
import { fetchGroupMembers, type MemberWithProfile } from "@/lib/families";
import { fetchItems } from "@/lib/items";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/types/database";

function jstDateKey(iso: string | null): string {
  if (!iso) return "";
  return formatDateTimeJst(iso).slice(0, 10);
}

function itemCalendarDateKey(item: Item): string {
  return jstDateKey(item.due_at) || jstDateKey(item.start_at);
}

function CalendarContent() {
  const { group } = useAuth();
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<Item[] | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const todayKey = jstDateKey(now.toISOString());
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

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
      setError("データの取得に失敗しました。");
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

  const itemsOnSelectedDate = (items ?? []).filter((item) => itemCalendarDateKey(item) === selectedDateKey);
  const memberNameOf = (id: string | null) => members.find((m) => m.profile_id === id)?.profile.display_name;

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={goToPrevMonth} className="min-h-10 min-w-10 rounded-lg border border-gray-300 text-gray-600">
          ＜
        </button>
        <h1 className="text-lg font-bold text-gray-900">
          {year}年{month + 1}月
        </h1>
        <button onClick={goToNextMonth} className="min-h-10 min-w-10 rounded-lg border border-gray-300 text-gray-600">
          ＞
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!items ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : (
        <>
          <CalendarView
            year={year}
            month={month}
            todayKey={todayKey}
            selectedDateKey={selectedDateKey}
            countByDate={countByDate}
            onSelectDate={setSelectedDateKey}
          />

          <section className="mt-2">
            <h2 className="mb-3 text-sm font-bold text-gray-500">{selectedDateKey}</h2>
            {itemsOnSelectedDate.length === 0 ? (
              <p className="text-sm text-gray-400">この日の予定・ToDoはありません</p>
            ) : (
              <div className="flex flex-col gap-3">
                {itemsOnSelectedDate.map((item) => (
                  <ItemCard key={item.id} item={item} assigneeName={memberNameOf(item.assignee_id)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <RequireAuth requireGroup showNav>
      <CalendarContent />
    </RequireAuth>
  );
}
