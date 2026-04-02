import { describe, expect, it } from "vitest";

import {
  adminAttendanceListQuerySchema,
  adminAttendanceListResponseSchema,
  adminAttendanceTodayResponseSchema,
} from "@/lib/contracts/admin-attendance";
import {
  attendanceHistoryQuerySchema,
  attendanceHistoryResponseSchema,
  attendanceTodayResponseSchema,
  manualAttendanceRequestBodySchema,
  manualAttendanceRequestResponseSchema,
} from "@/lib/contracts/attendance";
import {
  leaveOverviewResponseSchema,
  leaveRequestBodySchema,
  leaveRequestResponseSchema,
} from "@/lib/contracts/leave";
import {
  adminRequestDecisionBodySchema,
  adminRequestDecisionResponseSchema,
  adminRequestsQuerySchema,
  adminRequestsResponseSchema,
} from "@/lib/contracts/requests";
import {
  apiDateSchema,
  apiDateTimeSchema,
  attendanceExceptionTypeSchema,
  attendanceFlagSchema,
  attendancePhaseSchema,
  attendanceRecordSourceSchema,
  errorResponseSchema,
  leaveTypeSchema,
  manualAttendanceActionSchema,
  nextActionTypeSchema,
  requestChainProjectionSchema,
  requestStatusSchema,
  requestTypeSchema,
} from "@/lib/contracts/shared";

describe("shared contract schemas", () => {
  it("accept documented enum vocabulary and ISO date primitives", () => {
    expect(attendancePhaseSchema.options).toEqual([
      "non_workday",
      "before_check_in",
      "working",
      "checked_out",
    ]);
    expect(attendanceFlagSchema.options).toEqual(["late", "early_leave"]);
    expect(attendanceExceptionTypeSchema.options).toEqual([
      "attempt_failed",
      "not_checked_in",
      "absent",
      "previous_day_checkout_missing",
      "leave_work_conflict",
      "manual_request_pending",
      "manual_request_rejected",
    ]);
    expect(nextActionTypeSchema.options).toEqual([
      "clock_in",
      "clock_out",
      "submit_manual_request",
      "resolve_previous_day_checkout",
      "review_request_status",
      "review_leave_conflict",
      "wait",
    ]);
    expect(requestStatusSchema.options).toEqual([
      "pending",
      "revision_requested",
      "withdrawn",
      "approved",
      "rejected",
    ]);
    expect(attendanceRecordSourceSchema.options).toEqual(["beacon", "manual"]);
    expect(manualAttendanceActionSchema.options).toEqual([
      "clock_in",
      "clock_out",
      "both",
    ]);
    expect(leaveTypeSchema.options).toEqual([
      "annual",
      "half_am",
      "half_pm",
      "hourly",
    ]);
    expect(requestTypeSchema.options).toEqual(["manual_attendance", "leave"]);

    expect(apiDateSchema.parse("2026-03-30")).toBe("2026-03-30");
    expect(apiDateTimeSchema.parse("2026-03-30T09:03:00+09:00")).toBe(
      "2026-03-30T09:03:00+09:00",
    );
  });

  it("parses the documented error envelope", () => {
    expect(
      errorResponseSchema.parse({
        error: {
          code: "validation_error",
          message: "Human-readable summary",
        },
      }),
    ).toEqual({
      error: {
        code: "validation_error",
        message: "Human-readable summary",
      },
    });
  });

  it("requires failureReason to match attendance attempt status", () => {
    expect(() =>
      attendanceTodayResponseSchema.parse({
        date: "2026-03-30",
        employee: {
          id: "emp_001",
          name: "Alex Kim",
          department: "Product",
        },
        expectedWorkday: {
          isWorkday: true,
          expectedClockInAt: "2026-03-30T09:00:00+09:00",
          expectedClockOutAt: "2026-03-30T18:00:00+09:00",
          adjustedClockInAt: "2026-03-30T09:00:00+09:00",
          adjustedClockOutAt: "2026-03-30T18:00:00+09:00",
          countsTowardAdminSummary: true,
          leaveCoverage: null,
        },
        previousDayOpenRecord: null,
        todayRecord: null,
        attempts: [
          {
            id: "attempt_001",
            date: "2026-03-30",
            action: "clock_in",
            attemptedAt: "2026-03-30T09:03:00+09:00",
            status: "failed",
            failureReason: null,
          },
        ],
        manualRequest: null,
        display: {
          phase: "before_check_in",
          flags: [],
          activeExceptions: ["attempt_failed", "not_checked_in"],
          nextAction: {
            type: "clock_in",
            relatedRequestId: null,
          },
        },
      }),
    ).toThrow();

    expect(() =>
      attendanceTodayResponseSchema.parse({
        date: "2026-03-30",
        employee: {
          id: "emp_001",
          name: "Alex Kim",
          department: "Product",
        },
        expectedWorkday: {
          isWorkday: true,
          expectedClockInAt: "2026-03-30T09:00:00+09:00",
          expectedClockOutAt: "2026-03-30T18:00:00+09:00",
          adjustedClockInAt: "2026-03-30T09:00:00+09:00",
          adjustedClockOutAt: "2026-03-30T18:00:00+09:00",
          countsTowardAdminSummary: true,
          leaveCoverage: null,
        },
        previousDayOpenRecord: null,
        todayRecord: null,
        attempts: [
          {
            id: "attempt_001",
            date: "2026-03-30",
            action: "clock_in",
            attemptedAt: "2026-03-30T09:03:00+09:00",
            status: "success",
            failureReason: "BLE beacon not detected",
          },
        ],
        manualRequest: null,
        display: {
          phase: "before_check_in",
          flags: [],
          activeExceptions: [],
          nextAction: {
            type: "clock_in",
            relatedRequestId: null,
          },
        },
      }),
    ).toThrow();
  });

  it("requires active request id and active status to be paired", () => {
    expect(() =>
      requestChainProjectionSchema.parse({
        activeRequestId: null,
        activeStatus: "pending",
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "pending",
        governingReviewComment: null,
        hasActiveFollowUp: false,
        nextAction: "admin_review",
      }),
    ).toThrow();

    expect(() =>
      requestChainProjectionSchema.parse({
        activeRequestId: "req_manual_001",
        activeStatus: null,
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "pending",
        governingReviewComment: null,
        hasActiveFollowUp: false,
        nextAction: "admin_review",
      }),
    ).toThrow();
  });
});

describe("employee attendance contracts", () => {
  it("parses the documented attendance overview response", () => {
    expect(
      attendanceTodayResponseSchema.parse({
        date: "2026-03-30",
        employee: {
          id: "emp_001",
          name: "Alex Kim",
          department: "Product",
        },
        expectedWorkday: {
          isWorkday: true,
          expectedClockInAt: "2026-03-30T09:00:00+09:00",
          expectedClockOutAt: "2026-03-30T18:00:00+09:00",
          adjustedClockInAt: "2026-03-30T09:00:00+09:00",
          adjustedClockOutAt: "2026-03-30T18:00:00+09:00",
          countsTowardAdminSummary: true,
          leaveCoverage: null,
        },
        previousDayOpenRecord: null,
        todayRecord: {
          id: "att_20260330_emp_001",
          date: "2026-03-30",
          clockInAt: "2026-03-30T09:03:00+09:00",
          clockInSource: "beacon",
          clockOutAt: null,
          clockOutSource: null,
          workMinutes: null,
        },
        attempts: [
          {
            id: "attempt_001",
            date: "2026-03-30",
            action: "clock_in",
            attemptedAt: "2026-03-30T09:03:00+09:00",
            status: "success",
            failureReason: null,
          },
        ],
        manualRequest: null,
        display: {
          phase: "working",
          flags: ["late"],
          activeExceptions: [],
          nextAction: {
            type: "clock_out",
            relatedRequestId: null,
          },
        },
      }),
    ).toMatchObject({
      date: "2026-03-30",
      employee: {
        id: "emp_001",
      },
      todayRecord: {
        id: "att_20260330_emp_001",
      },
      display: {
        phase: "working",
      },
    });
  });

  it("rejects approved manualRequest payloads in the attendance today response", () => {
    expect(() =>
      attendanceTodayResponseSchema.parse({
        date: "2026-03-30",
        employee: {
          id: "emp_001",
          name: "Alex Kim",
          department: "Product",
        },
        expectedWorkday: {
          isWorkday: true,
          expectedClockInAt: "2026-03-30T09:00:00+09:00",
          expectedClockOutAt: "2026-03-30T18:00:00+09:00",
          adjustedClockInAt: "2026-03-30T09:00:00+09:00",
          adjustedClockOutAt: "2026-03-30T18:00:00+09:00",
          countsTowardAdminSummary: true,
          leaveCoverage: null,
        },
        previousDayOpenRecord: null,
        todayRecord: null,
        attempts: [],
        manualRequest: {
          id: "req_manual_001",
          requestType: "manual_attendance",
          action: "clock_in",
          date: "2026-03-30",
          requestedAt: "2026-03-30T09:00:00+09:00",
          reason: "Beacon was not detected at the office entrance.",
          status: "approved",
          reviewedAt: "2026-03-30T11:00:00+09:00",
          reviewComment: null,
          governingReviewComment: null,
          rootRequestId: "req_manual_001",
          parentRequestId: null,
          followUpKind: null,
          supersededByRequestId: null,
          activeRequestId: null,
          activeStatus: null,
          effectiveRequestId: "req_manual_001",
          effectiveStatus: "approved",
          hasActiveFollowUp: false,
          nextAction: "none",
        },
        display: {
          phase: "before_check_in",
          flags: [],
          activeExceptions: [],
          nextAction: {
            type: "clock_in",
            relatedRequestId: null,
          },
        },
      }),
    ).toThrow();
  });

  it("requires from and to in the attendance history query", () => {
    expect(() =>
      attendanceHistoryQuerySchema.parse({
        from: "2026-03-24",
      }),
    ).toThrow();
  });

  it("parses the documented attendance history response", () => {
    expect(
      attendanceHistoryResponseSchema.parse({
        from: "2026-03-24",
        to: "2026-03-30",
        records: [
          {
            date: "2026-03-30",
            expectedWorkday: {
              isWorkday: true,
              expectedClockInAt: "2026-03-30T09:00:00+09:00",
              expectedClockOutAt: "2026-03-30T18:00:00+09:00",
              adjustedClockInAt: "2026-03-30T09:00:00+09:00",
              adjustedClockOutAt: "2026-03-30T18:00:00+09:00",
              countsTowardAdminSummary: true,
              leaveCoverage: null,
            },
            record: {
              id: "att_20260330_emp_001",
              date: "2026-03-30",
              clockInAt: "2026-03-30T09:03:00+09:00",
              clockInSource: "beacon",
              clockOutAt: null,
              clockOutSource: null,
              workMinutes: null,
            },
            display: {
              phase: "working",
              flags: ["late"],
              activeExceptions: [],
              nextAction: {
                type: "clock_out",
                relatedRequestId: null,
              },
            },
          },
        ],
      }),
    ).toMatchObject({
      records: [{ display: { phase: "working" } }],
    });
  });

  it("rejects invalid manual attendance actions", () => {
    expect(() =>
      manualAttendanceRequestBodySchema.parse({
        date: "2026-03-30",
        action: "check_in",
        requestedAt: "2026-03-30T09:00:00+09:00",
        reason: "Beacon was not detected at the office entrance.",
      }),
    ).toThrow();
  });

  it("rejects a follow-up kind without a parent request id", () => {
    expect(() =>
      manualAttendanceRequestBodySchema.parse({
        date: "2026-03-30",
        action: "clock_in",
        requestedAt: "2026-03-30T09:00:00+09:00",
        reason: "Beacon was not detected at the office entrance.",
        followUpKind: "resubmission",
      }),
    ).toThrow();
  });

  it("rejects a parent request id without a follow-up kind", () => {
    expect(() =>
      manualAttendanceRequestBodySchema.parse({
        date: "2026-03-30",
        action: "clock_in",
        requestedAt: "2026-03-30T09:00:00+09:00",
        reason: "Beacon was not detected at the office entrance.",
        parentRequestId: "req_manual_000",
      }),
    ).toThrow();
  });

  it("accepts a resubmission only when parent and follow-up fields are paired", () => {
    expect(
      manualAttendanceRequestBodySchema.parse({
        date: "2026-03-30",
        action: "clock_in",
        requestedAt: "2026-03-30T09:00:00+09:00",
        reason: "Beacon was not detected at the office entrance.",
        parentRequestId: "req_manual_000",
        followUpKind: "resubmission",
      }),
    ).toMatchObject({
      parentRequestId: "req_manual_000",
      followUpKind: "resubmission",
    });
  });

  it("parses the documented manual attendance request response", () => {
    expect(
      manualAttendanceRequestResponseSchema.parse({
        id: "req_manual_001",
        requestType: "manual_attendance",
        action: "clock_in",
        date: "2026-03-30",
        requestedAt: "2026-03-30T09:00:00+09:00",
        reason: "Beacon was not detected at the office entrance.",
        status: "pending",
        reviewedAt: null,
        reviewComment: null,
        governingReviewComment: null,
        rootRequestId: "req_manual_001",
        parentRequestId: null,
        followUpKind: null,
        supersededByRequestId: null,
        activeRequestId: "req_manual_001",
        activeStatus: "pending",
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "pending",
        hasActiveFollowUp: false,
        nextAction: "admin_review",
      }),
    ).toMatchObject({
      id: "req_manual_001",
      requestType: "manual_attendance",
      status: "pending",
      effectiveStatus: "pending",
    });
  });

  it("couples reviewed fields to reviewed manual attendance statuses", () => {
    expect(() =>
      manualAttendanceRequestResponseSchema.parse({
        id: "req_manual_001",
        requestType: "manual_attendance",
        action: "clock_in",
        date: "2026-03-30",
        requestedAt: "2026-03-30T09:00:00+09:00",
        reason: "Beacon was not detected at the office entrance.",
        status: "pending",
        reviewedAt: "2026-03-30T11:00:00+09:00",
        reviewComment: null,
        governingReviewComment: null,
        rootRequestId: "req_manual_001",
        parentRequestId: null,
        followUpKind: null,
        supersededByRequestId: null,
        activeRequestId: "req_manual_001",
        activeStatus: "pending",
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "pending",
        hasActiveFollowUp: false,
        nextAction: "admin_review",
      }),
    ).toThrow();

    expect(() =>
      manualAttendanceRequestResponseSchema.parse({
        id: "req_manual_001",
        requestType: "manual_attendance",
        action: "clock_in",
        date: "2026-03-30",
        requestedAt: "2026-03-30T09:00:00+09:00",
        reason: "Beacon was not detected at the office entrance.",
        status: "rejected",
        reviewedAt: null,
        reviewComment: null,
        governingReviewComment: "Please clarify the missing clock-out time.",
        rootRequestId: "req_manual_001",
        parentRequestId: null,
        followUpKind: null,
        supersededByRequestId: null,
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "rejected",
        hasActiveFollowUp: false,
        nextAction: "none",
      }),
    ).toThrow();
  });

  it("rejects unsupported manual-attendance follow-up kinds", () => {
    expect(() =>
      manualAttendanceRequestResponseSchema.parse({
        id: "req_manual_002",
        requestType: "manual_attendance",
        action: "clock_in",
        date: "2026-03-30",
        requestedAt: "2026-03-30T12:00:00+09:00",
        reason: "Updated request after approval.",
        status: "pending",
        reviewedAt: null,
        reviewComment: null,
        governingReviewComment: null,
        rootRequestId: "req_manual_001",
        parentRequestId: "req_manual_001",
        followUpKind: "change",
        supersededByRequestId: null,
        activeRequestId: "req_manual_002",
        activeStatus: "pending",
        effectiveRequestId: "req_manual_002",
        effectiveStatus: "pending",
        hasActiveFollowUp: true,
        nextAction: "admin_review",
      }),
    ).toThrow();
  });

  it("requires manual-attendance relation fields to be paired", () => {
    expect(() =>
      manualAttendanceRequestResponseSchema.parse({
        id: "req_manual_002",
        requestType: "manual_attendance",
        action: "clock_in",
        date: "2026-03-30",
        requestedAt: "2026-03-30T12:00:00+09:00",
        reason: "Follow-up without kind.",
        status: "pending",
        reviewedAt: null,
        reviewComment: null,
        governingReviewComment: null,
        rootRequestId: "req_manual_001",
        parentRequestId: "req_manual_001",
        followUpKind: null,
        supersededByRequestId: null,
        activeRequestId: "req_manual_002",
        activeStatus: "pending",
        effectiveRequestId: "req_manual_002",
        effectiveStatus: "pending",
        hasActiveFollowUp: true,
        nextAction: "admin_review",
      }),
    ).toThrow();

    expect(() =>
      manualAttendanceRequestResponseSchema.parse({
        id: "req_manual_002",
        requestType: "manual_attendance",
        action: "clock_in",
        date: "2026-03-30",
        requestedAt: "2026-03-30T12:00:00+09:00",
        reason: "Follow-up kind without parent.",
        status: "pending",
        reviewedAt: null,
        reviewComment: null,
        governingReviewComment: null,
        rootRequestId: "req_manual_002",
        parentRequestId: null,
        followUpKind: "resubmission",
        supersededByRequestId: null,
        activeRequestId: "req_manual_002",
        activeStatus: "pending",
        effectiveRequestId: "req_manual_002",
        effectiveStatus: "pending",
        hasActiveFollowUp: false,
        nextAction: "admin_review",
      }),
    ).toThrow();
  });
});

describe("leave contracts", () => {
  it("parses the documented leave overview response", () => {
    expect(
      leaveOverviewResponseSchema.parse({
        balance: {
          totalDays: 15,
          usedDays: 4.5,
          remainingDays: 10.5,
        },
        requests: [
          {
            id: "req_leave_001",
            requestType: "leave",
            leaveType: "annual",
            date: "2026-04-02",
            hours: null,
            reason: "Personal appointment",
            status: "pending",
            requestedAt: "2026-03-30T11:10:00+09:00",
            reviewedAt: null,
            rejectionReason: null,
          },
        ],
      }),
    ).toMatchObject({
      balance: {
        remainingDays: 10.5,
      },
      requests: [{ requestType: "leave" }],
    });
  });

  it("requires hours for hourly leave requests", () => {
    expect(() =>
      leaveRequestBodySchema.parse({
        leaveType: "hourly",
        date: "2026-04-03",
        reason: "Medical appointment",
      }),
    ).toThrow();
  });

  it("rejects numeric hours for non-hourly leave requests", () => {
    expect(() =>
      leaveRequestBodySchema.parse({
        leaveType: "annual",
        date: "2026-04-03",
        hours: 3,
        reason: "Medical appointment",
      }),
    ).toThrow();
  });

  it("parses the documented leave request response", () => {
    expect(
      leaveRequestResponseSchema.parse({
        id: "req_leave_002",
        requestType: "leave",
        leaveType: "hourly",
        date: "2026-04-03",
        hours: 2,
        reason: "Medical appointment",
        status: "pending",
        requestedAt: "2026-03-30T11:25:00+09:00",
        reviewedAt: null,
        rejectionReason: null,
      }),
    ).toMatchObject({
      leaveType: "hourly",
      hours: 2,
    });
  });

  it("rejects hourly leave responses without numeric hours", () => {
    expect(() =>
      leaveRequestResponseSchema.parse({
        id: "req_leave_002",
        requestType: "leave",
        leaveType: "hourly",
        date: "2026-04-03",
        hours: null,
        reason: "Medical appointment",
        status: "pending",
        requestedAt: "2026-03-30T11:25:00+09:00",
        reviewedAt: null,
        rejectionReason: null,
      }),
    ).toThrow();
  });

  it("rejects non-hourly leave responses with numeric hours", () => {
    expect(() =>
      leaveRequestResponseSchema.parse({
        id: "req_leave_002",
        requestType: "leave",
        leaveType: "annual",
        date: "2026-04-03",
        hours: 2,
        reason: "Medical appointment",
        status: "pending",
        requestedAt: "2026-03-30T11:25:00+09:00",
        reviewedAt: null,
        rejectionReason: null,
      }),
    ).toThrow();
  });

  it("rejects rejected leave responses without a rejection reason", () => {
    expect(() =>
      leaveRequestResponseSchema.parse({
        id: "req_leave_002",
        requestType: "leave",
        leaveType: "annual",
        date: "2026-04-03",
        hours: null,
        reason: "Medical appointment",
        status: "rejected",
        requestedAt: "2026-03-30T11:25:00+09:00",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        rejectionReason: null,
      }),
    ).toThrow();
  });

  it("rejects approved leave responses with a rejection reason", () => {
    expect(() =>
      leaveRequestResponseSchema.parse({
        id: "req_leave_002",
        requestType: "leave",
        leaveType: "annual",
        date: "2026-04-03",
        hours: null,
        reason: "Medical appointment",
        status: "approved",
        requestedAt: "2026-03-30T11:25:00+09:00",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        rejectionReason: "Should not be present",
      }),
    ).toThrow();
  });
});

describe("admin attendance contracts", () => {
  it("parses the documented today summary response", () => {
    expect(
      adminAttendanceTodayResponseSchema.parse({
        date: "2026-03-30",
        summary: {
          checkedInCount: 8,
          notCheckedInCount: 2,
          lateCount: 1,
          onLeaveCount: 1,
          failedAttemptCount: 1,
          previousDayOpenCount: 1,
        },
        items: [
          {
            employee: {
              id: "emp_001",
              name: "Alex Kim",
              department: "Product",
            },
            expectedWorkday: {
              isWorkday: true,
              expectedClockInAt: "2026-03-30T09:00:00+09:00",
              expectedClockOutAt: "2026-03-30T18:00:00+09:00",
              adjustedClockInAt: "2026-03-30T09:00:00+09:00",
              adjustedClockOutAt: "2026-03-30T18:00:00+09:00",
              countsTowardAdminSummary: true,
              leaveCoverage: null,
            },
            todayRecord: {
              id: "att_20260330_emp_001",
              date: "2026-03-30",
              clockInAt: "2026-03-30T09:03:00+09:00",
              clockInSource: "beacon",
              clockOutAt: null,
              clockOutSource: null,
              workMinutes: null,
            },
            display: {
              phase: "working",
              flags: ["late"],
              activeExceptions: [],
              nextAction: {
                type: "clock_out",
                relatedRequestId: null,
              },
            },
            latestFailedAttempt: null,
            previousDayOpenRecord: null,
            manualRequest: null,
          },
        ],
      }),
    ).toMatchObject({
      summary: {
        checkedInCount: 8,
        failedAttemptCount: 1,
      },
    });
  });

  it("rejects admin today rows whose latestFailedAttempt is not failed", () => {
    expect(() =>
      adminAttendanceTodayResponseSchema.parse({
        date: "2026-03-30",
        summary: {
          checkedInCount: 8,
          notCheckedInCount: 2,
          lateCount: 1,
          onLeaveCount: 1,
          failedAttemptCount: 1,
          previousDayOpenCount: 1,
        },
        items: [
          {
            employee: {
              id: "emp_001",
              name: "Alex Kim",
              department: "Product",
            },
            expectedWorkday: {
              isWorkday: true,
              expectedClockInAt: "2026-03-30T09:00:00+09:00",
              expectedClockOutAt: "2026-03-30T18:00:00+09:00",
              adjustedClockInAt: "2026-03-30T09:00:00+09:00",
              adjustedClockOutAt: "2026-03-30T18:00:00+09:00",
              countsTowardAdminSummary: true,
              leaveCoverage: null,
            },
            todayRecord: null,
            display: {
              phase: "before_check_in",
              flags: [],
              activeExceptions: ["attempt_failed", "not_checked_in"],
              nextAction: {
                type: "clock_in",
                relatedRequestId: null,
              },
            },
            latestFailedAttempt: {
              id: "attempt_001",
              date: "2026-03-30",
              action: "clock_in",
              attemptedAt: "2026-03-30T09:03:00+09:00",
              status: "success",
              failureReason: null,
            },
            previousDayOpenRecord: null,
            manualRequest: null,
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects withdrawn manualRequest payloads in admin today rows", () => {
    expect(() =>
      adminAttendanceTodayResponseSchema.parse({
        date: "2026-03-30",
        summary: {
          checkedInCount: 8,
          notCheckedInCount: 2,
          lateCount: 1,
          onLeaveCount: 1,
          failedAttemptCount: 1,
          previousDayOpenCount: 1,
        },
        items: [
          {
            employee: {
              id: "emp_001",
              name: "Alex Kim",
              department: "Product",
            },
            expectedWorkday: {
              isWorkday: true,
              expectedClockInAt: "2026-03-30T09:00:00+09:00",
              expectedClockOutAt: "2026-03-30T18:00:00+09:00",
              adjustedClockInAt: "2026-03-30T09:00:00+09:00",
              adjustedClockOutAt: "2026-03-30T18:00:00+09:00",
              countsTowardAdminSummary: true,
              leaveCoverage: null,
            },
            todayRecord: null,
            display: {
              phase: "before_check_in",
              flags: [],
              activeExceptions: [],
              nextAction: {
                type: "clock_in",
                relatedRequestId: null,
              },
            },
            latestFailedAttempt: null,
            previousDayOpenRecord: null,
            manualRequest: {
              id: "req_manual_001",
              requestType: "manual_attendance",
              action: "clock_in",
              date: "2026-03-30",
              requestedAt: "2026-03-30T09:00:00+09:00",
              reason: "Beacon was not detected at the office entrance.",
              status: "withdrawn",
              reviewedAt: null,
              reviewComment: null,
              governingReviewComment: null,
              rootRequestId: "req_manual_001",
              parentRequestId: null,
              followUpKind: null,
              supersededByRequestId: null,
              activeRequestId: null,
              activeStatus: null,
              effectiveRequestId: "req_manual_001",
              effectiveStatus: "withdrawn",
              hasActiveFollowUp: false,
              nextAction: "none",
            },
          },
        ],
      }),
    ).toThrow();
  });

  it("parses the documented admin attendance list response and optional name filter", () => {
    expect(
      adminAttendanceListQuerySchema.parse({
        from: "2026-03-01",
        to: "2026-03-30",
        name: "alex",
      }),
    ).toEqual({
      from: "2026-03-01",
      to: "2026-03-30",
      name: "alex",
    });

    expect(
      adminAttendanceListResponseSchema.parse({
        from: "2026-03-01",
        to: "2026-03-30",
        filters: {
          name: "alex",
        },
        total: 22,
        records: [
          {
            date: "2026-03-30",
            employee: {
              id: "emp_001",
              name: "Alex Kim",
              department: "Product",
            },
            expectedWorkday: {
              isWorkday: true,
              expectedClockInAt: "2026-03-30T09:00:00+09:00",
              expectedClockOutAt: "2026-03-30T18:00:00+09:00",
              adjustedClockInAt: "2026-03-30T09:00:00+09:00",
              adjustedClockOutAt: "2026-03-30T18:00:00+09:00",
              countsTowardAdminSummary: true,
              leaveCoverage: null,
            },
            record: {
              id: "att_20260330_emp_001",
              date: "2026-03-30",
              clockInAt: "2026-03-30T09:03:00+09:00",
              clockInSource: "beacon",
              clockOutAt: null,
              clockOutSource: null,
              workMinutes: null,
            },
            display: {
              phase: "working",
              flags: ["late"],
              activeExceptions: [],
              nextAction: {
                type: "clock_out",
                relatedRequestId: null,
              },
            },
            latestFailedAttempt: null,
          },
        ],
      }),
    ).toMatchObject({
      total: 22,
      records: [{ employee: { id: "emp_001" } }],
    });
  });
});

describe("admin request-review contracts", () => {
  it("rejects unknown request filters", () => {
    expect(() =>
      adminRequestsQuerySchema.parse({
        status: "archived",
      }),
    ).toThrow();
  });

  it("parses the documented request queue response", () => {
    expect(
      adminRequestsResponseSchema.parse({
        statusFilter: "pending",
        items: [
          {
            id: "req_manual_001",
            employee: {
              id: "emp_001",
              name: "Alex Kim",
              department: "Product",
            },
            requestType: "manual_attendance",
            subtype: "clock_in",
            targetDate: "2026-03-30",
            reason: "Beacon was not detected at the office entrance.",
            status: "pending",
            requestedAt: "2026-03-30T09:10:00+09:00",
            reviewedAt: null,
            rejectionReason: null,
          },
        ],
      }),
    ).toMatchObject({
      items: [{ requestType: "manual_attendance" }],
    });
  });

  it("rejects leave queue items with manual attendance subtypes", () => {
    expect(() =>
      adminRequestsResponseSchema.parse({
        statusFilter: "pending",
        items: [
          {
            id: "req_leave_001",
            employee: {
              id: "emp_001",
              name: "Alex Kim",
              department: "Product",
            },
            requestType: "leave",
            subtype: "clock_in",
            targetDate: "2026-03-30",
            reason: "Medical appointment",
            status: "pending",
            requestedAt: "2026-03-30T09:10:00+09:00",
            reviewedAt: null,
            rejectionReason: null,
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects rejected queue items without a rejection reason", () => {
    expect(() =>
      adminRequestsResponseSchema.parse({
        statusFilter: "rejected",
        items: [
          {
            id: "req_manual_001",
            employee: {
              id: "emp_001",
              name: "Alex Kim",
              department: "Product",
            },
            requestType: "manual_attendance",
            subtype: "clock_in",
            targetDate: "2026-03-30",
            reason: "Beacon was not detected at the office entrance.",
            status: "rejected",
            requestedAt: "2026-03-30T09:10:00+09:00",
            reviewedAt: "2026-03-30T13:15:00+09:00",
            rejectionReason: null,
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects approved queue items with a rejection reason", () => {
    expect(() =>
      adminRequestsResponseSchema.parse({
        statusFilter: "approved",
        items: [
          {
            id: "req_leave_001",
            employee: {
              id: "emp_001",
              name: "Alex Kim",
              department: "Product",
            },
            requestType: "leave",
            subtype: "annual",
            targetDate: "2026-03-30",
            reason: "Medical appointment",
            status: "approved",
            requestedAt: "2026-03-30T09:10:00+09:00",
            reviewedAt: "2026-03-30T13:15:00+09:00",
            rejectionReason: "Should not be present",
          },
        ],
      }),
    ).toThrow();
  });

  it("requires an explicit approve or reject decision", () => {
    expect(() =>
      adminRequestDecisionBodySchema.parse({
        decision: "approved",
      }),
    ).toThrow();
  });

  it("requires a rejection reason when rejecting a request", () => {
    expect(() =>
      adminRequestDecisionBodySchema.parse({
        decision: "reject",
      }),
    ).toThrow();
  });

  it("rejects rejection reasons on approve decisions", () => {
    expect(() =>
      adminRequestDecisionBodySchema.parse({
        decision: "approve",
        rejectionReason: "This should not be sent for approvals.",
      }),
    ).toThrow();
  });

  it("parses the documented request decision response", () => {
    expect(
      adminRequestDecisionResponseSchema.parse({
        id: "req_manual_001",
        requestType: "manual_attendance",
        status: "rejected",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        rejectionReason: "Please clarify the missing clock-out time.",
      }),
    ).toMatchObject({
      status: "rejected",
    });
  });

  it("rejects pending statuses in request decision responses", () => {
    expect(() =>
      adminRequestDecisionResponseSchema.parse({
        id: "req_manual_001",
        requestType: "manual_attendance",
        status: "pending",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        rejectionReason: null,
      }),
    ).toThrow();
  });

  it("rejects rejected decision responses without a rejection reason", () => {
    expect(() =>
      adminRequestDecisionResponseSchema.parse({
        id: "req_manual_001",
        requestType: "manual_attendance",
        status: "rejected",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        rejectionReason: null,
      }),
    ).toThrow();
  });

  it("rejects rejected decision responses with an empty rejection reason", () => {
    expect(() =>
      adminRequestDecisionResponseSchema.parse({
        id: "req_manual_001",
        requestType: "manual_attendance",
        status: "rejected",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        rejectionReason: "   ",
      }),
    ).toThrow();
  });
});
