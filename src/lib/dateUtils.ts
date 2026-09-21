const JST_TIME_ZONE = "Asia/Tokyo";
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/** ISO文字列(UTC)をAsia/Tokyoの「YYYY-MM-DD HH:mm」表示に変換する */
export function formatDateTimeJst(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/** <input type="datetime-local"> にAsia/Tokyo基準の値を表示するための変換 */
export function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** <input type="datetime-local"> の値（Asia/Tokyo基準のローカル時刻）をISO文字列(UTC)に変換する */
export function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  // Asia/Tokyoは常にUTC+9（サマータイムなし）のため固定オフセットで変換できる
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - 9 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

/** ISO文字列(UTC)をAsia/Tokyoの日付キー「YYYY-MM-DD」に変換する */
export function dateKeyJst(iso: string | null): string {
  if (!iso) return "";
  return toDatetimeLocalValue(iso).slice(0, 10);
}

/** ISO文字列(UTC)をAsia/Tokyoの時刻「HH:mm」（<input type="time">用）に変換する */
export function timeOfDayJst(iso: string | null): string {
  if (!iso) return "";
  return toDatetimeLocalValue(iso).slice(11);
}

/** 日付キー「YYYY-MM-DD」と時刻「HH:mm」（ともにAsia/Tokyo基準）を結合してISO文字列(UTC)に変換する */
export function combineDateAndTimeJst(dateKey: string, time: string): string | null {
  if (!dateKey) return null;
  return fromDatetimeLocalValue(`${dateKey}T${time || "00:00"}`);
}

/**
 * 指定日(dateKey, Asia/Tokyoの「YYYY-MM-DD」)が開始日時〜期限日時の作業期間に含まれるか判定する。
 * 片方しか設定されていない場合は、その日付と一致するかどうかで判定する。
 */
export function isActiveOnDate(startAtIso: string | null, dueAtIso: string | null, dateKey: string): boolean {
  const startKey = dateKeyJst(startAtIso);
  const dueKey = dateKeyJst(dueAtIso);
  if (startKey && dueKey) return startKey <= dateKey && dateKey <= dueKey;
  if (dueKey) return dueKey === dateKey;
  if (startKey) return startKey === dateKey;
  return false;
}

// untilDateKeyを指定しない場合のみ使う既定の期間
const RECURRENCE_DEFAULT_HORIZON_MONTHS = 3;
// untilDateKeyで指定された期限がどれだけ先でも、一度に作成する件数を抑えるための上限
export const RECURRENCE_MAX_HORIZON_MONTHS = 24;

function dateKeyFromUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

function parseDateKeyUtc(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** 日付キー「YYYY-MM-DD」にmonthsか月を加算する（フォームの「繰り返しの期限」欄の初期値の計算に使う） */
export function addMonthsToDateKey(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return dateKeyFromUtcDate(new Date(Date.UTC(year, month - 1 + months, day)));
}

export const RECURRENCE_DEFAULT_UNTIL_MONTHS = RECURRENCE_DEFAULT_HORIZON_MONTHS;

/**
 * 開始日(startDateKey, 「YYYY-MM-DD」)から指定した頻度で、untilDateKey（繰り返しの期限、「ここまで」）で
 * 指定した日付まで日付キーの一覧を生成する（繰り返し予定を複数の独立した項目として作成するために使用する）。
 * untilDateKeyを指定しない場合は既定の3か月分、指定した場合でも最大24か月分までしか作成しない
 * （一度に大量の項目が作成されるのを防ぐための安全装置）。
 */
export function generateRecurrenceDateKeys(
  startDateKey: string,
  freq: "daily" | "weekly" | "biweekly" | "monthly",
  untilDateKey?: string | null
): string[] {
  const [year, month, day] = startDateKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  const maxEnd = new Date(Date.UTC(year, month - 1 + RECURRENCE_MAX_HORIZON_MONTHS, day));
  const defaultEnd = new Date(Date.UTC(year, month - 1 + RECURRENCE_DEFAULT_HORIZON_MONTHS, day));

  let endExclusive = untilDateKey ? parseDateKeyUtc(untilDateKey) : defaultEnd;
  if (endExclusive.getTime() > maxEnd.getTime()) endExclusive = maxEnd;
  if (endExclusive.getTime() < start.getTime()) endExclusive = start;

  const keys: string[] = [];

  if (freq === "monthly") {
    for (let occurrence = 0; ; occurrence += 1) {
      const targetMonthIndex = month - 1 + occurrence;
      // 対象月にstartDateKeyの日が存在しない場合（例: 1/31開始の2月）は月末日にクランプする
      const daysInTargetMonth = new Date(Date.UTC(year, targetMonthIndex + 1, 0)).getUTCDate();
      const cursor = new Date(Date.UTC(year, targetMonthIndex, Math.min(day, daysInTargetMonth)));
      if (cursor.getTime() > endExclusive.getTime()) break;
      keys.push(dateKeyFromUtcDate(cursor));
    }
    return keys;
  }

  const stepDays = freq === "daily" ? 1 : freq === "weekly" ? 7 : 14;
  for (let cursor = start; cursor.getTime() <= endExclusive.getTime(); ) {
    keys.push(dateKeyFromUtcDate(cursor));
    cursor = new Date(cursor.getTime() + stepDays * 24 * 60 * 60 * 1000);
  }
  return keys;
}

export type UpcomingRange = "week" | "month" | "3months" | "6months";

const UPCOMING_RANGE_MONTHS: Record<Exclude<UpcomingRange, "week">, number> = {
  month: 1,
  "3months": 3,
  "6months": 6,
};

/**
 * ホームの「今後の予定」フィルター用に、指定した範囲の末日をAsia/Tokyoの日付キー「YYYY-MM-DD」で返す。
 * 「1週間以内」は今日から7日後までとする。
 */
export function upcomingRangeEndKey(range: UpcomingRange, now: Date = new Date()): string {
  const todayKey = dateKeyJst(now.toISOString());
  const [year, month, day] = todayKey.split("-").map(Number);
  const todayUtc = new Date(Date.UTC(year, month - 1, day));

  if (range === "week") {
    return dateKeyFromUtcDate(new Date(todayUtc.getTime() + 7 * 24 * 60 * 60 * 1000));
  }

  return dateKeyFromUtcDate(new Date(Date.UTC(year, month - 1 + UPCOMING_RANGE_MONTHS[range], day)));
}

/** 期限超過かどうか（未完了かつ期限が現在時刻より過去） */
export function isOverdue(dueAtIso: string | null, status: string, now: Date = new Date()): boolean {
  if (!dueAtIso || status === "done") return false;
  return new Date(dueAtIso).getTime() < now.getTime();
}

/** 完了から14日経過し、通常一覧から非表示にすべきか */
export function isHiddenAfterCompletion(
  status: string,
  completedAtIso: string | null,
  now: Date = new Date()
): boolean {
  if (status !== "done" || !completedAtIso) return false;
  return now.getTime() - new Date(completedAtIso).getTime() >= FOURTEEN_DAYS_MS;
}
