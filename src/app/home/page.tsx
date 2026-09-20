"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CalendarView } from "@/components/CalendarView";
import { ItemCard } from "@/components/ItemCard";
import { RequireAuth } from "@/components/RequireAuth";
import { fetchAllGroups } from "@/lib/admin";
import { dateKeyJst, isActiveOnDate, isOverdue, upcomingRangeEndKey, type UpcomingRange } from "@/lib/dateUtils";
import { fetchGroupMembers, type MemberWithProfile } from "@/lib/families";
import { fetchItems, sortItemsForHome } from "@/lib/items";
import { createClient } from "@/lib/supabase/client";
import type { FamilyGroup, Item, ItemType } from "@/types/database";

function itemCalendarDateKey(item: Item): string {
  return dateKeyJst(item.due_at) || dateKeyJst(item.start_at);
}

const UPCOMING_RANGE_OPTIONS: { value: UpcomingRange; label: string }[] = [
  { value: "week", label: "1週間以内" },
  { value: "month", label: "1か月以内" },
  { value: "3months", label: "3か月以内" },
  { value: "6months", label: "6か月以内" },
];

function HomeContent() {
  const { group, groups, selectGroup, isSuperAdmin, viewGroupAsAdmin } = useAuth();
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<Item[] | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [allGroupsForAdmin, setAllGroupsForAdmin] = useState<FamilyGroup[] | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchAllGroups(supabase)
      .then(setAllGroupsForAdmin)
      .catch(() => setAllGroupsForAdmin(null));
  }, [isSuperAdmin, supabase]);

  // スーパー管理者は自分の所属に関わらず全ての家族グループから選択できるようにする
  const selectableGroups = useMemo<FamilyGroup[]>(
    () => (isSuperAdmin && allGroupsForAdmin ? allGroupsForAdmin : groups.map((g) => g.group)),
    [isSuperAdmin, allGroupsForAdmin, groups]
  );

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
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [upcomingRange, setUpcomingRange] = useState<UpcomingRange>("month");

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

  const typesByDate = useMemo(() => {
    const map = new Map<string, Set<ItemType>>();
    for (const item of items ?? []) {
      const key = itemCalendarDateKey(item);
      if (!key) continue;
      const types = map.get(key) ?? new Set<ItemType>();
      types.add(item.type);
      map.set(key, types);
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
  const upcomingRangeEnd = upcomingRangeEndKey(upcomingRange, now);
  const upcomingItems = sortItemsForHome(
    items.filter(
      (item) =>
        !isOverdue(item.due_at, item.status, now) &&
        !isActiveOnDate(item.start_at, item.due_at, todayKey) &&
        item.status !== "done" &&
        itemCalendarDateKey(item) <= upcomingRangeEnd
    )
  );
  const selectedDateItems = selectedDateKey ? items.filter((item) => itemCalendarDateKey(item) === selectedDateKey) : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        {selectableGroups.length > 1 && group ? (
          <select
            value={group.group.id}
            onChange={(e) => handleSelectGroup(e.target.value)}
            aria-label="家族グループを切り替える"
            className="max-w-[60%] truncate rounded-lg border border-gray-300 px-2 py-1.5 text-xl font-bold text-gray-900"
          >
            {selectableGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        ) : (
          <h1 className="text-xl font-bold text-gray-900">{group?.group.name}</h1>
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
          typesByDate={typesByDate}
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
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-500">今後の予定</h2>
          <div className="flex flex-wrap gap-1">
            {UPCOMING_RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setUpcomingRange(option.value)}
                className={`min-h-8 rounded-full border px-3 text-xs font-semibold ${
                  upcomingRange === option.value
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-300 text-gray-600"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {upcomingItems.length === 0 ? (
          <p className="text-sm text-gray-400">今後の予定・実施作業はありません</p>
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
