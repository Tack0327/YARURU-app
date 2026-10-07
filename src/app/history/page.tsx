"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ItemCard } from "@/components/ItemCard";
import { LoadError } from "@/components/LoadError";
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
      setError("完了履歴の取得に失敗しました。通信状況をご確認のうえ再度お試しください。");
    }
  }, [supabase, group]);

  useEffect(() => {
    load();
  }, [load]);

  const memberNameOf = (id: string | null) => members.find((m) => m.profile_id === id)?.profile.display_name;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-gray-100">完了履歴</h1>
        <p className="mt-1 text-sm text-pretty text-gray-400">
          完了から14日たつと、ホームと一覧には表示されなくなります。ここでは完了したものをすべて確認できます。
        </p>
      </div>
      {error ? (
        <LoadError message={error} onRetry={load} />
      ) : !items ? (
        <p role="status" className="text-gray-400">
          読み込み中...
        </p>
      ) : items.length === 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm text-gray-400">完了した予定・作業はまだありません</p>
          <Link href="/items" className="text-sm font-semibold text-blue-400">
            一覧を見る
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} assigneeName={memberNameOf(item.assignee_id)} showCompletedAt />
            </li>
          ))}
        </ul>
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
