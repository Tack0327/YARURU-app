import { describe, expect, it } from "vitest";
import { planBulkDateChange, sortItemsForHome, sortItemsForSelectedDate, summarizeBulkChange } from "@/lib/items";
import { shouldNotifyForItem } from "@/lib/notifications";
import type { Item } from "@/types/database";

const now = new Date("2026-06-15T00:00:00.000Z");

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

describe("sortItemsForHome", () => {
  it("puts overdue items before non-overdue items", () => {
    const overdue = makeItem({ id: "overdue", due_at: "2026-06-01T00:00:00.000Z", status: "not_started" });
    const upcoming = makeItem({ id: "upcoming", due_at: "2026-07-01T00:00:00.000Z", status: "not_started" });

    const sorted = sortItemsForHome([upcoming, overdue], now);

    expect(sorted.map((item) => item.id)).toEqual(["overdue", "upcoming"]);
  });

  it("does not treat completed items as overdue, so a truly overdue item still comes first", () => {
    const doneButPastDue = makeItem({ id: "done", due_at: "2026-06-01T00:00:00.000Z", status: "done" });
    const overdue = makeItem({ id: "overdue", due_at: "2026-06-10T00:00:00.000Z", status: "not_started" });

    const sorted = sortItemsForHome([doneButPastDue, overdue], now);

    expect(sorted.map((item) => item.id)).toEqual(["overdue", "done"]);
  });

  it("sorts by nearest due date within the same overdue group", () => {
    const soon = makeItem({ id: "soon", due_at: "2026-06-20T00:00:00.000Z" });
    const later = makeItem({ id: "later", due_at: "2026-08-01T00:00:00.000Z" });

    const sorted = sortItemsForHome([later, soon], now);

    expect(sorted.map((item) => item.id)).toEqual(["soon", "later"]);
  });

  it("places items without a due date at the end", () => {
    const noDueDate = makeItem({ id: "no-due", due_at: null });
    const withDueDate = makeItem({ id: "with-due", due_at: "2026-07-01T00:00:00.000Z" });

    const sorted = sortItemsForHome([noDueDate, withDueDate], now);

    expect(sorted.map((item) => item.id)).toEqual(["with-due", "no-due"]);
  });

  it("sorts events without a due date by their start date instead", () => {
    const event = makeItem({
      id: "event",
      type: "event",
      due_at: null,
      start_at: "2026-06-16T00:00:00.000Z",
    });
    const todo = makeItem({ id: "todo", due_at: "2026-06-20T00:00:00.000Z" });

    const sorted = sortItemsForHome([todo, event], now);

    expect(sorted.map((item) => item.id)).toEqual(["event", "todo"]);
  });
});

describe("sortItemsForSelectedDate", () => {
  it("puts all-day items before timed items", () => {
    const timed = makeItem({ id: "timed", is_all_day: false, start_at: "2026-06-15T00:00:00.000Z" });
    const allDay = makeItem({ id: "all-day", is_all_day: true });

    const sorted = sortItemsForSelectedDate([timed, allDay]);

    expect(sorted.map((item) => item.id)).toEqual(["all-day", "timed"]);
  });

  it("sorts timed items by nearest time within the non-all-day group", () => {
    const later = makeItem({ id: "later", is_all_day: false, due_at: "2026-06-15T18:00:00.000Z" });
    const sooner = makeItem({ id: "sooner", is_all_day: false, due_at: "2026-06-15T09:00:00.000Z" });

    const sorted = sortItemsForSelectedDate([later, sooner]);

    expect(sorted.map((item) => item.id)).toEqual(["sooner", "later"]);
  });
});

describe("shouldNotifyForItem", () => {
  it("is false for completed items", () => {
    expect(shouldNotifyForItem({ status: "done", due_at: "2026-06-15T12:00:00.000Z" }, now)).toBe(false);
  });

  it("is false when there is no due date", () => {
    expect(shouldNotifyForItem({ status: "not_started", due_at: null }, now)).toBe(false);
  });

  it("is true when the due date is within 24 hours", () => {
    expect(shouldNotifyForItem({ status: "not_started", due_at: "2026-06-15T12:00:00.000Z" }, now)).toBe(true);
  });

  it("is false when the due date is more than 24 hours away", () => {
    expect(shouldNotifyForItem({ status: "not_started", due_at: "2026-06-20T00:00:00.000Z" }, now)).toBe(false);
  });
});

describe("planBulkDateChange", () => {
  // JST 09:00開始〜18:00期限の実施作業（UTCでは00:00〜09:00）
  const todo = makeItem({
    id: "todo",
    type: "todo",
    start_at: "2026-10-01T00:00:00.000Z",
    due_at: "2026-10-03T09:00:00.000Z",
  });
  // JST 10/2 13:00〜14:30の予定
  const event = makeItem({
    id: "event",
    type: "event",
    start_at: "2026-10-02T04:00:00.000Z",
    end_at: "2026-10-02T05:30:00.000Z",
  });

  it("各項目の時刻を保ったまま期限日だけを変更する", () => {
    const { updates, conflictIds } = planBulkDateChange([todo], { dueDateKey: "2026-10-10" });
    expect(conflictIds).toEqual([]);
    expect(updates).toEqual([{ id: "todo", due_at: "2026-10-10T09:00:00.000Z" }]);
  });

  it("予定は開始日の変更で終了時刻も同じ日付へ移し、期限日の指定は反映しない", () => {
    const { updates } = planBulkDateChange([event], { startDateKey: "2026-10-20", dueDateKey: "2026-10-25" });
    expect(updates).toEqual([
      { id: "event", start_at: "2026-10-20T04:00:00.000Z", end_at: "2026-10-20T05:30:00.000Z" },
    ]);
  });

  it("期限日だけを指定した場合、予定は変更対象に含めない", () => {
    const { updates, conflictIds } = planBulkDateChange([todo, event], { dueDateKey: "2026-10-10" });
    expect(updates.map((u) => u.id)).toEqual(["todo"]);
    expect(conflictIds).toEqual([]);
  });

  it("変更後に期限が開始より前になる実施作業はconflictIdsに入れ、updatesに含めない", () => {
    const { updates, conflictIds } = planBulkDateChange([todo, event], { startDateKey: "2026-10-05" });
    expect(conflictIds).toEqual(["todo"]);
    expect(updates.map((u) => u.id)).toEqual(["event"]);
  });

  it("開始日と期限日を同時に指定した場合は変更後の値どうしで判定する", () => {
    const { updates, conflictIds } = planBulkDateChange([todo], {
      startDateKey: "2026-10-05",
      dueDateKey: "2026-10-06",
    });
    expect(conflictIds).toEqual([]);
    expect(updates).toEqual([
      { id: "todo", start_at: "2026-10-05T00:00:00.000Z", due_at: "2026-10-06T09:00:00.000Z" },
    ]);
  });
});

describe("summarizeBulkChange", () => {
  const base = {
    selectedCount: 5,
    assigneeChanged: false,
    statusChanged: false,
    startDateChanged: false,
    dueDateChanged: false,
    dateUpdatedCount: 0,
  };

  it("担当者・状況の変更は選択した件数で表示する", () => {
    expect(summarizeBulkChange({ ...base, assigneeChanged: true, statusChanged: true })).toBe("5件の担当者・状況を変更しました");
  });

  it("期限日だけを変えて予定が対象外になった場合は、実際に変わった件数と対象外の件数を表示する", () => {
    expect(summarizeBulkChange({ ...base, dueDateChanged: true, dateUpdatedCount: 3 })).toBe(
      "3件の期限日を変更しました（予定2件は期限日が無いため日付を変更していません）"
    );
  });

  it("状況と日付を同時に変えた場合はそれぞれの件数を並べる", () => {
    expect(
      summarizeBulkChange({ ...base, statusChanged: true, startDateChanged: true, dueDateChanged: true, dateUpdatedCount: 5 })
    ).toBe("5件の状況を変更、5件の開始日・期限日を変更しました");
  });
});
