import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Item, ItemStatus, ItemType, RecurrenceFreq } from "@/types/database";
import { combineDateAndTimeJst, generateRecurrenceDateKeys, isHiddenAfterCompletion, isOverdue } from "./dateUtils";

type Client = SupabaseClient<Database>;

export type SortField = "due_at" | "created_at" | "updated_at";
export type SortDirection = "asc" | "desc";

export type ItemFilters = {
  keyword?: string;
  /** 特定の家族グループに絞り込む場合に指定する（未指定時はfetchItemsに渡した全グループが対象） */
  groupId?: string;
  assigneeId?: string;
  type?: ItemType;
  status?: ItemStatus;
  sortBy?: SortField;
  sortDirection?: SortDirection;
};

function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, (match) => `\\${match}`);
}

/**
 * .or()フィルタの値として安全に埋め込めるようダブルクォートで囲む。
 * カンマや括弧はPostgREST側で条件の区切り文字として解釈されるため、
 * ダブルクォートで囲むことでその中身を単一の値として扱わせる（内部の"は\"にエスケープする）。
 */
function toOrFilterValue(likePattern: string): string {
  return `"${likePattern.replace(/"/g, '\\"')}"`;
}

export async function fetchItems(
  supabase: Client,
  groupIds: string | string[],
  filters: ItemFilters = {},
  options: { includeCompletedHistory?: boolean } = {}
): Promise<Item[]> {
  let query = supabase.from("items").select("*");
  query = Array.isArray(groupIds) ? query.in("group_id", groupIds) : query.eq("group_id", groupIds);

  if (filters.keyword) {
    const keyword = toOrFilterValue(`%${escapeLikePattern(filters.keyword)}%`);
    query = query.or(`title.ilike.${keyword},description.ilike.${keyword}`);
  }
  if (filters.assigneeId) query = query.eq("assignee_id", filters.assigneeId);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);

  const sortBy = filters.sortBy ?? "due_at";
  const ascending = (filters.sortDirection ?? "asc") === "asc";
  query = query.order(sortBy, { ascending, nullsFirst: false });

  const { data, error } = await query;
  if (error) throw error;

  const items = data ?? [];
  if (options.includeCompletedHistory) return items;

  const now = new Date();
  return items.filter((item) => !isHiddenAfterCompletion(item.status, item.completed_at, now));
}

/** ホーム画面向け: 期限超過を先頭に、その後は期限が近い順に並び替える（純関数・テスト対象） */
export function sortItemsForHome(items: Item[], now: Date = new Date()): Item[] {
  return [...items].sort((a, b) => {
    const aOverdue = isOverdue(a.due_at, a.status, now);
    const bOverdue = isOverdue(b.due_at, b.status, now);
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

    const aTime = a.due_at ?? a.start_at;
    const bTime = b.due_at ?? b.start_at;
    const aDue = aTime ? new Date(aTime).getTime() : Number.POSITIVE_INFINITY;
    const bDue = bTime ? new Date(bTime).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });
}

/** 特定の日付の一覧向け: 終日の項目を先頭に、その後は時刻が近い順に並び替える（純関数・テスト対象） */
export function sortItemsForSelectedDate(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    if (a.is_all_day !== b.is_all_day) return a.is_all_day ? -1 : 1;

    const aTime = a.due_at ?? a.start_at;
    const bTime = b.due_at ?? b.start_at;
    const aMs = aTime ? new Date(aTime).getTime() : Number.POSITIVE_INFINITY;
    const bMs = bTime ? new Date(bTime).getTime() : Number.POSITIVE_INFINITY;
    return aMs - bMs;
  });
}

export async function fetchCompletedHistory(supabase: Client, groupId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("group_id", groupId)
    .eq("status", "done")
    .order("completed_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchItem(supabase: Client, itemId: string): Promise<Item | null> {
  const { data, error } = await supabase.from("items").select("*").eq("id", itemId).maybeSingle();
  if (error) throw error;
  return data;
}

export type NewItemInput = {
  groupId: string;
  type: ItemType;
  title: string;
  description?: string | null;
  startAt?: string | null;
  dueAt?: string | null;
  endAt?: string | null;
  isAllDay?: boolean;
  assigneeId?: string | null;
  createdBy: string;
};

function toItemInsert(input: NewItemInput): Database["public"]["Tables"]["items"]["Insert"] {
  return {
    group_id: input.groupId,
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    start_at: input.startAt ?? null,
    due_at: input.dueAt ?? null,
    end_at: input.endAt ?? null,
    is_all_day: input.isAllDay ?? false,
    assignee_id: input.assigneeId ?? null,
    created_by: input.createdBy,
  };
}

export async function createItem(supabase: Client, input: NewItemInput): Promise<Item> {
  const { data, error } = await supabase.from("items").insert(toItemInsert(input)).select().single();
  if (error) throw error;
  return data;
}

/**
 * 繰り返し予定を、指定した頻度に沿って複数の独立した項目として一括作成する。
 * 各項目は同じrecurrence_group_idを持つが、それ以外は完全に独立しており、
 * 個別に編集・完了・削除できる（シリーズ一括編集には対応しない）。
 */
export async function createRecurringItems(
  supabase: Client,
  input: NewItemInput & { startDateKey: string; startTime: string; endTime: string; untilDateKey?: string | null },
  freq: RecurrenceFreq
): Promise<Item[]> {
  const dateKeys = generateRecurrenceDateKeys(input.startDateKey, freq, input.untilDateKey);
  const recurrenceGroupId = crypto.randomUUID();

  const rows = dateKeys.map((dateKey) => {
    const startAt = input.isAllDay
      ? combineDateAndTimeJst(dateKey, "00:00")
      : combineDateAndTimeJst(dateKey, input.startTime);
    const endAt = input.isAllDay || !input.endTime ? null : combineDateAndTimeJst(dateKey, input.endTime);
    return {
      ...toItemInsert(input),
      start_at: startAt,
      end_at: endAt,
      recurrence_freq: freq,
      recurrence_group_id: recurrenceGroupId,
    };
  });

  const { data, error } = await supabase.from("items").insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

export type UpdateItemInput = Partial<{
  title: string;
  description: string | null;
  startAt: string | null;
  dueAt: string | null;
  endAt: string | null;
  isAllDay: boolean;
  assigneeId: string | null;
  status: ItemStatus;
  type: ItemType;
}>;

export async function updateItem(supabase: Client, itemId: string, input: UpdateItemInput): Promise<Item> {
  const payload: Database["public"]["Tables"]["items"]["Update"] = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.description !== undefined) payload.description = input.description;
  if (input.startAt !== undefined) payload.start_at = input.startAt;
  if (input.dueAt !== undefined) payload.due_at = input.dueAt;
  if (input.endAt !== undefined) payload.end_at = input.endAt;
  if (input.isAllDay !== undefined) payload.is_all_day = input.isAllDay;
  if (input.assigneeId !== undefined) payload.assignee_id = input.assigneeId;
  if (input.status !== undefined) payload.status = input.status;
  if (input.type !== undefined) payload.type = input.type;

  const { data, error } = await supabase.from("items").update(payload).eq("id", itemId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteItem(supabase: Client, itemId: string): Promise<void> {
  const { error } = await supabase.from("items").delete().eq("id", itemId);
  if (error) throw error;
}

/** 一覧で選択した複数項目をまとめて削除する */
export async function bulkDeleteItems(supabase: Client, itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  const { error } = await supabase.from("items").delete().in("id", itemIds);
  if (error) throw error;
}

export type BulkUpdateItemInput = Partial<{
  assigneeId: string | null;
  status: ItemStatus;
}>;

/** 一覧で選択した複数項目の担当者・ステータスをまとめて変更する */
export async function bulkUpdateItems(supabase: Client, itemIds: string[], input: BulkUpdateItemInput): Promise<void> {
  const payload: Database["public"]["Tables"]["items"]["Update"] = {};
  if (input.assigneeId !== undefined) payload.assignee_id = input.assigneeId;
  if (input.status !== undefined) payload.status = input.status;
  if (itemIds.length === 0 || Object.keys(payload).length === 0) return;

  const { error } = await supabase.from("items").update(payload).in("id", itemIds);
  if (error) throw error;
}
