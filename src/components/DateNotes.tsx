"use client";

import { useEffect, useState } from "react";
import { deleteNote, fetchNotesForDate, upsertMyNote } from "@/lib/notes";
import { createClient } from "@/lib/supabase/client";
import type { MemberWithProfile } from "@/lib/families";
import type { Note, NoteVisibility } from "@/types/database";
import { useToast } from "./ToastProvider";

type EditableNote = { id: string | null; content: string };

const EMPTY_NOTE: EditableNote = { id: null, content: "" };

function NoteSection({
  title,
  value,
  onChange,
  hasExisting,
  saving,
  confirmingDelete,
  onRequestDelete,
  onCancelDelete,
  onSave,
  onDelete,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  hasExisting: boolean;
  saving: boolean;
  confirmingDelete: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
      <p className="text-xs font-semibold text-gray-500">{title}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={`${title}のメモ・日記を書く`}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500"
      />
      {confirmingDelete ? (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs font-semibold text-red-600">削除しますか？</span>
          <button
            type="button"
            onClick={onCancelDelete}
            disabled={saving}
            className="min-h-8 rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-600 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="min-h-8 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "削除中..." : "削除する"}
          </button>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          {hasExisting && (
            <button
              type="button"
              onClick={onRequestDelete}
              className="min-h-8 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-600"
            >
              削除
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="min-h-8 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * ホームのカレンダーで選択した日付向けの、メモ・日記の閲覧・編集欄。
 * 「家族に共有」「自分だけ」は別々のメモとして扱い、1人が同じ日付に両方持てる。
 */
export function DateNotes({
  groupId,
  userId,
  dateKey,
  members,
  onNotesChanged,
}: {
  groupId: string;
  userId: string;
  dateKey: string;
  members: MemberWithProfile[];
  /** 保存・削除でその日のメモの有無が変わりうるタイミングで呼ばれる（カレンダーの印を更新するために使う） */
  onNotesChanged?: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [sharedNote, setSharedNote] = useState<EditableNote>(EMPTY_NOTE);
  const [privateNote, setPrivateNote] = useState<EditableNote>(EMPTY_NOTE);
  const [savingVisibility, setSavingVisibility] = useState<NoteVisibility | null>(null);
  const [confirmingDeleteVisibility, setConfirmingDeleteVisibility] = useState<NoteVisibility | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(null);
    setError(null);
    setConfirmingDeleteVisibility(null);
    fetchNotesForDate(supabase, groupId, dateKey)
      .then((fetched) => {
        setNotes(fetched);
        const mineShared = fetched.find((n) => n.profile_id === userId && n.visibility === "shared");
        const minePrivate = fetched.find((n) => n.profile_id === userId && n.visibility === "private");
        setSharedNote(mineShared ? { id: mineShared.id, content: mineShared.content } : EMPTY_NOTE);
        setPrivateNote(minePrivate ? { id: minePrivate.id, content: minePrivate.content } : EMPTY_NOTE);
      })
      .catch(() => setError("メモの取得に失敗しました。"));
  }, [supabase, groupId, dateKey, userId]);

  const othersSharedNotes = (notes ?? []).filter((n) => n.profile_id !== userId);

  function memberNameOf(profileId: string) {
    return members.find((m) => m.profile_id === profileId)?.profile.display_name ?? "不明なメンバー";
  }

  async function handleSave(visibility: NoteVisibility) {
    const draft = visibility === "shared" ? sharedNote : privateNote;
    if (!draft.content.trim()) {
      setError("メモの内容を入力してください。");
      return;
    }
    setError(null);
    setSavingVisibility(visibility);
    try {
      const saved = await upsertMyNote(supabase, {
        groupId,
        profileId: userId,
        noteDate: dateKey,
        content: draft.content.trim(),
        visibility,
      });
      setNotes((prev) => [...(prev ?? []).filter((n) => n.id !== saved.id), saved]);
      if (visibility === "shared") setSharedNote({ id: saved.id, content: saved.content });
      else setPrivateNote({ id: saved.id, content: saved.content });
      showToast("メモを保存しました");
      onNotesChanged?.();
    } catch {
      showToast("保存に失敗しました。もう一度お試しください。", "error");
    } finally {
      setSavingVisibility(null);
    }
  }

  async function handleDelete(visibility: NoteVisibility) {
    const draft = visibility === "shared" ? sharedNote : privateNote;
    if (!draft.id) return;
    setSavingVisibility(visibility);
    try {
      await deleteNote(supabase, draft.id);
      setNotes((prev) => (prev ?? []).filter((n) => n.id !== draft.id));
      if (visibility === "shared") setSharedNote(EMPTY_NOTE);
      else setPrivateNote(EMPTY_NOTE);
      showToast("メモを削除しました");
      onNotesChanged?.();
    } catch {
      showToast("削除に失敗しました。もう一度お試しください。", "error");
    } finally {
      setSavingVisibility(null);
      setConfirmingDeleteVisibility(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border-y border-r border-gray-200 border-l-4 border-l-blue-500 p-3">
      <h3 className="text-sm font-bold text-gray-500">メモ・日記</h3>

      {notes === null ? (
        <p className="text-xs text-gray-400">読み込み中...</p>
      ) : (
        <>
          {othersSharedNotes.length > 0 && (
            <div className="flex flex-col gap-2">
              {othersSharedNotes.map((note) => (
                <div key={note.id} className="rounded-lg bg-gray-50 p-2 text-sm text-gray-700">
                  <p className="mb-1 text-xs font-semibold text-gray-500">{memberNameOf(note.profile_id)}</p>
                  <p className="whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          )}

          <NoteSection
            title="家族に共有"
            value={sharedNote.content}
            onChange={(value) => setSharedNote((prev) => ({ ...prev, content: value }))}
            hasExisting={!!sharedNote.id}
            saving={savingVisibility === "shared"}
            confirmingDelete={confirmingDeleteVisibility === "shared"}
            onRequestDelete={() => setConfirmingDeleteVisibility("shared")}
            onCancelDelete={() => setConfirmingDeleteVisibility(null)}
            onSave={() => handleSave("shared")}
            onDelete={() => handleDelete("shared")}
          />

          <NoteSection
            title="自分だけ"
            value={privateNote.content}
            onChange={(value) => setPrivateNote((prev) => ({ ...prev, content: value }))}
            hasExisting={!!privateNote.id}
            saving={savingVisibility === "private"}
            confirmingDelete={confirmingDeleteVisibility === "private"}
            onRequestDelete={() => setConfirmingDeleteVisibility("private")}
            onCancelDelete={() => setConfirmingDeleteVisibility(null)}
            onSave={() => handleSave("private")}
            onDelete={() => handleDelete("private")}
          />
        </>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
