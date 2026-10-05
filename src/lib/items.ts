import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Item, ItemStatus, ItemType, RecurrenceFreq } from "@/types/database";
import {
  combineDateAndTimeJst,
  generateRecurrenceDateKeys,
  isHiddenAfterCompletion,
  isOverdue,
  timeOfDayJst,
} from "./dateUtils";

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

/** Supabase（PostgREST）が1回のリクエストで返す最大件数の既定値 */
export const FETCH_PAGE_SIZE = 1000;

/**
 * 1回の取得件数の上限（既定1000件）を超えても全件を取得できるよう、範囲を区切って最後まで取得する（テスト対象）。
 * 上限を超えた分はエラーにならず黙って切り捨てられるため、件数が増えたときに一部の予定が表示されなくなるのを防ぐ。
 * fetchPageは毎回新しいクエリを組み立てること（同じクエリを使い回すと範囲指定が上書きされないため）。
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize: number = FETCH_PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function fetchItems(
  supabase: Client,
  groupIds: string | string[],
  filters: ItemFilters = {},
  options: { includeCompletedHistory?: boolean } = {}
): Promise<Item[]> {
  const sortBy = filters.sortBy ?? "due_at";
  const ascending = (filters.sortDirection ?? "asc") === "asc";

  const buildQuery = () => {
    let query = supabase.from("items").select("*");
    query = Array.isArray(groupIds) ? query.in("group_id", groupIds) : query.eq("group_id", groupIds);

    if (filters.keyword) {
      const keyword = toOrFilterValue(`%${escapeLikePattern(filters.keyword)}%`);
      query = query.or(`title.ilike.${keyword},description.ilike.${keyword}`);
    }
    if (filters.assigneeId) query = query.eq("assignee_id", filters.assigneeId);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.status) query = query.eq("status", filters.status);

    // 区切って取得する際に順序が揺れて重複・欠落しないよう、idを2番目の並び順に加えて順序を一意にする
    return query.order(sortBy, { ascending, nullsFirst: false }).order("id", { ascending: true });
  };

  const items = await fetchAllPages((from, to) => buildQuery().range(from, to));
  if (options.includeCompletedHistory) return items;

  const now = new Date();
  return items.filter((item) => !isHiddenAfterCompletion(item.status, item.completed_at, now));
}

/** ホーム画面向け: 期限超過を先頭に、その後は期限が近い順に並び替える（純関数・テスト対象） */
export function sortItemsForHome(items: Item[], now: Date = new Date()): Item[] {
  return [...items].sort((a, b) => {
    const aOverdue = isOverdue(a.due_at, a.status, now, a.is_all_day);
    const bOverdue = isOverdue(b.due_at, b.status, now, b.is_all_day);
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
  return fetchAllPages((from, to) =>
    supabase
      .from("items")
      .select("*")
      .eq("group_id", groupId)
      .eq("status", "done")
      .order("completed_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );
}

/** 指定したIDの項目を取得する（RLSにより、自分が所属するグループの項目だけが返る） */
/**
 * IDの一覧を指定した件数ずつに分ける（純関数・テスト対象）。
 * `.in("id", ids)` はIDをURLに並べるため、数百件を一度に渡すとURLが長すぎてリクエストが失敗することがある。
 */
export function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return chunks;
}

// UUID（36文字）100件でURLが約4KBに収まる件数
const IN_FILTER_CHUNK_SIZE = 100;

export async function fetchItemsByIds(supabase: Client, itemIds: string[]): Promise<Item[]> {
  if (itemIds.length === 0) return [];
  const results = await Promise.all(
    chunkArray(itemIds, IN_FILTER_CHUNK_SIZE).map((ids) => supabase.from("items").select("*").in("id", ids))
  );
  const items: Item[] = [];
  for (const { data, error } of results) {
    if (error) throw error;
    items.push(...(data ?? []));
  }
  // 分割して取得すると全体の並び順が崩れるため、期限が近い順（期限なしは最後）に並べ直す
  return items.sort((a, b) => {
    const aMs = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bMs = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    return aMs - bMs;
  });
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
  // IDをURLではなくリクエスト本文で渡すDB関数を使う（件数が多くてもURLが長くならず、1回の処理で全件を削除できる）
  const { error } = await supabase.rpc("bulk_delete_items", { p_item_ids: itemIds });
  if (error) throw error;
}

export type BulkUpdateItemInput = {
  /** undefinedは「変更しない」、nullは「担当者なしにする」 */
  assigneeId?: string | null;
  status?: ItemStatus;
  /** planBulkDateChangeで求めた日付の変更 */
  dateUpdates?: ItemDateUpdate[];
};

/**
 * 一覧で選択した複数項目の担当者・ステータス・日付をまとめて変更する。
 * 途中で失敗して一部だけ変更された状態にならないよう、DB関数（bulk_update_items）で1回のトランザクションとして行う。
 */
export async function bulkUpdateItems(supabase: Client, itemIds: string[], input: BulkUpdateItemInput): Promise<void> {
  const setAssignee = input.assigneeId !== undefined;
  const dateUpdates = input.dateUpdates ?? [];
  if (itemIds.length === 0 || (!setAssignee && input.status === undefined && dateUpdates.length === 0)) return;

  const { error } = await supabase.rpc("bulk_update_items", {
    p_item_ids: itemIds,
    p_set_assignee: setAssignee,
    p_assignee_id: input.assigneeId ?? null,
    p_status: input.status ?? null,
    p_date_updates: dateUpdates,
  });
  if (error) throw error;
}

/** 一括変更で指定する日付（Asia/Tokyoの「YYYY-MM-DD」。未指定の項目は変更しない） */
export type BulkDateChange = {
  startDateKey?: string;
  dueDateKey?: string;
};

export type ItemDateUpdate = {
  id: string;
  start_at?: string | null;
  end_at?: string | null;
  due_at?: string | null;
};

/**
 * 選択した項目の開始日・期限日を、各項目の時刻を保ったまま指定日付に変更した結果を求める（純関数・テスト対象）。
 * 予定は単一日のイベントのため、開始日を変えると終了時刻も同じ日付へ移し、期限日の指定は反映しない。
 * 実施作業で変更後に期限が開始より前になる項目はconflictIdsに入れ、updatesには含めない。
 */
export function planBulkDateChange(
  items: Item[],
  change: BulkDateChange
): { updates: ItemDateUpdate[]; conflictIds: string[] } {
  const updates: ItemDateUpdate[] = [];
  const conflictIds: string[] = [];

  for (const item of items) {
    const update: ItemDateUpdate = { id: item.id };
    if (change.startDateKey) {
      update.start_at = combineDateAndTimeJst(change.startDateKey, timeOfDayJst(item.start_at));
      if (item.type === "event" && item.end_at) {
        update.end_at = combineDateAndTimeJst(change.startDateKey, timeOfDayJst(item.end_at));
      }
    }
    if (change.dueDateKey && item.type === "todo") {
      update.due_at = combineDateAndTimeJst(change.dueDateKey, timeOfDayJst(item.due_at));
    }
    if (Object.keys(update).length === 1) continue;

    if (item.type === "todo") {
      const startAt = update.start_at !== undefined ? update.start_at : item.start_at;
      const dueAt = update.due_at !== undefined ? update.due_at : item.due_at;
      if (startAt && dueAt && new Date(dueAt).getTime() < new Date(startAt).getTime()) {
        conflictIds.push(item.id);
        continue;
      }
    }
    updates.push(update);
  }

  return { updates, conflictIds };
}

/**
 * 一括変更の完了メッセージを作る（純関数・テスト対象）。
 * 期限日は実施作業にしか無いため、期限日だけを変えた場合は予定が対象外になり、選択件数と実際に変わった件数が異なる。
 */
export function summarizeBulkChange(params: {
  selectedCount: number;
  assigneeChanged: boolean;
  statusChanged: boolean;
  startDateChanged: boolean;
  dueDateChanged: boolean;
  /** planBulkDateChangeのupdatesの件数 */
  dateUpdatedCount: number;
}): string {
  const parts: string[] = [];
  const otherFields = [params.assigneeChanged && "担当者", params.statusChanged && "状況"].filter(Boolean);
  if (otherFields.length > 0) parts.push(`${params.selectedCount}件の${otherFields.join("・")}を変更`);

  const dateFields = [params.startDateChanged && "開始日", params.dueDateChanged && "期限日"].filter(Boolean);
  let note = "";
  if (dateFields.length > 0) {
    parts.push(`${params.dateUpdatedCount}件の${dateFields.join("・")}を変更`);
    const skippedCount = params.selectedCount - params.dateUpdatedCount;
    if (skippedCount > 0) note = `（予定${skippedCount}件は期限日が無いため日付を変更していません）`;
  }
  return `${parts.join("、")}しました${note}`;
}
