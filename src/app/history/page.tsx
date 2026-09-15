"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ItemCard } from "@/components/ItemCard";
import { RequireAuth } from "@/components/RequireAuth";
import { fetchGroupMembers, type MemberWithProfile } from "@/lib/families";
import { fetchCompletedHistory } from "@/lib/items";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/types/database";

function HistoryContent() {
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
        fetchCompletedHistory(supabase, group.group.id),
        fetchGroupMembers(supabase, group.group.id),
      ]);
      setItems(fetchedItems);
      setMembers(fetchedMembers);
    } catch {
      setError("完了履歴の取得に失敗しました。");
    }
  }, [supabase, group]);

  useEffect(() => {
    load();
  }, [load]);

  const memberNameOf = (id: string | null) => members.find((m) => m.profile_id === id)?.profile.display_name;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-gray-900">完了履歴</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!items ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">完了した項目はまだありません</p>
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

export default function HistoryPage() {
  return (
    <RequireAuth requireGroup showNav>
      <HistoryContent />
    </RequireAuth>
  );
}
