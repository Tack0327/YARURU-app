import { NextResponse } from "next/server";
import { parseHolidayCsv } from "@/lib/holidays";

// 内閣府が公開している「国民の祝日」の公式CSV（Shift-JIS）。過去〜数年先までの全件が入っている。
const HOLIDAY_CSV_URL = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Next.jsのRoute Handlerのキャッシュ挙動（revalidate指定が実際に効くか）に依存すると、
// 取得失敗時に空の結果がそのまま「成功」として長時間キャッシュされてしまう恐れがある。
// そのため、キャッシュの制御は自前で行う：関数の温かいインスタンスが生きている間だけ有効な、
// 取得に成功したときだけ更新する簡易キャッシュ。失敗時はこれをフォールバックとして使う
// （空データで上書きしてしまうことを避けるための保険）。
let cache: { holidays: Record<string, string>; fetchedAt: number } | null = null;

async function fetchAndParseHolidays(): Promise<Record<string, string>> {
  const response = await fetch(HOLIDAY_CSV_URL);
  if (!response.ok) throw new Error(`祝日CSVの取得に失敗しました (status: ${response.status})`);

  const buffer = await response.arrayBuffer();
  const text = new TextDecoder("shift_jis").decode(buffer);
  const holidays = parseHolidayCsv(text);

  if (holidays.size === 0) {
    // 内閣府のCSVは通常1000件以上あるため、0件は取得失敗またはCSV形式変更の兆候として扱う
    throw new Error("祝日CSVの解析結果が空でした（形式が変わった可能性があります）");
  }

  return Object.fromEntries(holidays);
}

export async function GET() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.holidays, { headers: { "Cache-Control": "public, max-age=86400" } });
  }

  try {
    const holidays = await fetchAndParseHolidays();
    cache = { holidays, fetchedAt: Date.now() };
    return NextResponse.json(holidays, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch (err) {
    console.error("祝日情報の取得に失敗しました:", err);
    if (cache) {
      // 取得には失敗したが、以前取得できていたデータがあればそれを返す。
      // ただし劣化した応答なので、クライアント・CDN側には長時間キャッシュさせない。
      return NextResponse.json(cache.holidays, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({}, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
