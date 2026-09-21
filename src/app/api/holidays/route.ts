import { NextResponse } from "next/server";
import { parseHolidayCsv } from "@/lib/holidays";

// 内閣府が公開している「国民の祝日」の公式CSV（Shift-JIS）。過去〜数年先までの全件が入っている。
const HOLIDAY_CSV_URL = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";

// 祝日は頻繁には変わらないため、1日単位でキャッシュしつつ、内閣府側の更新（祝日新設・変更）を
// コードの変更なしに反映できるようにする。
export const revalidate = 86400;

export async function GET() {
  try {
    const response = await fetch(HOLIDAY_CSV_URL, { next: { revalidate } });
    if (!response.ok) throw new Error(`祝日CSVの取得に失敗しました (status: ${response.status})`);

    const buffer = await response.arrayBuffer();
    const text = new TextDecoder("shift_jis").decode(buffer);
    const holidays = parseHolidayCsv(text);

    return NextResponse.json(Object.fromEntries(holidays), {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    // 内閣府のサイトが一時的に取得できない場合でも、カレンダー自体の表示は継続できるようにする
    return NextResponse.json({});
  }
}
