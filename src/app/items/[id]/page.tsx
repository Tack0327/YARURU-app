"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ItemForm, type ItemFormValues } from "@/components/ItemForm";
import { LoadError } from "@/components/LoadError";
import { RequireAuth } from "@/components/RequireAuth";
import { useToast } from "@/components/ToastProvider";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { fetchGroupMembers, type MemberWithProfile } from "@/lib/families";
import { deleteItem, fetchItem, updateItem } from "@/lib/items";
import { goBackOr } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/types/database";

function ItemDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());
  const [item, setItem] = useState<Item | null | undefined>(undefined);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deleteDialog = useConfirmDialog(confirmingDelete, () => setConfirmingDelete(false), deleting);

  const load = useCallback(async () => {
    setError(null);
    setItem(undefined);
    try {
      // 担当者候補は「今表示中のグループ」ではなく、必ずこのチケット自身が属するグループのメンバーにする
      // （複数グループを横断表示できるチケット一覧から開いた場合に、無関係なグループが候補に出るのを防ぐ）
      const fetchedItem = await fetchItem(supabase, params.id);
      if (fetchedItem) {
        const fetchedMembers = await fetchGroupMembers(supabase, fetchedItem.group_id);
        setMembers(fetchedMembers);
      }
      setItem(fetchedItem);
    } catch {
      setError("データの取得に失敗しました。通信状況をご確認のうえ再度お試しください。");
    }
  }, [supabase, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = useCallback(
    async (values: ItemFormValues) => {
      setSubmitting(true);
      setSubmitError(null);
      try {
        const updated = await updateItem(supabase, params.id, {
          type: values.type,
          title: values.title,
          description: values.description || null,
          startAt: values.startAt,
          dueAt: values.dueAt,
          endAt: values.endAt,
          isAllDay: values.isAllDay,
          assigneeId: values.assigneeId,
          status: values.status,
        });
        setItem(updated);
        showToast("更新しました");
        goBackOr(router, "/items");
      } catch {
        // トーストはすぐ消えるため、保存ボタンのすぐ上に残しておく
        setSubmitError("更新できませんでした。通信状況をご確認のうえ、もう一度「更新する」を押してください。");
      } finally {
        setSubmitting(false);
      }
    },
    [supabase, params.id, showToast, router]
  );

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteItem(supabase, params.id);
      showToast("削除しました");
      goBackOr(router, "/items");
    } catch {
      setDeleteError("削除できませんでした。通信状況をご確認のうえ、もう一度お試しください。");
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  }, [supabase, params.id, showToast, router]);

  if (error) {
    return <LoadError message={error} onRetry={load} />;
  }

  if (item === undefined) {
    return (
      <p role="status" className="text-gray-400">
        読み込み中...
      </p>
    );
  }

  if (item === null) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-gray-400">この予定・作業は見つかりませんでした。既に削除された可能性があります。</p>
        <Link href="/items" className="text-sm font-semibold text-blue-400">
          一覧へ戻る
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-gray-100">詳細・編集</h1>
      <ItemForm
        members={members}
        initialItem={item}
        submitting={submitting}
        submitLabel="更新する"
        submitError={submitError}
        onSubmit={handleSubmit}
        onCancel={() => goBackOr(router, "/items")}
      />
      {/* 他の削除操作（メモ・グループなど）と同じく、画面内で確認してから削除する */}
      <div className="mt-6 rounded-lg border border-red-300 p-4">
        {deleteError && (
          <p role="alert" className="mb-3 text-sm font-semibold text-red-300">
            {deleteError}
          </p>
        )}
        {confirmingDelete ? (
          <div {...deleteDialog.dialogProps} className="flex flex-col gap-3">
            <p id={deleteDialog.messageId} className="text-sm font-semibold text-pretty text-red-300">
              「{item.title}」を削除しますか？この操作は取り消せません。
            </p>
            <div className="flex gap-2">
              <button
                {...deleteDialog.cancelProps}
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="min-h-10 flex-1 rounded-lg border border-gray-600 text-sm font-semibold text-gray-300 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="min-h-10 flex-1 rounded-lg bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
              >
                {deleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        ) : (
          <button
            {...deleteDialog.triggerProps}
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="min-h-12 w-full text-base font-semibold text-red-400"
          >
            この予定・作業を削除する
          </button>
        )}
      </div>
    </div>
  );
}

export default function ItemDetailPage() {
  return (
    <RequireAuth requireGroup showNav>
      <ItemDetailContent />
    </RequireAuth>
  );
}
