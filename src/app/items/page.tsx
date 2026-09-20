"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BulkActionBar, BULK_UNASSIGN_VALUE } from "@/components/BulkActionBar";
import { FilterBar } from "@/components/FilterBar";
import { ItemCard } from "@/components/ItemCard";
import { RequireAuth } from "@/components/RequireAuth";
import { useToast } from "@/components/ToastProvider";
import { fetchAllGroups } from "@/lib/admin";
import { fetchGroupMembers, type MemberWithProfile } from "@/lib/families";
import { bulkDeleteItems, bulkUpdateItems, fetchItems, type ItemFilters } from "@/lib/items";
import { createClient } from "@/lib/supabase/client";
import type { FamilyGroup, Item, ItemStatus } from "@/types/database";

function ItemsContent() {
  const { groups: myGroups, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<Item[] | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [filters, setFilters] = useState<ItemFilters>({});
  const [error, setError] = useState<string | null>(null);
  const [allGroupsForAdmin, setAllGroupsForAdmin] = useState<FamilyGroup[] | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchAllGroups(supabase)
      .then(setAllGroupsForAdmin)
      .catch(() => setAllGroupsForAdmin(null));
  }, [isSuperAdmin, supabase]);

  // スーパー管理者は自分の所属に関わらず全ての家族グループのチケットを対象にする
  const groups = useMemo<FamilyGroup[]>(
    () => (isSuperAdmin && allGroupsForAdmin ? allGroupsForAdmin : myGroups.map((g) => g.group)),
    [isSuperAdmin, allGroupsForAdmin, myGroups]
  );

  const load = useCallback(async () => {
    if (groups.length === 0) return;
    setError(null);
    const groupIds = filters.groupId ? [filters.groupId] : groups.map((g) => g.id);
    try {
      const [fetchedItems, memberLists] = await Promise.all([
        fetchItems(supabase, groupIds, filters),
        Promise.all(groupIds.map((id) => fetchGroupMembers(supabase, id))),
      ]);
      const memberMap = new Map<string, MemberWithProfile>();
      memberLists.flat().forEach((m) => memberMap.set(m.profile_id, m));
      setItems(fetchedItems);
      setMembers([...memberMap.values()]);
      setSelectedIds(new Set());
    } catch {
      setError("一覧の取得に失敗しました。通信状況をご確認のうえ再度お試しください。");
    }
  }, [supabase, groups, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const memberNameOf = (id: string | null) => members.find((m) => m.profile_id === id)?.profile.display_name;
  const groupNameOf = (groupId: string) => groups.find((g) => g.id === groupId)?.name;

  function handleToggleSelectionMode() {
    setSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
    setBulkAssigneeId("");
    setBulkStatus("");
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleToggleSelectAll() {
    if (!items) return;
    setSelectedIds((prev) => (prev.size === items.length ? new Set() : new Set(items.map((item) => item.id))));
  }

  async function handleBulkApply() {
    if (selectedIds.size === 0 || (!bulkAssigneeId && !bulkStatus)) return;
    setBulkSubmitting(true);
    try {
      await bulkUpdateItems(supabase, [...selectedIds], {
        assigneeId: bulkAssigneeId ? (bulkAssigneeId === BULK_UNASSIGN_VALUE ? null : bulkAssigneeId) : undefined,
        status: bulkStatus ? (bulkStatus as ItemStatus) : undefined,
      });
      showToast(`${selectedIds.size}件をまとめて変更しました`);
      setBulkAssigneeId("");
      setBulkStatus("");
      await load();
    } catch {
      showToast("まとめて変更できませんでした。もう一度お試しください。", "error");
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      await bulkDeleteItems(supabase, [...selectedIds]);
      showToast(`${selectedIds.size}件をまとめて削除しました`);
      await load();
    } catch {
      showToast("まとめて削除できませんでした。もう一度お試しください。", "error");
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">チケット一覧</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleToggleSelectionMode}
            className="flex min-h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-600"
          >
            {selectionMode ? "選択をやめる" : "まとめて変更"}
          </button>
          <Link
            href="/items/new"
            className="flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
          >
            + 新規登録
          </Link>
        </div>
      </div>

      <FilterBar filters={filters} members={members} groups={groups} onChange={setFilters} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!items ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400">該当する項目はありません</p>
      ) : (
        <>
          {selectionMode && (
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="self-start text-xs font-semibold text-blue-600"
            >
              {selectedIds.size === items.length ? "すべて解除" : "すべて選択"}
            </button>
          )}
          <div className={`flex flex-col gap-3 ${selectionMode && selectedIds.size > 0 ? "pb-24" : ""}`}>
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                assigneeName={memberNameOf(item.assignee_id)}
                groupName={groups.length > 1 ? groupNameOf(item.group_id) : undefined}
                selectionMode={selectionMode}
                selected={selectedIds.has(item.id)}
                onToggleSelect={() => handleToggleSelect(item.id)}
              />
            ))}
          </div>
        </>
      )}

      {selectionMode && selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          members={members}
          assigneeId={bulkAssigneeId}
          status={bulkStatus}
          submitting={bulkSubmitting}
          deleting={bulkDeleting}
          onAssigneeChange={setBulkAssigneeId}
          onStatusChange={setBulkStatus}
          onApply={handleBulkApply}
          onDelete={handleBulkDelete}
          onCancel={() => setSelectedIds(new Set())}
        />
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
