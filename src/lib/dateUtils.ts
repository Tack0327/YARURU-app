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
