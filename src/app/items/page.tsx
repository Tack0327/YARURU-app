"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BulkActionBar, BULK_UNASSIGN_VALUE } from "@/components/BulkActionBar";
import { FilterBar } from "@/components/FilterBar";
import { ItemCard } from "@/components/ItemCard";
import { LoadError } from "@/components/LoadError";
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
import { ITEM_FILTERS_STORAGE_KEY } from "@/lib/userPreferences";
import type { Item, ItemStatus } from "@/types/database";

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

  // 保存していた担当者が今の家族のメンバーにいない場合（メンバーの削除・別の家族への切り替えなど）も絞り込みを外す。
  // 外さないと、選択欄は「担当: すべて」と表示されるのに、実際には存在しない担当者で絞り込まれて一覧が空になる
  useEffect(() => {
    if (!filters.assigneeId || members.length === 0 || members.some((m) => m.profile_id === filters.assigneeId)) return;
    handleChangeFilters({ ...filters, assigneeId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, filters.assigneeId]);
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
  const [bulkError, setBulkError] = useState<string | null>(null);

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
    setBulkError(null);
  }

  const hasFilters = !!(filters.keyword || filters.type || filters.status || filters.assigneeId || filters.groupId);

  function handleClearFilters() {
    handleChangeFilters({ sortBy: filters.sortBy, sortDirection: filters.sortDirection });
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
    // 入力の見直しが必要な理由は、トーストではすぐ消えてしまうため一括操作バーの中に残す
    // 一部だけ変更されて中途半端な状態にならないよう、1件でも日付が矛盾する場合は担当者・ステータスも含めて何も変更しない
    if (datePlan.conflictIds.length > 0) {
      setBulkError(
        `${datePlan.conflictIds.length}件で期限日が開始日より前になるため、変更を中止しました。日付を見直してください。`
      );
      return;
    }
    if (!bulkAssigneeId && !bulkStatus && datePlan.updates.length === 0) {
      setBulkError("期限日は実施作業にのみ設定できます。実施作業を選択してください。");
      return;
    }

    setBulkError(null);
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
      setBulkError("まとめて変更できませんでした。通信状況をご確認のうえ、もう一度お試しください。");
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
      setBulkError("まとめて削除できませんでした。通信状況をご確認のうえ、もう一度お試しください。");
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-100">予定・作業の一覧</h1>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleToggleSelectionMode}
            aria-pressed={selectionMode}
            className="flex min-h-10 items-center justify-center rounded-lg border border-gray-600 px-3 text-sm font-semibold text-gray-300"
          >
            {selectionMode ? "選択をやめる" : "選んで操作"}
          </button>
          <Link
            href="/items/new"
            className="flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
          >
            + 追加
          </Link>
        </div>
      </div>

      <FilterBar filters={filters} members={members} groups={groups} onChange={handleChangeFilters} />

      {error ? (
        <LoadError message={error} onRetry={load} />
      ) : !items ? (
        <p role="status" className="text-gray-400">
          読み込み中...
        </p>
      ) : items.length === 0 ? (
        // 空のときは、次にできること（絞り込みの解除か、最初の1件の追加）を1つだけ示す
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm text-gray-400">
            {hasFilters ? "条件に合う予定・作業はありません" : "まだ予定・作業がありません"}
          </p>
          {hasFilters ? (
            <button type="button" onClick={handleClearFilters} className="min-h-8 text-sm font-semibold text-blue-400">
              絞り込みを解除
            </button>
          ) : (
            <Link href="/items/new" className="text-sm font-semibold text-blue-400">
              + 最初の予定・作業を追加
            </Link>
          )}
        </div>
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
          <ul className={`flex flex-col gap-3 ${selectionMode && selectedIds.size > 0 ? "pb-64" : ""}`}>
            {items.map((item) => (
              <li key={item.id}>
                <ItemCard
                  item={item}
                  assigneeName={memberNameOf(item.assignee_id)}
                  groupName={groups.length > 1 ? groupNameOf(item.group_id) : undefined}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(item.id)}
                  onToggleSelect={() => handleToggleSelect(item.id)}
                />
              </li>
            ))}
          </ul>
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
          error={bulkError}
          allowAssigneeChange={allowBulkAssigneeChange}
          onAssigneeChange={setBulkAssigneeId}
          onStatusChange={setBulkStatus}
          onStartDateChange={setBulkStartDate}
          onDueDateChange={setBulkDueDate}
          onApply={handleBulkApply}
          onDelete={handleBulkDelete}
          onExportDownload={handleExportDownload}
          onExportEmail={handleExportEmail}
          onCancel={() => {
            setSelectedIds(new Set());
            setBulkError(null);
          }}
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
