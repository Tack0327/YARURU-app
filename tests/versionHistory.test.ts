import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import { VERSION_HISTORY } from "@/lib/versionHistory";

describe("VERSION_HISTORY", () => {
  it("先頭（最新）のバージョンがpackage.jsonのversionと一致する", () => {
    expect(VERSION_HISTORY[0]?.version).toBe(packageJson.version);
  });

  it("各バージョンに変更点が1つ以上あり、空の項目が無い", () => {
    for (const entry of VERSION_HISTORY) {
      expect(entry.changes.length).toBeGreaterThan(0);
      for (const change of entry.changes) expect(change.trim()).not.toBe("");
    }
  });

  it("日付はYYYY-MM-DD形式で、新しい順に並んでいる", () => {
    for (const entry of VERSION_HISTORY) expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const dates = VERSION_HISTORY.map((entry) => entry.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
