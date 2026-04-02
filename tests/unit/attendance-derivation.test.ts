import { describe, expect, it } from "vitest";

import {
  deriveAdminAttendanceSummary,
  deriveAttendanceDisplay,
} from "@/lib/attendance/derivation";
import type {
  AttendanceAttempt,
  AttendanceDisplay,
  AttendanceRecord,
  AttendanceSurfaceManualRequestResource,
  ExpectedWorkday,
  PreviousDayOpenRecord,
} from "@/lib/contracts/shared";

function createExpectedWorkday(
  overrides: Partial<ExpectedWorkday> = {},
): ExpectedWorkday {
  return {
    isWorkday: true,
    expectedClockInAt: "2026-03-30T09:00:00+09:00",
    expectedClockOutAt: "2026-03-30T18:00:00+09:00",
    adjustedClockInAt: "2026-03-30T09:00:00+09:00",
    adjustedClockOutAt: "2026-03-30T18:00:00+09:00",
    countsTowardAdminSummary: true,
    leaveCoverage: null,
    ...overrides,
  };
}

function createAttendanceRecord(
  overrides: Partial<AttendanceRecord> = {},
): AttendanceRecord {
  return {
    id: "att_20260330_emp_001",
    date: "2026-03-30",
    clockInAt: "2026-03-30T09:03:00+09:00",
    clockInSource: "beacon",
    clockOutAt: null,
    clockOutSource: null,
    workMinutes: null,
    ...overrides,
  };
}

function createAttendanceAttempt(
  overrides: Partial<AttendanceAttempt> = {},
): AttendanceAttempt {
  return {
    id: "attempt_001",
    date: "2026-03-30",
    action: "clock_in",
    attemptedAt: "2026-03-30T09:03:00+09:00",
    status: "success",
    failureReason: null,
    ...overrides,
  };
}

function createPreviousDayOpenRecord(
  overrides: Partial<PreviousDayOpenRecord> = {},
): PreviousDayOpenRecord {
  return {
    date: "2026-03-29",
    clockInAt: "2026-03-29T09:00:00+09:00",
    clockOutAt: null,
    expectedClockOutAt: "2026-03-29T18:00:00+09:00",
    ...overrides,
  };
}

function createManualRequest(
  overrides: Partial<AttendanceSurfaceManualRequestResource> = {},
): AttendanceSurfaceManualRequestResource {
  return {
    id: "req_manual_001",
    requestType: "manual_attendance",
    action: "clock_in",
    date: "2026-03-30",
    requestedAt: "2026-03-30T09:15:00+09:00",
    reason: "Beacon retry failed",
    status: "pending",
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: "req_manual_001",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
    activeRequestId: "req_manual_001",
    activeStatus: "pending",
    effectiveRequestId: "req_manual_001",
    effectiveStatus: "pending",
    governingReviewComment: null,
    hasActiveFollowUp: false,
    nextAction: "admin_review",
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

describe("attendance derivation", () => {
  it("marks a late check-in as working with the late flag", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T10:00:00+09:00",
        expectedWorkday: createExpectedWorkday(),
        record: createAttendanceRecord(),
        attempts: [createAttendanceAttempt()],
        previousDayOpenRecord: null,
      }),
    ).toEqual({
      phase: "working",
      flags: ["late"],
      activeExceptions: [],
      nextAction: {
        type: "clock_out",
        relatedRequestId: null,
      },
    });
  });

  it("keeps late and early-leave flags together when both facts exist", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T18:10:00+09:00",
        expectedWorkday: createExpectedWorkday(),
        record: createAttendanceRecord({
          clockOutAt: "2026-03-30T17:30:00+09:00",
          clockOutSource: "beacon",
          workMinutes: 507,
        }),
        attempts: [
          createAttendanceAttempt(),
          createAttendanceAttempt({
            id: "attempt_002",
            action: "clock_out",
            attemptedAt: "2026-03-30T17:30:00+09:00",
          }),
        ],
        previousDayOpenRecord: null,
      }),
    ).toEqual({
      phase: "checked_out",
      flags: ["late", "early_leave"],
      activeExceptions: [],
      nextAction: {
        type: "wait",
        relatedRequestId: null,
      },
    });
  });

  it("uses the adjusted leave-covered window for lateness checks", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T11:15:00+09:00",
        expectedWorkday: createExpectedWorkday({
          adjustedClockInAt: "2026-03-30T11:00:00+09:00",
          leaveCoverage: {
            requestId: "req_leave_001",
            leaveType: "hourly",
            startAt: "2026-03-30T09:00:00+09:00",
            endAt: "2026-03-30T11:00:00+09:00",
          },
        }),
        record: createAttendanceRecord({
          clockInAt: "2026-03-30T10:30:00+09:00",
        }),
        attempts: [createAttendanceAttempt()],
        previousDayOpenRecord: null,
      }).flags,
    ).toEqual([]);
  });

  it("does not create leave_work_conflict without actual attendance facts", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T12:00:00+09:00",
        expectedWorkday: createExpectedWorkday({
          leaveCoverage: {
            requestId: "req_leave_001",
            leaveType: "annual",
            startAt: "2026-03-30T09:00:00+09:00",
            endAt: "2026-03-30T18:00:00+09:00",
          },
        }),
        record: null,
        attempts: [],
        previousDayOpenRecord: null,
      }).activeExceptions,
    ).not.toContain("leave_work_conflict");
  });

  it("surfaces not_checked_in after the adjusted start time without finalizing absence", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T09:05:00+09:00",
        expectedWorkday: createExpectedWorkday(),
        record: null,
        attempts: [],
        previousDayOpenRecord: null,
      }),
    ).toEqual({
      phase: "before_check_in",
      flags: [],
      activeExceptions: ["not_checked_in"],
      nextAction: {
        type: "clock_in",
        relatedRequestId: null,
      },
    });
  });

  it("finalizes absence only after the day closes", () => {
    const display = deriveAttendanceDisplay({
      now: "2026-03-30T18:05:00+09:00",
      expectedWorkday: createExpectedWorkday(),
      record: null,
      attempts: [],
      previousDayOpenRecord: null,
    });

    expect(display.activeExceptions).toEqual(["absent"]);
    expect(display.activeExceptions).not.toContain("not_checked_in");
  });

  it("returns submit_manual_request once absence is finalized", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T18:05:00+09:00",
        expectedWorkday: createExpectedWorkday(),
        record: null,
        attempts: [],
        previousDayOpenRecord: null,
      }).nextAction,
    ).toEqual({
      type: "submit_manual_request",
      relatedRequestId: null,
    });
  });

  it("keeps failed attempts distinct from missing check-in state", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T09:15:00+09:00",
        expectedWorkday: createExpectedWorkday(),
        record: null,
        attempts: [
          createAttendanceAttempt({
            status: "failed",
            attemptedAt: "2026-03-30T09:02:00+09:00",
            failureReason: "BLE beacon not detected",
          }),
        ],
        previousDayOpenRecord: null,
      }).activeExceptions,
    ).toEqual(["attempt_failed", "not_checked_in"]);
  });

  it("does not turn a carry-over checkout attempt into the new day's checkout state", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-31T08:30:00+09:00",
        expectedWorkday: createExpectedWorkday({
          expectedClockInAt: "2026-03-31T09:00:00+09:00",
          expectedClockOutAt: "2026-03-31T18:00:00+09:00",
          adjustedClockInAt: "2026-03-31T09:00:00+09:00",
          adjustedClockOutAt: "2026-03-31T18:00:00+09:00",
        }),
        record: null,
        attempts: [
          createAttendanceAttempt({
            date: "2026-03-30",
            action: "clock_out",
            attemptedAt: "2026-03-31T08:30:00+09:00",
          }),
        ],
        previousDayOpenRecord: null,
      }).phase,
    ).toBe("before_check_in");
  });

  it("surfaces previous_day_checkout_missing after the carry-over cutoff", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T09:01:00+09:00",
        expectedWorkday: createExpectedWorkday(),
        record: null,
        attempts: [],
        previousDayOpenRecord: createPreviousDayOpenRecord(),
      }),
    ).toEqual({
      phase: "before_check_in",
      flags: [],
      activeExceptions: ["previous_day_checkout_missing", "not_checked_in"],
      nextAction: {
        type: "resolve_previous_day_checkout",
        relatedRequestId: null,
      },
    });
  });

  it("surfaces pending manual requests in attendance exceptions", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T09:20:00+09:00",
        expectedWorkday: createExpectedWorkday(),
        record: null,
        attempts: [],
        previousDayOpenRecord: null,
        manualRequest: createManualRequest(),
      }),
    ).toEqual({
      phase: "before_check_in",
      flags: [],
      activeExceptions: ["manual_request_pending", "not_checked_in"],
      nextAction: {
        type: "review_request_status",
        relatedRequestId: null,
      },
    });
  });

  it("surfaces rejected manual requests in attendance exceptions", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T18:05:00+09:00",
        expectedWorkday: createExpectedWorkday(),
        record: null,
        attempts: [],
        previousDayOpenRecord: null,
        manualRequest: createManualRequest({
          id: "req_manual_002",
          status: "rejected",
          reviewedAt: "2026-03-30T17:30:00+09:00",
          reviewComment: "Need clearer retry context.",
          activeRequestId: null,
          activeStatus: null,
          effectiveRequestId: "req_manual_002",
          effectiveStatus: "rejected",
          governingReviewComment: "Need clearer retry context.",
          nextAction: "none",
        }),
      }),
    ).toEqual({
      phase: "before_check_in",
      flags: [],
      activeExceptions: ["manual_request_rejected", "absent"],
      nextAction: {
        type: "review_request_status",
        relatedRequestId: null,
      },
    });
  });

  it("does not surface previous_day_checkout_missing for an already closed prior day", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T09:01:00+09:00",
        expectedWorkday: createExpectedWorkday(),
        record: null,
        attempts: [],
        previousDayOpenRecord: createPreviousDayOpenRecord({
          clockOutAt: "2026-03-29T18:05:00+09:00",
        }),
      }),
    ).toEqual({
      phase: "before_check_in",
      flags: [],
      activeExceptions: ["not_checked_in"],
      nextAction: {
        type: "clock_in",
        relatedRequestId: null,
      },
    });
  });

  it("does not keep prior-day failed attempts operational once the prior day is closed", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T09:01:00+09:00",
        expectedWorkday: createExpectedWorkday(),
        record: null,
        attempts: [
          createAttendanceAttempt({
            id: "attempt_003",
            date: "2026-03-29",
            action: "clock_out",
            attemptedAt: "2026-03-30T08:30:00+09:00",
            status: "failed",
            failureReason: "BLE beacon not detected",
          }),
        ],
        previousDayOpenRecord: createPreviousDayOpenRecord({
          clockOutAt: "2026-03-29T18:05:00+09:00",
        }),
      }).activeExceptions,
    ).toEqual(["not_checked_in"]);
  });

  it("uses the attendance timezone when evaluating the carry-over cutoff", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T00:01:00Z",
        expectedWorkday: createExpectedWorkday(),
        record: null,
        attempts: [],
        previousDayOpenRecord: createPreviousDayOpenRecord(),
      }).activeExceptions,
    ).toEqual(["previous_day_checkout_missing", "not_checked_in"]);
  });

  it("keeps same-workday attempts when UTC now falls on the prior calendar date", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-29T15:05:00Z",
        expectedWorkday: createExpectedWorkday({
          isWorkday: false,
          expectedClockInAt: null,
          expectedClockOutAt: null,
          adjustedClockInAt: null,
          adjustedClockOutAt: null,
          countsTowardAdminSummary: false,
        }),
        record: null,
        attempts: [
          createAttendanceAttempt({
            status: "failed",
            date: "2026-03-30",
            attemptedAt: "2026-03-30T00:05:00+09:00",
            failureReason: "BLE beacon not detected",
          }),
        ],
        previousDayOpenRecord: null,
      }).activeExceptions,
    ).toEqual(["attempt_failed"]);
  });

  it("ignores stale closed-day attempts when deriving a non-workday display", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T12:00:00+09:00",
        expectedWorkday: createExpectedWorkday({
          isWorkday: false,
          expectedClockInAt: null,
          expectedClockOutAt: null,
          adjustedClockInAt: null,
          adjustedClockOutAt: null,
          countsTowardAdminSummary: false,
        }),
        record: null,
        attempts: [
          createAttendanceAttempt({
            status: "failed",
            date: "2026-03-29",
            attemptedAt: "2026-03-29T08:30:00+09:00",
            failureReason: "BLE beacon not detected",
          }),
        ],
        previousDayOpenRecord: null,
      }).activeExceptions,
    ).toEqual([]);
  });

  it("keeps unresolved carry-over failed attempts visible after the cutoff", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T09:01:00+09:00",
        expectedWorkday: createExpectedWorkday(),
        record: null,
        attempts: [
          createAttendanceAttempt({
            id: "attempt_002",
            date: "2026-03-29",
            action: "clock_out",
            attemptedAt: "2026-03-30T08:30:00+09:00",
            status: "failed",
            failureReason: "BLE beacon not detected",
          }),
        ],
        previousDayOpenRecord: createPreviousDayOpenRecord(),
      }).activeExceptions,
    ).toEqual([
      "previous_day_checkout_missing",
      "attempt_failed",
      "not_checked_in",
    ]);
  });

  it("prefers working over non_workday when same-day facts exist", () => {
    expect(
      deriveAttendanceDisplay({
        now: "2026-03-30T10:00:00+09:00",
        expectedWorkday: createExpectedWorkday({
          isWorkday: false,
          expectedClockInAt: null,
          expectedClockOutAt: null,
          adjustedClockInAt: null,
          adjustedClockOutAt: null,
          countsTowardAdminSummary: false,
        }),
        record: createAttendanceRecord({
          clockInAt: "2026-03-30T10:00:00+09:00",
        }),
        attempts: [],
        previousDayOpenRecord: null,
      }).phase,
    ).toBe("working");
  });

  it("derives admin summary counts from the same display outputs", () => {
    expect(
      deriveAdminAttendanceSummary([
        {
          expectedWorkday: createExpectedWorkday(),
          todayRecord: createAttendanceRecord(),
          display: createDisplay({
            phase: "working",
            flags: ["late"],
            nextAction: {
              type: "clock_out",
              relatedRequestId: null,
            },
          }),
        },
        {
          expectedWorkday: createExpectedWorkday(),
          todayRecord: null,
          display: createDisplay({
            activeExceptions: ["not_checked_in"],
          }),
        },
        {
          expectedWorkday: createExpectedWorkday({
            leaveCoverage: {
              requestId: "req_leave_001",
              leaveType: "annual",
              startAt: "2026-03-30T09:00:00+09:00",
              endAt: "2026-03-30T18:00:00+09:00",
            },
          }),
          todayRecord: null,
          display: createDisplay(),
        },
        {
          expectedWorkday: createExpectedWorkday(),
          todayRecord: null,
          display: createDisplay({
            activeExceptions: ["attempt_failed", "not_checked_in"],
          }),
        },
        {
          expectedWorkday: createExpectedWorkday(),
          todayRecord: null,
          display: createDisplay({
            activeExceptions: ["previous_day_checkout_missing"],
            nextAction: {
              type: "resolve_previous_day_checkout",
              relatedRequestId: null,
            },
          }),
        },
      ]),
    ).toEqual({
      checkedInCount: 1,
      notCheckedInCount: 2,
      lateCount: 1,
      onLeaveCount: 1,
      failedAttemptCount: 1,
      previousDayOpenCount: 1,
    });
  });

  it("skips non-counting rows for admin summary totals except queue-only counters", () => {
    expect(
      deriveAdminAttendanceSummary([
        {
          expectedWorkday: createExpectedWorkday({
            countsTowardAdminSummary: false,
            leaveCoverage: {
              requestId: "req_leave_002",
              leaveType: "annual",
              startAt: "2026-03-30T09:00:00+09:00",
              endAt: "2026-03-30T18:00:00+09:00",
            },
          }),
          todayRecord: createAttendanceRecord(),
          display: createDisplay({
            phase: "working",
            flags: ["late"],
            activeExceptions: [
              "attempt_failed",
              "not_checked_in",
              "previous_day_checkout_missing",
            ],
          }),
        },
      ]),
    ).toEqual({
      checkedInCount: 0,
      notCheckedInCount: 0,
      lateCount: 0,
      onLeaveCount: 0,
      failedAttemptCount: 1,
      previousDayOpenCount: 1,
    });
  });
});
