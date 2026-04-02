import { describe, expect, it } from "vitest";

import {
  buildCarryOverDraft,
  buildHistoryCorrectionDraft,
} from "@/app/(erp)/(employee)/attendance/_lib/view-model";
import type { AttendanceHistoryResponse } from "@/lib/contracts/attendance";
import type {
  AttendanceDisplay,
  ExpectedWorkday,
  PreviousDayOpenRecord,
} from "@/lib/contracts/shared";

function createExpectedWorkday(
  overrides: Partial<ExpectedWorkday> = {},
): ExpectedWorkday {
  return {
    isWorkday: true,
    expectedClockInAt: "2026-04-13T09:00:00+09:00",
    expectedClockOutAt: "2026-04-13T18:00:00+09:00",
    adjustedClockInAt: "2026-04-13T09:00:00+09:00",
    adjustedClockOutAt: "2026-04-13T18:00:00+09:00",
    countsTowardAdminSummary: true,
    leaveCoverage: null,
    ...overrides,
  };
}

function createDisplay(
  overrides: Partial<AttendanceDisplay> = {},
): AttendanceDisplay {
  return {
    phase: "before_check_in",
    flags: [],
    activeExceptions: [],
    nextAction: {
      type: "clock_in",
      relatedRequestId: null,
    },
    ...overrides,
  };
}

function createHistoryRecord(
  overrides: Partial<AttendanceHistoryResponse["records"][number]> = {},
): AttendanceHistoryResponse["records"][number] {
  return {
    date: "2026-04-13",
    expectedWorkday: createExpectedWorkday(),
    record: null,
    display: createDisplay(),
    ...overrides,
  };
}

function createPreviousDayOpenRecord(
  overrides: Partial<PreviousDayOpenRecord> = {},
): PreviousDayOpenRecord {
  return {
    date: "2026-04-10",
    clockInAt: "2026-04-10T09:04:00+09:00",
    clockOutAt: null,
    expectedClockOutAt: "2026-04-10T18:00:00+09:00",
    ...overrides,
  };
}

describe("attendance page view model", () => {
  it("prefills carry-over correction as a prior-date clock_out request", () => {
    expect(buildCarryOverDraft(createPreviousDayOpenRecord())).toEqual({
      date: "2026-04-10",
      action: "clock_out",
      requestedClockInAt: null,
      requestedClockOutAt: "2026-04-10T18:00:00+09:00",
      reason: "",
    });
  });

  it("prefills open-record history rows as a checkout correction", () => {
    expect(
      buildHistoryCorrectionDraft(
        createHistoryRecord({
          record: {
            id: "attendance_record_emp_001_2026-04-12",
            date: "2026-04-12",
            clockInAt: "2026-04-12T09:02:00+09:00",
            clockInSource: "beacon",
            clockOutAt: null,
            clockOutSource: null,
            workMinutes: null,
          },
          expectedWorkday: createExpectedWorkday({
            expectedClockInAt: "2026-04-12T09:00:00+09:00",
            expectedClockOutAt: "2026-04-12T18:00:00+09:00",
            adjustedClockInAt: "2026-04-12T09:00:00+09:00",
            adjustedClockOutAt: "2026-04-12T18:00:00+09:00",
          }),
        }),
      ),
    ).toEqual({
      date: "2026-04-13",
      action: "clock_out",
      requestedClockInAt: null,
      requestedClockOutAt: "2026-04-12T18:00:00+09:00",
      reason: "",
    });
  });

  it("prefills no-record history rows as a both-times correction", () => {
    expect(
      buildHistoryCorrectionDraft(
        createHistoryRecord({
          date: "2026-04-09",
          expectedWorkday: createExpectedWorkday({
            expectedClockInAt: "2026-04-09T09:00:00+09:00",
            expectedClockOutAt: "2026-04-09T18:00:00+09:00",
            adjustedClockInAt: "2026-04-09T09:00:00+09:00",
            adjustedClockOutAt: "2026-04-09T18:00:00+09:00",
          }),
        }),
      ),
    ).toEqual({
      date: "2026-04-09",
      action: "both",
      requestedClockInAt: "2026-04-09T09:00:00+09:00",
      requestedClockOutAt: "2026-04-09T18:00:00+09:00",
      reason: "",
    });
  });

  it("prefills fully recorded workdays as an editable both-times correction", () => {
    expect(
      buildHistoryCorrectionDraft(
        createHistoryRecord({
          date: "2026-04-08",
          record: {
            id: "attendance_record_emp_001_2026-04-08",
            date: "2026-04-08",
            clockInAt: "2026-04-08T09:06:00+09:00",
            clockInSource: "beacon",
            clockOutAt: "2026-04-08T18:02:00+09:00",
            clockOutSource: "beacon",
            workMinutes: 536,
          },
        }),
      ),
    ).toEqual({
      date: "2026-04-08",
      action: "both",
      requestedClockInAt: "2026-04-08T09:06:00+09:00",
      requestedClockOutAt: "2026-04-08T18:02:00+09:00",
      reason: "",
    });
  });

  it("creates a correction draft for empty non-workdays", () => {
    expect(
      buildHistoryCorrectionDraft(
        createHistoryRecord({
          date: "2026-04-12",
          expectedWorkday: createExpectedWorkday({
            isWorkday: false,
            expectedClockInAt: null,
            expectedClockOutAt: null,
            adjustedClockInAt: null,
            adjustedClockOutAt: null,
          }),
        }),
      ),
    ).toEqual({
      date: "2026-04-12",
      action: "both",
      requestedClockInAt: null,
      requestedClockOutAt: null,
      reason: "",
    });
  });
});
