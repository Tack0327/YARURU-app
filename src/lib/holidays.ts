/** 内閣府の祝日CSVの1行から、日付キー「YYYY-MM-DD」と祝日名を取り出す（純関数・テスト対象） */
export function parseHolidayCsvLine(line: string): { dateKey: string; name: string } | null {
  const [datePart, namePart] = line.split(",");
  if (!datePart || !namePart) return null;

  const [year, month, day] = datePart.trim().split("/").map(Number);
  if (!year || !month || !day) return null;

  const name = namePart.trim();
  if (!name) return null;

  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { dateKey, name };
}

/**
 * 内閣府の祝日CSV（1行目はヘッダー）全体をパースし、日付キー→祝日名のMapを作る（純関数・テスト対象）。
 * https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv
 */
export function parseHolidayCsv(csvText: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = csvText.split(/\r?\n/).slice(1);
  for (const line of lines) {
    const parsed = parseHolidayCsvLine(line);
    if (parsed) map.set(parsed.dateKey, parsed.name);
  }
  return map;
}

/**
 * 祝日一覧を取得する（自前のAPIルート経由。内閣府の公式CSVを日次で再取得しているため、
 * 祝日が新設・変更された場合もコードの変更なしに反映される）。
 */
export async function fetchHolidays(): Promise<Map<string, string>> {
  const res = await fetch("/api/holidays");
  if (!res.ok) throw new Error("祝日一覧の取得に失敗しました");
  const data: Record<string, string> = await res.json();
  return new Map(Object.entries(data));
}
