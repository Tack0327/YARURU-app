"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMyPrivateNote, fetchSharedNote } from "@/lib/notes";
import { createClient } from "@/lib/supabase/client";
import type { MemberWithProfile } from "@/lib/families";
import type { Note, NoteVisibility } from "@/types/database";

function noteHref(dateKey: string, visibility: NoteVisibility): string {
  return `/notes?${new URLSearchParams({ date: dateKey, visibility }).toString()}`;
}

function NoteRow({
  href,
  label,
  title,
  content,
}: {
  href: string;
  label: string;
  title: string | null | undefined;
  content: string | null | undefined;
}) {
  return (
    <Link href={href} className="block rounded-lg bg-gray-50 p-2 active:bg-gray-100">
      <p className="mb-0.5 text-xs font-semibold text-gray-400">{label}</p>
      <p className="truncate text-sm font-semibold text-gray-900">{title?.trim() ? title : "未タイトル"}</p>
      <p className="truncate text-xs text-gray-500">{content?.trim() ? content : "まだ書かれていません"}</p>
    </Link>
  );
}

/**
 * ホームのカレンダーで選択した日付向けの、メモ・日記の一覧欄。
 * 「家族に共有」はグループ全体で1件、「自分だけ」は本人のみのメモ。タイトルのみを表示し、
 * クリックすると別画面（/notes）で編集・閲覧する。
 */
export function DateNotes({
  groupId,
  userId,
  dateKey,
  members,
  refreshToken,
}: {
  groupId: string;
  userId: string;
  dateKey: string;
  members: MemberWithProfile[];
  /** 値が変わるたびにメモを再取得する（別画面での保存・削除から戻ってきたときに使う） */
  refreshToken?: string;
}) {
  const [supabase] = useState(() => createClient());
  const [sharedNote, setSharedNote] = useState<Note | null | undefined>(undefined);
  const [myPrivateNote, setMyPrivateNote] = useState<Note | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSharedNote(undefined);
    setMyPrivateNote(undefined);
    setError(null);
    Promise.all([fetchSharedNote(supabase, groupId, dateKey), fetchMyPrivateNote(supabase, userId, dateKey)])
      .then(([shared, mine]) => {
        setSharedNote(shared);
        setMyPrivateNote(mine);
      })
      .catch(() => setError("メモの取得に失敗しました。"));
  }, [supabase, groupId, userId, dateKey, refreshToken]);

  function memberNameOf(profileId: string | null) {
    return members.find((m) => m.profile_id === profileId)?.profile.display_name ?? "不明なメンバー";
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border-y border-r border-gray-200 border-l-4 border-l-blue-500 p-3">
      <h3 className="text-sm font-bold text-gray-500">メモ・日記</h3>

      {sharedNote === undefined || myPrivateNote === undefined ? (
        <p className="text-xs text-gray-400">読み込み中...</p>
      ) : (
        <>
          <NoteRow
            href={noteHref(dateKey, "shared")}
            label={sharedNote ? `家族に共有（${memberNameOf(sharedNote.profile_id)}が編集）` : "家族に共有"}
            title={sharedNote?.title}
            content={sharedNote?.content}
          />
          <NoteRow href={noteHref(dateKey, "private")} label="自分だけ" title={myPrivateNote?.title} content={myPrivateNote?.content} />
        </>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
