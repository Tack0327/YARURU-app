import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Note, NoteVisibility } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * 指定した日付に紐づくメモを取得する。RLSにより、自分のメモは公開範囲に関わらず、
 * 他人のメモは公開範囲が「共有」のものだけが返る。
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

/**
 * 自分がその日付・公開範囲で書いたメモを保存する（無ければ新規作成、あれば内容を上書きする）。
 * 公開範囲（家族に共有／自分だけ）ごとに別々のメモとして管理するため、同じ日付でも最大2件持てる。
 */
export async function upsertMyNote(
  supabase: Client,
  input: { groupId: string; profileId: string; noteDate: string; content: string; visibility: NoteVisibility }
): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .upsert(
      {
        group_id: input.groupId,
        profile_id: input.profileId,
        note_date: input.noteDate,
        content: input.content,
        visibility: input.visibility,
      },
      { onConflict: "group_id,profile_id,note_date,visibility" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * 指定した期間内で、メモが書かれている日付の一覧を取得する（カレンダーに印を付けるために使う）。
 * RLSにより、自分のメモと公開範囲が「共有」のメモの日付だけが返る。
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
