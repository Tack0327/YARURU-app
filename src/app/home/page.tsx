"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ItemCard } from "@/components/ItemCard";
import { RequireAuth } from "@/components/RequireAuth";
import { formatDateTimeJst, isOverdue } from "@/lib/dateUtils";
import { fetchGroupMembers, type MemberWithProfile } from "@/lib/families";
import { fetchItems, sortItemsForHome } from "@/lib/items";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/types/database";

function jstDateKey(iso: string | null): string {
  if (!iso) return "";
  return formatDateTimeJst(iso).slice(0, 10);
}

function HomeContent() {
  const { group } = useAuth();
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<Item[] | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!items) {
    return <p className="text-gray-500">読み込み中...</p>;
  }

  const now = new Date();
  const todayKey = jstDateKey(now.toISOString());
  const memberNameOf = (id: string | null) => members.find((m) => m.profile_id === id)?.profile.display_name;

  const overdueItems = sortItemsForHome(items.filter((item) => isOverdue(item.due_at, item.status, now)));
  const todayItems = sortItemsForHome(
    items.filter((item) => !isOverdue(item.due_at, item.status, now) && jstDateKey(item.due_at) === todayKey)
  );
  const upcomingItems = sortItemsForHome(
    items.filter(
      (item) =>
        !isOverdue(item.due_at, item.status, now) &&
        jstDateKey(item.due_at) !== todayKey &&
        item.status !== "done"
    )
  );

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

      <Section title="期限超過" items={overdueItems} emptyText="期限超過の項目はありません" memberNameOf={memberNameOf} />
      <Section title="今日" items={todayItems} emptyText="今日の予定・ToDoはありません" memberNameOf={memberNameOf} />
      <Section title="今後の予定" items={upcomingItems} emptyText="今後の予定・ToDoはありません" memberNameOf={memberNameOf} />
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
