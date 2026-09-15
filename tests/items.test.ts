import { describe, expect, it } from "vitest";
import { sortItemsForHome } from "@/lib/items";
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
