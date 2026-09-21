import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Note } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * 指定した日付に紐づくメモを取得する。RLSにより、自分の「自分だけ」メモと、
 * そのグループの「家族に共有」メモ（グループ全体で1件）だけが返る。
 */
export async function fetchNotesForDate(supabase: Client, groupId: string, noteDate: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("group_id", groupId)
    .eq("note_date", noteDate)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** 自分の「自分だけ」メモ（本人しか見えない）を1件取得する */
export async function fetchMyPrivateNote(supabase: Client, groupId: string, profileId: string, noteDate: string): Promise<Note | null> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("group_id", groupId)
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
    group_id: string;
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

/** 自分の「自分だけ」メモを保存する（無ければ新規作成、あれば上書きする）。タイトル・詳細のどちらか一方だけでもよい。 */
export async function upsertMyPrivateNote(
  supabase: Client,
  input: { groupId: string; profileId: string; noteDate: string; title: string | null; content: string | null }
): Promise<Note> {
  const existing = await fetchMyPrivateNote(supabase, input.groupId, input.profileId, input.noteDate);
  return saveNote(supabase, existing?.id ?? null, {
    group_id: input.groupId,
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
 * RLSにより、自分の「自分だけ」メモと、そのグループの「家族に共有」メモの日付だけが返る。
 */
export async function fetchNoteDatesInRange(
  supabase: Client,
  groupId: string,
  startDateKey: string,
  endDateKey: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("notes")
    .select("note_date")
    .eq("group_id", groupId)
    .gte("note_date", startDateKey)
    .lte("note_date", endDateKey);
  if (error) throw error;
  return new Set((data ?? []).map((n) => n.note_date));
}

export async function deleteNote(supabase: Client, noteId: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) throw error;
}
