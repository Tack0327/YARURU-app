import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Item, ItemStatus, ItemType } from "@/types/database";
import { isHiddenAfterCompletion, isOverdue } from "./dateUtils";

type Client = SupabaseClient<Database>;

export type SortField = "due_at" | "created_at" | "updated_at";
export type SortDirection = "asc" | "desc";

export type ItemFilters = {
  keyword?: string;
  assigneeId?: string;
  type?: ItemType;
  status?: ItemStatus;
  sortBy?: SortField;
  sortDirection?: SortDirection;
};

function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, (match) => `\\${match}`);
}

export async function fetchItems(
  supabase: Client,
  groupId: string,
  filters: ItemFilters = {},
  options: { includeCompletedHistory?: boolean } = {}
): Promise<Item[]> {
  let query = supabase.from("items").select("*").eq("group_id", groupId);

  if (filters.keyword) {
    const keyword = escapeLikePattern(filters.keyword);
    query = query.or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`);
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

    const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
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
  assigneeId?: string | null;
  createdBy: string;
};

export async function createItem(supabase: Client, input: NewItemInput): Promise<Item> {
  const { data, error } = await supabase
    .from("items")
    .insert({
      group_id: input.groupId,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      start_at: input.startAt ?? null,
      due_at: input.dueAt ?? null,
      assignee_id: input.assigneeId ?? null,
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type UpdateItemInput = Partial<{
  title: string;
  description: string | null;
  startAt: string | null;
  dueAt: string | null;
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
