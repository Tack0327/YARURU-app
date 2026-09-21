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

/**
 * 自分の「自分だけ」メモを保存する（無ければ新規作成、あれば上書きする）。
 * 家族グループに関わらず本人につき1日1件の共通メモとして扱う。タイトル・詳細のどちらか一方だけでもよい。
 * DB側のON CONFLICTによる本当のUPSERTのため、同時保存による競合で内容が消えることがない。
 */
export async function upsertMyPrivateNote(
  supabase: Client,
  input: { noteDate: string; title: string | null; content: string | null }
): Promise<Note> {
  const { data, error } = await supabase.rpc("upsert_private_note", {
    p_note_date: input.noteDate,
    p_title: input.title,
    p_content: input.content,
  });
  if (error) throw error;
  return data;
}

/**
 * その日付の「家族に共有」メモを保存する（グループ全体で1件。無ければ新規作成、あれば上書きする）。
 * グループの誰でも編集できる。保存すると、profile_idは「最後に編集した人」に更新される。
 * DB側のON CONFLICTによる本当のUPSERTのため、同時保存による競合で内容が消えることがない。
 */
export async function upsertSharedNote(
  supabase: Client,
  input: { groupId: string; noteDate: string; title: string | null; content: string | null }
): Promise<Note> {
  const { data, error } = await supabase.rpc("upsert_shared_note", {
    p_group_id: input.groupId,
    p_note_date: input.noteDate,
    p_title: input.title,
    p_content: input.content,
  });
  if (error) throw error;
  return data;
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
