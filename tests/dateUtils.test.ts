import { describe, expect, it } from "vitest";
import {
  combineDateAndTimeJst,
  formatDateTimeJst,
  fromDatetimeLocalValue,
  generateRecurrenceDateKeys,
  isActiveOnDate,
  isHiddenAfterCompletion,
  isOverdue,
  timeOfDayJst,
  toDatetimeLocalValue,
  upcomingRangeEndKey,
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

  describe("timeOfDayJst / combineDateAndTimeJst", () => {
    it("extracts the JST time of day from an ISO string", () => {
      expect(timeOfDayJst("2026-06-15T00:30:00.000Z")).toBe("09:30");
    });

    it("returns an empty string when the input is null", () => {
      expect(timeOfDayJst(null)).toBe("");
    });

    it("combines a JST date key and time into an ISO string", () => {
      expect(combineDateAndTimeJst("2026-06-15", "09:30")).toBe("2026-06-15T00:30:00.000Z");
    });

    it("defaults to 00:00 when no time is given", () => {
      expect(combineDateAndTimeJst("2026-06-15", "")).toBe("2026-06-14T15:00:00.000Z");
    });

    it("returns null when no date is given", () => {
      expect(combineDateAndTimeJst("", "09:30")).toBeNull();
    });
  });

  describe("upcomingRangeEndKey", () => {
    // 2026-06-15T00:00:00Z -> JST 2026-06-15(月)
    const now = new Date("2026-06-15T00:00:00.000Z");

    it("returns 7 days later for \"week\"", () => {
      expect(upcomingRangeEndKey("week", now)).toBe("2026-06-22");
    });

    it("returns the same day next month for \"month\"", () => {
      expect(upcomingRangeEndKey("month", now)).toBe("2026-07-15");
    });

    it("returns the same day 3 months later for \"3months\"", () => {
      expect(upcomingRangeEndKey("3months", now)).toBe("2026-09-15");
    });

    it("returns the same day 6 months later for \"6months\"", () => {
      expect(upcomingRangeEndKey("6months", now)).toBe("2026-12-15");
    });
  });

  describe("generateRecurrenceDateKeys", () => {
    it("generates daily dates for the default 3-month horizon", () => {
      const keys = generateRecurrenceDateKeys("2026-01-01", "daily");
      expect(keys[0]).toBe("2026-01-01");
      expect(keys[1]).toBe("2026-01-02");
      expect(keys[keys.length - 1]).toBe("2026-04-01");
      expect(keys).toHaveLength(91);
    });

    it("generates weekly dates on the same weekday", () => {
      const keys = generateRecurrenceDateKeys("2026-01-01", "weekly", 1);
      expect(keys).toEqual(["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22", "2026-01-29"]);
    });

    it("generates biweekly dates", () => {
      const keys = generateRecurrenceDateKeys("2026-01-01", "biweekly", 2);
      expect(keys).toEqual(["2026-01-01", "2026-01-15", "2026-01-29", "2026-02-12", "2026-02-26"]);
    });

    it("generates monthly dates on the same day of month", () => {
      const keys = generateRecurrenceDateKeys("2026-01-15", "monthly", 3);
      expect(keys).toEqual(["2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15"]);
    });
  });
});
