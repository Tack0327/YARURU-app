"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BulkActionBar, BULK_UNASSIGN_VALUE } from "@/components/BulkActionBar";
import { FilterBar } from "@/components/FilterBar";
import { ItemCard } from "@/components/ItemCard";
import { RequireAuth } from "@/components/RequireAuth";
import { useToast } from "@/components/ToastProvider";
import { useSelectableGroups } from "@/hooks/useSelectableGroups";
import { buildItemsCsv, CSV_EXPORT_MAX_ITEMS, CSV_PURPOSE_LABEL, csvFileName, type CsvPurpose } from "@/lib/csvExport";
import { fetchGroupMembersForGroups, type MemberWithProfile } from "@/lib/families";
import {
  bulkDeleteItems,
  bulkUpdateItems,
  fetchItems,
  parseStoredItemFilters,
  planBulkDateChange,
  summarizeBulkChange,
  type ItemFilters,
} from "@/lib/items";
import { createClient } from "@/lib/supabase/client";
import type { Item, ItemStatus } from "@/types/database";

const ITEM_FILTERS_STORAGE_KEY = "yaruru:itemsFilters";

function ItemsContent() {
  const groups = useSelectableGroups();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<Item[] | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  // 詳細画面などへ移動して戻ってきても前回の絞り込み条件のまま表示できるよう、ブラウザに保存した値から始める
  const [filters, setFilters] = useState<ItemFilters>(() =>
    typeof window === "undefined" ? {} : parseStoredItemFilters(window.localStorage.getItem(ITEM_FILTERS_STORAGE_KEY))
  );

  function handleChangeFilters(next: ItemFilters) {
    setFilters(next);
    window.localStorage.setItem(ITEM_FILTERS_STORAGE_KEY, JSON.stringify(next));
  }

  // 保存していた家族グループから脱退した場合などは、その絞り込みを外す（該当なしの一覧になって戸惑わないように）
  useEffect(() => {
    if (!filters.groupId || groups.length === 0 || groups.some((g) => g.id === filters.groupId)) return;
    handleChangeFilters({ ...filters, groupId: undefined });
    // handleChangeFiltersは毎回作り直される関数だが、groupsまたは絞り込みの家族が変わったときだけ確認すればよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, filters.groupId]);
  const [error, setError] = useState<string | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [bulkDueDate, setBulkDueDate] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 複数の家族グループを横断表示している間は、担当者の一括変更を許可しない
  // （別グループのメンバーを担当者に設定できてしまうため。家族を1つに絞り込んだ場合のみ許可する）
  const allowBulkAssigneeChange = groups.length <= 1 || !!filters.groupId;

  useEffect(() => {
    if (!allowBulkAssigneeChange) setBulkAssigneeId("");
  }, [allowBulkAssigneeChange]);

  const load = useCallback(async () => {
    if (groups.length === 0) return;
    setError(null);
    const groupIds = filters.groupId ? [filters.groupId] : groups.map((g) => g.id);
    try {
      const [fetchedItems, memberList] = await Promise.all([
        fetchItems(supabase, groupIds, filters),
        fetchGroupMembersForGroups(supabase, groupIds),
      ]);
      const memberMap = new Map<string, MemberWithProfile>();
      memberList.forEach((m) => memberMap.set(m.profile_id, m));
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

  function resetBulkInputs() {
    setBulkAssigneeId("");
    setBulkStatus("");
    setBulkStartDate("");
    setBulkDueDate("");
  }

  function handleToggleSelectionMode() {
    setSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
    resetBulkInputs();
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
    const hasDateChange = !!bulkStartDate || !!bulkDueDate;
    if (selectedIds.size === 0 || (!bulkAssigneeId && !bulkStatus && !hasDateChange)) return;

    const selectedItems = (items ?? []).filter((item) => selectedIds.has(item.id));
    const datePlan = planBulkDateChange(selectedItems, {
      startDateKey: bulkStartDate || undefined,
      dueDateKey: bulkDueDate || undefined,
    });
    // 一部だけ変更されて中途半端な状態にならないよう、1件でも日付が矛盾する場合は担当者・ステータスも含めて何も変更しない
    if (datePlan.conflictIds.length > 0) {
      showToast(
        `${datePlan.conflictIds.length}件で期限日が開始日より前になるため、変更を中止しました。日付を見直してください。`,
        "error"
      );
      return;
    }
    if (!bulkAssigneeId && !bulkStatus && datePlan.updates.length === 0) {
      showToast("期限日は実施作業にのみ設定できます。実施作業を選択してください。", "error");
      return;
    }

    setBulkSubmitting(true);
    try {
      await bulkUpdateItems(supabase, [...selectedIds], {
        assigneeId: bulkAssigneeId ? (bulkAssigneeId === BULK_UNASSIGN_VALUE ? null : bulkAssigneeId) : undefined,
        status: bulkStatus ? (bulkStatus as ItemStatus) : undefined,
        dateUpdates: datePlan.updates,
      });
      showToast(
        summarizeBulkChange({
          selectedCount: selectedIds.size,
          assigneeChanged: !!bulkAssigneeId,
          statusChanged: !!bulkStatus,
          startDateChanged: !!bulkStartDate,
          dueDateChanged: !!bulkDueDate,
          dateUpdatedCount: datePlan.updates.length,
        })
      );
      resetBulkInputs();
      await load();
    } catch {
      showToast("まとめて変更できませんでした。もう一度お試しください。", "error");
    } finally {
      setBulkSubmitting(false);
    }
  }

  function handleExportDownload(purpose: CsvPurpose) {
    const selectedItems = (items ?? []).filter((item) => selectedIds.has(item.id));
    const csv = buildItemsCsv(selectedItems, memberNameOf, purpose);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFileName(purpose);
    link.click();
    URL.revokeObjectURL(url);
    showToast(`${selectedItems.length}件のCSV（${CSV_PURPOSE_LABEL[purpose]}）をダウンロードしました`);
  }

  async function handleExportEmail(purpose: CsvPurpose): Promise<boolean> {
    if (selectedIds.size > CSV_EXPORT_MAX_ITEMS) {
      showToast(`メールで送れるのは一度に${CSV_EXPORT_MAX_ITEMS}件までです。`, "error");
      return false;
    }
    setExporting(true);
    try {
      const response = await fetch("/api/export-csv/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ダウンロードと同じく画面の一覧の並び順でCSVを作るため、選択した順ではなく一覧の順でIDを送る
        body: JSON.stringify({
          itemIds: (items ?? []).filter((item) => selectedIds.has(item.id)).map((item) => item.id),
          purpose,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { count?: number; error?: string };
      if (!response.ok) {
        showToast(result.error ?? "メールの送信に失敗しました。", "error");
        return false;
      }
      showToast(`${result.count}件のCSV（${CSV_PURPOSE_LABEL[purpose]}）をログイン中のメールアドレスに送信しました`);
      return true;
    } catch {
      showToast("メールの送信に失敗しました。通信状況をご確認ください。", "error");
      return false;
    } finally {
      setExporting(false);
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
        <h1 className="text-xl font-bold text-gray-100">チケット一覧</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleToggleSelectionMode}
            className="flex min-h-10 items-center justify-center rounded-lg border border-gray-600 px-4 text-sm font-semibold text-gray-300"
          >
            {selectionMode ? "選択をやめる" : "チケット選択"}
          </button>
          <Link
            href="/items/new"
            className="flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
          >
            + 新規登録
          </Link>
        </div>
      </div>

      <FilterBar filters={filters} members={members} groups={groups} onChange={handleChangeFilters} />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!items ? (
        <p className="text-gray-400">読み込み中...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">該当する項目はありません</p>
      ) : (
        <>
          {selectionMode && (
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="self-start text-xs font-semibold text-blue-400"
            >
              {selectedIds.size === items.length ? "すべて解除" : "すべて選択"}
            </button>
          )}
          <div className={`flex flex-col gap-3 ${selectionMode && selectedIds.size > 0 ? "pb-64" : ""}`}>
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
          startDateKey={bulkStartDate}
          dueDateKey={bulkDueDate}
          submitting={bulkSubmitting}
          deleting={bulkDeleting}
          exporting={exporting}
          allowAssigneeChange={allowBulkAssigneeChange}
          onAssigneeChange={setBulkAssigneeId}
          onStatusChange={setBulkStatus}
          onStartDateChange={setBulkStartDate}
          onDueDateChange={setBulkDueDate}
          onApply={handleBulkApply}
          onDelete={handleBulkDelete}
          onExportDownload={handleExportDownload}
          onExportEmail={handleExportEmail}
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
