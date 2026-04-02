import { describe, expect, it } from "vitest";

import {
  getAttendanceHistoryRange,
  parseAttendanceHistoryView,
} from "@/lib/attendance/page-data";

describe("attendance page data helpers", () => {
  it("defaults invalid or missing history view input to week", () => {
    expect(parseAttendanceHistoryView(undefined)).toBe("week");
    expect(parseAttendanceHistoryView("")).toBe("week");
    expect(parseAttendanceHistoryView("quarter")).toBe("week");
    expect(parseAttendanceHistoryView(["month", "week"])).toBe("week");
  });

  it("keeps explicit supported history view values", () => {
    expect(parseAttendanceHistoryView("week")).toBe("week");
    expect(parseAttendanceHistoryView("month")).toBe("month");
  });

  it("builds a rolling 7 day history range ending at the page date", () => {
    expect(getAttendanceHistoryRange("2026-04-13", "week")).toEqual({
      from: "2026-04-07",
      to: "2026-04-13",
    });
  });

  it("builds a rolling 30 day history range ending at the page date", () => {
    expect(getAttendanceHistoryRange("2026-04-13", "month")).toEqual({
      from: "2026-03-15",
      to: "2026-04-13",
    });
  });
});
