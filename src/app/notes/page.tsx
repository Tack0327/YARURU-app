"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RequireAuth } from "@/components/RequireAuth";
import { useToast } from "@/components/ToastProvider";
import { deleteNote, fetchMyPrivateNote, fetchSharedNote, upsertMyPrivateNote, upsertSharedNote } from "@/lib/notes";
import { createClient } from "@/lib/supabase/client";
import type { Note, NoteVisibility } from "@/types/database";

const VISIBILITY_LABEL: Record<NoteVisibility, string> = {
  shared: "家族に共有",
  private: "自分だけ",
};

function NoteEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, group } = useAuth();
  const { showToast } = useToast();
  const [supabase] = useState(() => createClient());

  const dateKey = searchParams.get("date") ?? "";
  const visibility: NoteVisibility = searchParams.get("visibility") === "shared" ? "shared" : "private";

  const [note, setNote] = useState<Note | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !dateKey) return;
    if (visibility === "shared" && !group) return;
    setNote(undefined);
    const fetcher =
      visibility === "shared" ? fetchSharedNote(supabase, group!.group.id, dateKey) : fetchMyPrivateNote(supabase, user.id, dateKey);
    fetcher
      .then((fetched) => {
        setNote(fetched);
        setTitle(fetched?.title ?? "");
        setContent(fetched?.content ?? "");
      })
      .catch(() => setError("メモの取得に失敗しました。"));
  }, [supabase, group, user, dateKey, visibility]);

  function backToHome() {
    router.push(`/home?date=${dateKey}`);
  }

  async function handleSave() {
    if (!user) return;
    if (visibility === "shared" && !group) return;
    if (!title.trim() && !content.trim()) {
      setError("タイトルか詳細のどちらかを入力してください。");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (visibility === "shared") {
        await upsertSharedNote(supabase, {
          groupId: group!.group.id,
          profileId: user.id,
          noteDate: dateKey,
          title: title.trim() || null,
          content: content.trim() || null,
        });
      } else {
        await upsertMyPrivateNote(supabase, {
          profileId: user.id,
          noteDate: dateKey,
          title: title.trim() || null,
          content: content.trim() || null,
        });
      }
      showToast("メモを保存しました");
      backToHome();
    } catch {
      showToast("保存に失敗しました。もう一度お試しください。", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!note) return;
    setSaving(true);
    try {
      await deleteNote(supabase, note.id);
      showToast("メモを削除しました");
      backToHome();
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setSaving(false);
      setConfirmingDelete(false);
    }
  }

  if (!dateKey) {
    return <p className="text-sm text-red-600">日付が指定されていません。</p>;
  }

  if (note === undefined) {
    return <p className="text-gray-500">読み込み中...</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold text-gray-900">
        {dateKey}のメモ・日記（{VISIBILITY_LABEL[visibility]}）
      </h1>
      {visibility === "shared" && (
        <p className="text-xs text-gray-400">家族の誰でも閲覧・編集できます。</p>
      )}

      <div>
        <label htmlFor="note-title" className="mb-1 block text-sm font-medium text-gray-700">
          タイトル
        </label>
        <input
          id="note-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500"
        />
      </div>

      <div className="flex flex-1 flex-col">
        <label htmlFor="note-content" className="mb-1 block text-sm font-medium text-gray-700">
          詳細
        </label>
        <textarea
          id="note-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[60vh] w-full flex-1 rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={backToHome}
          className="min-h-12 flex-1 rounded-lg border border-gray-300 text-base font-semibold text-gray-700"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="min-h-12 flex-1 rounded-lg bg-blue-600 text-base font-semibold text-white disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>

      {note && (
        <div className="rounded-lg border border-red-300 p-4">
          {confirmingDelete ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-red-700">このメモを削除しますか？この操作は取り消せません。</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={saving}
                  className="min-h-10 flex-1 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="min-h-10 flex-1 rounded-lg bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "削除中..." : "削除する"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="min-h-12 w-full text-base font-semibold text-red-600"
            >
              このメモを削除する
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function NotePage() {
  return (
    <RequireAuth requireGroup showNav>
      <Suspense fallback={<p className="text-gray-500">読み込み中...</p>}>
        <NoteEditContent />
      </Suspense>
    </RequireAuth>
  );
}
