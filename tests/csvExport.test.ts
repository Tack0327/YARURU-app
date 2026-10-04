import { describe, expect, it } from "vitest";
import { buildItemsCsv, CSV_EXPORT_MAX_ITEMS, csvFileName, parseCsvEmailRequest } from "@/lib/csvExport";
import type { Item } from "@/types/database";

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    group_id: "group-1",
    type: "todo",
    title: "テスト項目",
    description: null,
    start_at: null,
    due_at: null,
    end_at: null,
    is_all_day: false,
    recurrence_freq: null,
    recurrence_group_id: null,
    assignee_id: null,
    status: "not_started",
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

const HEADER = "﻿Summary,Issue Type,Status,Description,Assignee,Start date,Due date,Labels";

describe("buildItemsCsv", () => {
  it("実施作業をJira向けの列に変換し、日時はAsia/Tokyo基準で出力する", () => {
    const todo = makeItem({
      title: "ゴミ出し",
      status: "in_progress",
      assignee_id: "member-1",
      start_at: "2026-10-01T00:00:00.000Z",
      due_at: "2026-10-03T09:00:00.000Z",
    });
    const csv = buildItemsCsv([todo], (id) => (id === "member-1" ? "たかし" : undefined));
    expect(csv).toBe(`${HEADER}\r\nゴミ出し,Task,In Progress,,たかし,2026-10-01 09:00,2026-10-03 18:00,実施作業\r\n`);
  });

  it("予定は終了時刻をDue dateとして出力する", () => {
    const event = makeItem({
      type: "event",
      title: "運動会",
      status: "done",
      start_at: "2026-10-02T04:00:00.000Z",
      end_at: "2026-10-02T05:30:00.000Z",
    });
    const csv = buildItemsCsv([event], () => undefined);
    expect(csv.split("\r\n")[1]).toBe("運動会,Task,Done,,,2026-10-02 13:00,2026-10-02 14:30,予定");
  });

  it("カンマ・ダブルクォート・改行を含む値はダブルクォートで囲み、内部の\"は二重にする", () => {
    const item = makeItem({ title: 'A,B "C"', description: "1行目\n2行目" });
    const csv = buildItemsCsv([item], () => undefined);
    expect(csv.split("\r\n")[1]).toBe('"A,B ""C""",Task,To Do,"1行目\n2行目",,,,実施作業');
  });

  it("Excelで文字化けしないよう先頭にBOMを付ける", () => {
    expect(buildItemsCsv([], () => undefined).charCodeAt(0)).toBe(0xfeff);
  });

  it("Jira用（既定）では数式に見える値もそのまま出力する", () => {
    const item = makeItem({ title: "=1+1", description: "- [x] 買い物" });
    expect(buildItemsCsv([item], () => undefined).split("\r\n")[1]).toBe("=1+1,Task,To Do,- [x] 買い物,,,,実施作業");
  });

  it("Excel用では「= + - @」やタブで始まる値の先頭に'を付け、それ以外は変えない", () => {
    const item = makeItem({ title: "=HYPERLINK(\"x\")", description: "\t説明" });
    const cells = (assignee: string) => buildItemsCsv([item], () => assignee, "excel").split("\r\n")[1];
    expect(cells("+たかし")).toBe(`"'=HYPERLINK(""x"")",Task,To Do,'\t説明,'+たかし,,,実施作業`);
    expect(buildItemsCsv([makeItem({ title: "-1" }), makeItem({ title: "@SUM" })], () => undefined, "excel").split("\r\n").slice(1, 3))
      .toEqual(["'-1,Task,To Do,,,,,実施作業", "'@SUM,Task,To Do,,,,,実施作業"]);
    expect(buildItemsCsv([makeItem({ title: "ゴミ出し" })], () => undefined, "excel").split("\r\n")[1]).toBe(
      "ゴミ出し,Task,To Do,,,,,実施作業"
    );
  });
});

describe("csvFileName", () => {
  it("用途とAsia/Tokyo基準の日時をファイル名に含める", () => {
    const now = new Date("2026-10-04T09:30:00.000Z");
    expect(csvFileName("jira", now)).toBe("yaruru-tickets-jira-20261004-1830.csv");
    expect(csvFileName("excel", now)).toBe("yaruru-tickets-excel-20261004-1830.csv");
  });
});

describe("parseCsvEmailRequest", () => {
  it("正しいリクエストはIDの重複を除いて受け付ける", () => {
    expect(parseCsvEmailRequest({ itemIds: ["a", "b", "a"], purpose: "excel" })).toEqual({
      ok: true,
      itemIds: ["a", "b"],
      purpose: "excel",
    });
  });

  it("本文が無い・IDが配列でない・空・文字列以外を含む場合は拒否する", () => {
    for (const body of [null, "x", {}, { itemIds: "a", purpose: "jira" }, { itemIds: [], purpose: "jira" }, { itemIds: ["a", 1], purpose: "jira" }, { itemIds: [""], purpose: "jira" }]) {
      expect(parseCsvEmailRequest(body)).toEqual({ ok: false, error: `チケットを1〜${CSV_EXPORT_MAX_ITEMS}件選択してください。` });
    }
  });

  it("上限件数を超える場合は拒否する", () => {
    const itemIds = Array.from({ length: CSV_EXPORT_MAX_ITEMS + 1 }, (_, i) => `id-${i}`);
    expect(parseCsvEmailRequest({ itemIds, purpose: "jira" }).ok).toBe(false);
    expect(parseCsvEmailRequest({ itemIds: itemIds.slice(0, CSV_EXPORT_MAX_ITEMS), purpose: "jira" }).ok).toBe(true);
  });

  it("用途がjira/excel以外なら拒否する", () => {
    expect(parseCsvEmailRequest({ itemIds: ["a"] })).toEqual({
      ok: false,
      error: "CSVの用途（Jira取り込み用／Excel閲覧用）を選択してください。",
    });
    expect(parseCsvEmailRequest({ itemIds: ["a"], purpose: "pdf" }).ok).toBe(false);
  });
});
