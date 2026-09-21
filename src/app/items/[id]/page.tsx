"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ItemForm, type ItemFormValues } from "@/components/ItemForm";
import { RequireAuth } from "@/components/RequireAuth";
import { useToast } from "@/components/ToastProvider";
import { fetchGroupMembers, type MemberWithProfile } from "@/lib/families";
import { deleteItem, fetchItem, updateItem } from "@/lib/items";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 担当者候補は「今表示中のグループ」ではなく、必ずこのチケット自身が属するグループのメンバーにする
    // （複数グループを横断表示できるチケット一覧から開いた場合に、無関係な家族が候補に出るのを防ぐ）
    fetchItem(supabase, params.id)
      .then(async (fetchedItem) => {
        setItem(fetchedItem);
        if (fetchedItem) {
          const fetchedMembers = await fetchGroupMembers(supabase, fetchedItem.group_id);
          setMembers(fetchedMembers);
        }
      })
      .catch(() => setError("データの取得に失敗しました。"));
  }, [supabase, params.id]);

  const handleSubmit = useCallback(
    async (values: ItemFormValues) => {
      setSubmitting(true);
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
        router.push("/items");
      } catch {
        showToast("更新に失敗しました。もう一度お試しください。", "error");
      } finally {
        setSubmitting(false);
      }
    },
    [supabase, params.id, showToast, router]
  );

  const handleDelete = useCallback(async () => {
    if (!window.confirm("この項目を削除しますか？この操作は取り消せません。")) return;
    setDeleting(true);
    try {
      await deleteItem(supabase, params.id);
      showToast("削除しました");
      router.push("/items");
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setDeleting(false);
    }
  }, [supabase, params.id, showToast, router]);

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (item === undefined) {
    return <p className="text-gray-400">読み込み中...</p>;
  }

  if (item === null) {
    return <p className="text-sm text-gray-400">項目が見つかりませんでした。既に削除された可能性があります。</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-gray-100">詳細・編集</h1>
      <ItemForm
        members={members}
        initialItem={item}
        submitting={submitting}
        submitLabel="更新する"
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="mt-6 min-h-12 w-full rounded-lg border border-red-300 text-base font-semibold text-red-400 disabled:opacity-50"
      >
        {deleting ? "削除中..." : "削除する"}
      </button>
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
