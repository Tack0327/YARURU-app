import { describe, expect, it } from "vitest";
import { parseHolidayCsv, parseHolidayCsvLine } from "@/lib/holidays";

describe("parseHolidayCsvLine", () => {
  it("parses a normal line into a date key and name", () => {
    expect(parseHolidayCsvLine("2026/1/1,元日")).toEqual({ dateKey: "2026-01-01", name: "元日" });
  });

  it("pads single-digit months and days", () => {
    expect(parseHolidayCsvLine("2026/3/20,春分の日")).toEqual({ dateKey: "2026-03-20", name: "春分の日" });
  });

  it("returns null for a malformed line", () => {
    expect(parseHolidayCsvLine("not,a,date")).toBeNull();
    expect(parseHolidayCsvLine("2026/1/1")).toBeNull();
    expect(parseHolidayCsvLine("")).toBeNull();
  });
});

describe("parseHolidayCsv", () => {
  it("skips the header row and builds a date-to-name map", () => {
    const csv = "国民の祝日・休日月日,国民の祝日・休日名称\n2026/1/1,元日\n2026/1/12,成人の日\n";
    const map = parseHolidayCsv(csv);
    expect(map.get("2026-01-01")).toBe("元日");
    expect(map.get("2026-01-12")).toBe("成人の日");
    expect(map.size).toBe(2);
  });

  it("handles CRLF line endings", () => {
    const csv = "header\r\n2026/5/3,憲法記念日\r\n2026/5/4,みどりの日\r\n";
    const map = parseHolidayCsv(csv);
    expect(map.get("2026-05-03")).toBe("憲法記念日");
    expect(map.get("2026-05-04")).toBe("みどりの日");
  });
});
