"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ItemForm, type ItemFormValues } from "@/components/ItemForm";
import { LoadError } from "@/components/LoadError";
import { RequireAuth } from "@/components/RequireAuth";
import { useToast } from "@/components/ToastProvider";
import { dateKeyJst } from "@/lib/dateUtils";
import { fetchGroupMembers, type MemberWithProfile } from "@/lib/families";
import { createItem, createRecurringItems } from "@/lib/items";
import { goBackOr } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/client";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function NewItemContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { group, user } = useAuth();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ホームで選んでいた日（?date=YYYY-MM-DD）があればその日、無ければ今日を日付の初期値にする
  const dateParam = searchParams.get("date") ?? "";
  const [initialDateKey] = useState(() =>
    DATE_KEY_PATTERN.test(dateParam) ? dateParam : dateKeyJst(new Date().toISOString())
  );

  const loadMembers = useCallback(async () => {
    if (!group) return;
    setLoadError(null);
    try {
      setMembers(await fetchGroupMembers(supabase, group.group.id));
    } catch {
      setLoadError("メンバー情報の取得に失敗しました。通信状況をご確認のうえ再度お試しください。");
    }
  }, [supabase, group]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleSubmit = useCallback(
    async (values: ItemFormValues) => {
      if (!group || !user) return;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const baseInput = {
          groupId: group.group.id,
          type: values.type,
          title: values.title,
          description: values.description || null,
          startAt: values.startAt,
          dueAt: values.dueAt,
          endAt: values.endAt,
          isAllDay: values.isAllDay,
          assigneeId: values.assigneeId,
          createdBy: user.id,
        };

        if (values.recurrence) {
          await createRecurringItems(
            supabase,
            {
              ...baseInput,
              startDateKey: values.recurrence.startDateKey,
              startTime: values.recurrence.startTime,
              endTime: values.recurrence.endTime,
              untilDateKey: values.recurrence.untilDateKey,
            },
            values.recurrence.freq
          );
        } else {
          await createItem(supabase, baseInput);
        }
        showToast("追加しました");
        goBackOr(router, "/items");
      } catch {
        // トーストはすぐ消えるため、保存ボタンのすぐ上に残しておく
        setSubmitError("追加できませんでした。通信状況をご確認のうえ、もう一度「追加する」を押してください。");
      } finally {
        setSubmitting(false);
      }
    },
    [supabase, group, user, showToast, router]
  );

  if (loadError) {
    return <LoadError message={loadError} onRetry={loadMembers} />;
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-gray-100">予定・作業を追加</h1>
      <ItemForm
        members={members}
        initialDateKey={initialDateKey}
        defaultAssigneeId={user?.id}
        submitting={submitting}
        submitLabel="追加する"
        submitError={submitError}
        onSubmit={handleSubmit}
        onCancel={() => goBackOr(router, "/items")}
      />
    </div>
  );
}

export default function NewItemPage() {
  return (
    <RequireAuth requireGroup showNav>
      <Suspense
        fallback={
          <p role="status" className="text-gray-400">
            読み込み中...
          </p>
        }
      >
        <NewItemContent />
      </Suspense>
    </RequireAuth>
  );
}
