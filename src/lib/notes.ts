import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Note } from "@/types/database";

type Client = SupabaseClient<Database>;

/** 自分の「自分だけ」メモ（本人しか見えない、家族グループに関わらず本人につき1日1件）を取得する */
export async function fetchMyPrivateNote(supabase: Client, profileId: string, noteDate: string): Promise<Note | null> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("profile_id", profileId)
    .eq("note_date", noteDate)
    .eq("visibility", "private")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** その日付の「家族に共有」メモ（グループ全体で1件、誰でも閲覧・編集できる）を取得する */
export async function fetchSharedNote(supabase: Client, groupId: string, noteDate: string): Promise<Note | null> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("group_id", groupId)
    .eq("note_date", noteDate)
    .eq("visibility", "shared")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function saveNote(
  supabase: Client,
  existingId: string | null,
  row: {
    group_id: string | null;
    profile_id: string;
    note_date: string;
    title: string | null;
    content: string | null;
    visibility: "shared" | "private";
  }
): Promise<Note> {
  if (existingId) {
    const { data, error } = await supabase
      .from("notes")
      .update({ title: row.title, content: row.content, profile_id: row.profile_id })
      .eq("id", existingId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from("notes").insert(row).select().single();
  if (error) throw error;
  return data;
}

/**
 * 自分の「自分だけ」メモを保存する（無ければ新規作成、あれば上書きする）。
 * 家族グループに関わらず本人につき1日1件の共通メモとして扱う。タイトル・詳細のどちらか一方だけでもよい。
 */
export async function upsertMyPrivateNote(
  supabase: Client,
  input: { profileId: string; noteDate: string; title: string | null; content: string | null }
): Promise<Note> {
  const existing = await fetchMyPrivateNote(supabase, input.profileId, input.noteDate);
  return saveNote(supabase, existing?.id ?? null, {
    group_id: null,
    profile_id: input.profileId,
    note_date: input.noteDate,
    title: input.title,
    content: input.content,
    visibility: "private",
  });
}

/**
 * その日付の「家族に共有」メモを保存する（グループ全体で1件。無ければ新規作成、あれば上書きする）。
 * グループの誰でも編集できる。保存すると、profile_idは「最後に編集した人」に更新される。
 */
export async function upsertSharedNote(
  supabase: Client,
  input: { groupId: string; profileId: string; noteDate: string; title: string | null; content: string | null }
): Promise<Note> {
  const existing = await fetchSharedNote(supabase, input.groupId, input.noteDate);
  return saveNote(supabase, existing?.id ?? null, {
    group_id: input.groupId,
    profile_id: input.profileId,
    note_date: input.noteDate,
    title: input.title,
    content: input.content,
    visibility: "shared",
  });
}

/**
 * 指定した期間内で、メモが書かれている日付の一覧を取得する（カレンダーに印を付けるために使う）。
 * そのグループの「家族に共有」メモと、自分の「自分だけ」メモ（グループに関わらず）の日付を返す。
 */
export async function fetchNoteDatesInRange(
  supabase: Client,
  groupId: string,
  profileId: string,
  startDateKey: string,
  endDateKey: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("notes")
    .select("note_date")
    .gte("note_date", startDateKey)
    .lte("note_date", endDateKey)
    .or(`and(visibility.eq.shared,group_id.eq.${groupId}),and(visibility.eq.private,profile_id.eq.${profileId})`);
  if (error) throw error;
  return new Set((data ?? []).map((n) => n.note_date));
}

export async function deleteNote(supabase: Client, noteId: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) throw error;
}
