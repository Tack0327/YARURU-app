import { describe, expect, it } from "vitest";
import { buildItemsCsv, csvFileName } from "@/lib/csvExport";
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
});

describe("csvFileName", () => {
  it("Asia/Tokyo基準の日時をファイル名に含める", () => {
    expect(csvFileName(new Date("2026-10-04T09:30:00.000Z"))).toBe("yaruru-tickets-20261004-1830.csv");
  });
});
