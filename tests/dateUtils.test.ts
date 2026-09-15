import { describe, expect, it } from "vitest";
import {
  formatDateTimeJst,
  fromDatetimeLocalValue,
  isActiveOnDate,
  isHiddenAfterCompletion,
  isOverdue,
  toDatetimeLocalValue,
} from "@/lib/dateUtils";

describe("dateUtils", () => {
  it("formats an ISO string as Asia/Tokyo date and time", () => {
    // UTC 2026-01-01 00:00 -> JST 2026-01-01 09:00
    expect(formatDateTimeJst("2026-01-01T00:00:00.000Z")).toBe("2026-01-01 09:00");
  });

  it("returns an empty string when the input is null", () => {
    expect(formatDateTimeJst(null)).toBe("");
  });

  it("converts an ISO string to a datetime-local value in JST", () => {
    expect(toDatetimeLocalValue("2026-01-01T00:00:00.000Z")).toBe("2026-01-01T09:00");
  });

  it("converts a datetime-local value (JST) back to an ISO string", () => {
    expect(fromDatetimeLocalValue("2026-01-01T09:00")).toBe("2026-01-01T00:00:00.000Z");
  });

  it("round-trips between toDatetimeLocalValue and fromDatetimeLocalValue", () => {
    const original = "2026-12-01T09:30:00.000Z";
    expect(fromDatetimeLocalValue(toDatetimeLocalValue(original))).toBe(original);
  });

  describe("isOverdue", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");

    it("is true when due_at is in the past and status is not done", () => {
      expect(isOverdue("2026-06-01T00:00:00.000Z", "not_started", now)).toBe(true);
    });

    it("is false when status is done, even if due_at is in the past", () => {
      expect(isOverdue("2026-06-01T00:00:00.000Z", "done", now)).toBe(false);
    });

    it("is false when due_at is not set", () => {
      expect(isOverdue(null, "not_started", now)).toBe(false);
    });

    it("is false when due_at is in the future", () => {
      expect(isOverdue("2026-06-20T00:00:00.000Z", "in_progress", now)).toBe(false);
    });
  });

  describe("isHiddenAfterCompletion", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");

    it("is false when status is not done", () => {
      expect(isHiddenAfterCompletion("in_progress", "2026-06-01T00:00:00.000Z", now)).toBe(false);
    });

    it("is false when fewer than 14 days have passed since completion", () => {
      expect(isHiddenAfterCompletion("done", "2026-06-05T00:00:00.000Z", now)).toBe(false);
    });

    it("is true when exactly 14 days have passed since completion", () => {
      expect(isHiddenAfterCompletion("done", "2026-06-01T00:00:00.000Z", now)).toBe(true);
    });

    it("is true when more than 14 days have passed since completion", () => {
      expect(isHiddenAfterCompletion("done", "2026-01-01T00:00:00.000Z", now)).toBe(true);
    });
  });

  describe("isActiveOnDate", () => {
    it("matches when the date falls within the start~due work period", () => {
      expect(
        isActiveOnDate("2026-06-10T00:00:00.000Z", "2026-06-20T00:00:00.000Z", "2026-06-15")
      ).toBe(true);
    });

    it("matches the boundary dates of the work period", () => {
      expect(isActiveOnDate("2026-06-10T00:00:00.000Z", "2026-06-20T00:00:00.000Z", "2026-06-10")).toBe(true);
      expect(isActiveOnDate("2026-06-10T00:00:00.000Z", "2026-06-20T00:00:00.000Z", "2026-06-20")).toBe(true);
    });

    it("does not match a date outside the work period", () => {
      expect(isActiveOnDate("2026-06-10T00:00:00.000Z", "2026-06-20T00:00:00.000Z", "2026-06-21")).toBe(false);
    });

    it("matches only the due date when start_at is not set", () => {
      expect(isActiveOnDate(null, "2026-06-15T00:00:00.000Z", "2026-06-15")).toBe(true);
      expect(isActiveOnDate(null, "2026-06-15T00:00:00.000Z", "2026-06-16")).toBe(false);
    });

    it("matches only the start date when due_at is not set", () => {
      expect(isActiveOnDate("2026-06-15T00:00:00.000Z", null, "2026-06-15")).toBe(true);
      expect(isActiveOnDate("2026-06-15T00:00:00.000Z", null, "2026-06-16")).toBe(false);
    });

    it("is false when neither start_at nor due_at is set", () => {
      expect(isActiveOnDate(null, null, "2026-06-15")).toBe(false);
    });
  });
});
