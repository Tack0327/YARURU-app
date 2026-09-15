"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { FilterBar } from "@/components/FilterBar";
import { ItemCard } from "@/components/ItemCard";
import { RequireAuth } from "@/components/RequireAuth";
import { fetchGroupMembers, type MemberWithProfile } from "@/lib/families";
import { fetchItems, type ItemFilters } from "@/lib/items";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/types/database";

function ItemsContent() {
  const { group } = useAuth();
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<Item[] | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [filters, setFilters] = useState<ItemFilters>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!group) return;
    setError(null);
    try {
      const [fetchedItems, fetchedMembers] = await Promise.all([
        fetchItems(supabase, group.group.id, filters),
        fetchGroupMembers(supabase, group.group.id),
      ]);
      setItems(fetchedItems);
      setMembers(fetchedMembers);
    } catch {
      setError("一覧の取得に失敗しました。通信状況をご確認のうえ再度お試しください。");
    }
  }, [supabase, group, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const memberNameOf = (id: string | null) => members.find((m) => m.profile_id === id)?.profile.display_name;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">予定・実施作業一覧</h1>
        <Link
          href="/items/new"
          className="flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
        >
          + 新規登録
        </Link>
      </div>

      <FilterBar filters={filters} members={members} onChange={setFilters} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!items ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">該当する項目はありません</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} assigneeName={memberNameOf(item.assignee_id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ItemsPage() {
  return (
    <RequireAuth requireGroup showNav>
      <ItemsContent />
    </RequireAuth>
  );
}
