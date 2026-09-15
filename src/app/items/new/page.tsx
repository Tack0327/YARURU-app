"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ItemForm, type ItemFormValues } from "@/components/ItemForm";
import { RequireAuth } from "@/components/RequireAuth";
import { useToast } from "@/components/ToastProvider";
import { fetchGroupMembers, type MemberWithProfile } from "@/lib/families";
import { createItem } from "@/lib/items";
import { createClient } from "@/lib/supabase/client";

function NewItemContent() {
  const router = useRouter();
  const { group, user } = useAuth();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!group) return;
    fetchGroupMembers(supabase, group.group.id)
      .then(setMembers)
      .catch(() => setLoadError("メンバー情報の取得に失敗しました。"));
  }, [supabase, group]);

  const handleSubmit = useCallback(
    async (values: ItemFormValues) => {
      if (!group || !user) return;
      setSubmitting(true);
      try {
        await createItem(supabase, {
          groupId: group.group.id,
          type: values.type,
          title: values.title,
          description: values.description || null,
          startAt: values.startAt,
          dueAt: values.dueAt,
          assigneeId: values.assigneeId,
          createdBy: user.id,
        });
        showToast("登録しました");
        router.replace("/items");
      } catch {
        showToast("登録に失敗しました。もう一度お試しください。", "error");
      } finally {
        setSubmitting(false);
      }
    },
    [supabase, group, user, showToast, router]
  );

  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-gray-900">新規登録</h1>
      <ItemForm
        members={members}
        submitting={submitting}
        submitLabel="登録する"
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </div>
  );
}

export default function NewItemPage() {
  return (
    <RequireAuth requireGroup showNav>
      <NewItemContent />
    </RequireAuth>
  );
}
