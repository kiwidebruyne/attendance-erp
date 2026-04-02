import { describe, expect, it } from "vitest";

import {
  adminAttendanceListQuerySchema,
  adminAttendanceListResponseSchema,
  adminAttendanceTodayResponseSchema,
} from "@/lib/contracts/admin-attendance";
import * as attendanceContracts from "@/lib/contracts/attendance";
import {
  attendanceHistoryQuerySchema,
  attendanceHistoryResponseSchema,
  attendanceTodayResponseSchema,
  manualAttendanceRequestBodySchema,
  manualAttendanceRequestResponseSchema,
} from "@/lib/contracts/attendance";
import * as leaveContracts from "@/lib/contracts/leave";
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

  it("parses the documented error envelope extension for duplicate leave follow-ups", () => {
    expect(
      errorResponseSchema.parse({
        error: {
          code: "conflict",
          message: "Active follow-up already exists.",
          activeRequestId: "leave_request_emp_001_2026-04-14_change",
        },
      }),
    ).toEqual({
      error: {
        code: "conflict",
        message: "Active follow-up already exists.",
        activeRequestId: "leave_request_emp_001_2026-04-14_change",
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

  it("requires an active request when a follow-up is marked active", () => {
    expect(() =>
      requestChainProjectionSchema.parse({
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "req_manual_002",
        effectiveStatus: "pending",
        governingReviewComment: "Please attach the beacon retry details.",
        hasActiveFollowUp: true,
        nextAction: "admin_review",
      }),
    ).toThrow();
  });

  it("requires active follow-up projections to stay pending", () => {
    expect(() =>
      requestChainProjectionSchema.parse({
        activeRequestId: "req_manual_002",
        activeStatus: "approved",
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "approved",
        governingReviewComment: null,
        hasActiveFollowUp: true,
        nextAction: "none",
      }),
    ).toThrow();
  });

  it("requires any active request projection to stay pending", () => {
    expect(() =>
      requestChainProjectionSchema.parse({
        activeRequestId: "req_manual_001",
        activeStatus: "approved",
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "approved",
        governingReviewComment: null,
        hasActiveFollowUp: false,
        nextAction: "none",
      }),
    ).toThrow();
  });

  it("requires effective request fields to match active work", () => {
    expect(() =>
      requestChainProjectionSchema.parse({
        activeRequestId: "req_manual_002",
        activeStatus: "pending",
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "rejected",
        governingReviewComment: "Please attach the beacon retry details.",
        hasActiveFollowUp: true,
        nextAction: "admin_review",
      }),
    ).toThrow();
  });

  it("rejects approved effective projections that still point at the active request", () => {
    expect(() =>
      requestChainProjectionSchema.parse({
        activeRequestId: "req_leave_002",
        activeStatus: "pending",
        effectiveRequestId: "req_leave_002",
        effectiveStatus: "approved",
        governingReviewComment: null,
        hasActiveFollowUp: true,
        nextAction: "admin_review",
      }),
    ).toThrow();
  });

  it("requires approved effective projections with active work to mark an active follow-up", () => {
    expect(() =>
      requestChainProjectionSchema.parse({
        activeRequestId: "req_leave_002",
        activeStatus: "pending",
        effectiveRequestId: "req_leave_001",
        effectiveStatus: "approved",
        governingReviewComment: null,
        hasActiveFollowUp: false,
        nextAction: "admin_review",
      }),
    ).toThrow();
  });

  it("rejects governing review comments on approved effective active chains", () => {
    expect(() =>
      requestChainProjectionSchema.parse({
        activeRequestId: "req_leave_002",
        activeStatus: "pending",
        effectiveRequestId: "req_leave_001",
        effectiveStatus: "approved",
        governingReviewComment: "Please clarify the earlier mismatch.",
        hasActiveFollowUp: true,
        nextAction: "admin_review",
      }),
    ).toThrow();
  });

  it("allows governing review comments on completed approved chains", () => {
    expect(
      requestChainProjectionSchema.parse({
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "req_leave_001",
        effectiveStatus: "approved",
        governingReviewComment:
          "Please keep the original approved interval until the change is corrected.",
        hasActiveFollowUp: false,
        nextAction: "none",
      }),
    ).toMatchObject({
      effectiveStatus: "approved",
    });
  });

  it("requires governing review comments for unresolved non-approved chains", () => {
    expect(() =>
      requestChainProjectionSchema.parse({
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "rejected",
        governingReviewComment: null,
        hasActiveFollowUp: false,
        nextAction: "none",
      }),
    ).toThrow();
  });

  it("requires nextAction to match whether active work exists", () => {
    expect(() =>
      requestChainProjectionSchema.parse({
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "rejected",
        governingReviewComment: "Please attach the beacon retry details.",
        hasActiveFollowUp: false,
        nextAction: "admin_review",
      }),
    ).toThrow();

    expect(() =>
      requestChainProjectionSchema.parse({
        activeRequestId: "req_manual_002",
        activeStatus: "pending",
        effectiveRequestId: "req_manual_002",
        effectiveStatus: "pending",
        governingReviewComment: null,
        hasActiveFollowUp: true,
        nextAction: "none",
      }),
    ).toThrow();
  });

  it("rejects pending effective status when no active request exists", () => {
    expect(() =>
      requestChainProjectionSchema.parse({
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "pending",
        governingReviewComment: null,
        hasActiveFollowUp: false,
        nextAction: "none",
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
          submittedAt: "2026-03-30T09:10:00+09:00",
          requestedClockInAt: "2026-03-30T09:00:00+09:00",
          requestedClockOutAt: null,
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

  it("accepts the documented manual attendance create payload", () => {
    expect(
      manualAttendanceRequestBodySchema.parse({
        date: "2026-03-30",
        action: "clock_in",
        requestedClockInAt: "2026-03-30T09:00:00+09:00",
        reason: "Beacon was not detected at the office entrance.",
      }),
    ).toMatchObject({
      action: "clock_in",
      requestedClockInAt: "2026-03-30T09:00:00+09:00",
    });
  });

  it("rejects invalid manual attendance actions", () => {
    expect(() =>
      manualAttendanceRequestBodySchema.parse({
        date: "2026-03-30",
        action: "check_in",
        requestedClockInAt: "2026-03-30T09:00:00+09:00",
        reason: "Beacon was not detected at the office entrance.",
      }),
    ).toThrow();
  });

  it("rejects stale requestedAt write assumptions for manual attendance", () => {
    expect(() =>
      manualAttendanceRequestBodySchema.parse({
        date: "2026-03-30",
        action: "clock_in",
        requestedAt: "2026-03-30T09:00:00+09:00",
        reason: "Beacon was not detected at the office entrance.",
      }),
    ).toThrow();
  });

  it("requires action-specific clock fields for manual attendance requests", () => {
    expect(() =>
      manualAttendanceRequestBodySchema.parse({
        date: "2026-03-30",
        action: "clock_in",
        reason: "Beacon was not detected at the office entrance.",
      }),
    ).toThrow();

    expect(() =>
      manualAttendanceRequestBodySchema.parse({
        date: "2026-03-30",
        action: "clock_in",
        requestedClockInAt: "2026-03-30T09:00:00+09:00",
        requestedClockOutAt: "2026-03-30T18:00:00+09:00",
        reason: "Beacon was not detected at the office entrance.",
      }),
    ).toThrow();
  });

  it("rejects a follow-up kind without a parent request id", () => {
    expect(() =>
      manualAttendanceRequestBodySchema.parse({
        date: "2026-03-30",
        action: "clock_in",
        requestedClockInAt: "2026-03-30T09:00:00+09:00",
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
        requestedClockInAt: "2026-03-30T09:00:00+09:00",
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
        requestedClockInAt: "2026-03-30T09:00:00+09:00",
        reason: "Beacon was not detected at the office entrance.",
        parentRequestId: "req_manual_000",
        followUpKind: "resubmission",
      }),
    ).toMatchObject({
      parentRequestId: "req_manual_000",
      followUpKind: "resubmission",
    });
  });

  it("exposes a patch schema for manual attendance updates", () => {
    expect(
      attendanceContracts.manualAttendanceRequestPatchBodySchema,
    ).toBeDefined();

    expect(
      attendanceContracts.manualAttendanceRequestPatchBodySchema?.parse({
        reason: "Beacon failed again; correcting the note before review.",
      }),
    ).toMatchObject({
      reason: "Beacon failed again; correcting the note before review.",
    });
  });

  it("rejects manual attendance withdrawals that also edit fields", () => {
    expect(
      attendanceContracts.manualAttendanceRequestPatchBodySchema,
    ).toBeDefined();

    expect(() =>
      attendanceContracts.manualAttendanceRequestPatchBodySchema?.parse({
        status: "withdrawn",
        reason: "This should not be sent together.",
      }),
    ).toThrow();
  });

  it("rejects manual attendance patch bodies with action-specific clock mismatches", () => {
    expect(
      attendanceContracts.manualAttendanceRequestPatchBodySchema,
    ).toBeDefined();

    expect(() =>
      attendanceContracts.manualAttendanceRequestPatchBodySchema?.parse({
        action: "clock_out",
        requestedClockInAt: "2026-03-30T18:00:00+09:00",
      }),
    ).toThrow();

    expect(() =>
      attendanceContracts.manualAttendanceRequestPatchBodySchema?.parse({
        action: "clock_in",
        requestedClockOutAt: "2026-03-30T18:00:00+09:00",
      }),
    ).toThrow();
  });

  it("allows partial manual attendance action edits when provided fields stay compatible", () => {
    expect(
      attendanceContracts.manualAttendanceRequestPatchBodySchema,
    ).toBeDefined();

    expect(
      attendanceContracts.manualAttendanceRequestPatchBodySchema?.parse({
        action: "both",
        requestedClockOutAt: "2026-03-30T18:00:00+09:00",
      }),
    ).toMatchObject({
      action: "both",
      requestedClockOutAt: "2026-03-30T18:00:00+09:00",
    });
  });

  it("parses the documented manual attendance request response", () => {
    expect(
      manualAttendanceRequestResponseSchema.parse({
        id: "req_manual_001",
        requestType: "manual_attendance",
        action: "clock_in",
        date: "2026-03-30",
        submittedAt: "2026-03-30T09:10:00+09:00",
        requestedClockInAt: "2026-03-30T09:00:00+09:00",
        requestedClockOutAt: null,
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
        submittedAt: "2026-03-30T09:10:00+09:00",
        requestedClockInAt: "2026-03-30T09:00:00+09:00",
        requestedClockOutAt: null,
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
        submittedAt: "2026-03-30T09:10:00+09:00",
        requestedClockInAt: "2026-03-30T09:00:00+09:00",
        requestedClockOutAt: null,
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
        submittedAt: "2026-03-30T12:10:00+09:00",
        requestedClockInAt: "2026-03-30T12:00:00+09:00",
        requestedClockOutAt: null,
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

  it("rejects manual-attendance responses with approved effective state during active work", () => {
    expect(() =>
      manualAttendanceRequestResponseSchema.parse({
        id: "req_manual_002",
        requestType: "manual_attendance",
        action: "clock_in",
        date: "2026-03-30",
        submittedAt: "2026-03-30T12:10:00+09:00",
        requestedClockInAt: "2026-03-30T12:00:00+09:00",
        requestedClockOutAt: null,
        reason: "Resubmitting the corrected clock-in time.",
        status: "pending",
        reviewedAt: null,
        reviewComment: null,
        governingReviewComment: null,
        rootRequestId: "req_manual_001",
        parentRequestId: "req_manual_001",
        followUpKind: "resubmission",
        supersededByRequestId: null,
        activeRequestId: "req_manual_002",
        activeStatus: "pending",
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "approved",
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
        submittedAt: "2026-03-30T12:10:00+09:00",
        requestedClockInAt: "2026-03-30T12:00:00+09:00",
        requestedClockOutAt: null,
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
        submittedAt: "2026-03-30T12:10:00+09:00",
        requestedClockInAt: "2026-03-30T12:00:00+09:00",
        requestedClockOutAt: null,
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

  it("enforces manual-attendance root request invariants", () => {
    expect(() =>
      manualAttendanceRequestResponseSchema.parse({
        id: "req_manual_001",
        requestType: "manual_attendance",
        action: "clock_in",
        date: "2026-03-30",
        submittedAt: "2026-03-30T09:10:00+09:00",
        requestedClockInAt: "2026-03-30T09:00:00+09:00",
        requestedClockOutAt: null,
        reason: "Root request with the wrong root chain id.",
        status: "pending",
        reviewedAt: null,
        reviewComment: null,
        governingReviewComment: null,
        rootRequestId: "req_manual_999",
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
        id: "req_manual_002",
        requestType: "manual_attendance",
        action: "clock_in",
        date: "2026-03-30",
        submittedAt: "2026-03-30T12:10:00+09:00",
        requestedClockInAt: "2026-03-30T12:00:00+09:00",
        requestedClockOutAt: null,
        reason: "Follow-up with its own id as the root id.",
        status: "pending",
        reviewedAt: null,
        reviewComment: null,
        governingReviewComment: null,
        rootRequestId: "req_manual_002",
        parentRequestId: "req_manual_001",
        followUpKind: "resubmission",
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
});

describe("leave contracts", () => {
  it("exposes a leave overview query schema", () => {
    expect(leaveContracts.leaveOverviewQuerySchema).toBeDefined();

    expect(leaveContracts.leaveOverviewQuerySchema?.parse({})).toEqual({});
    expect(
      leaveContracts.leaveOverviewQuerySchema?.parse({
        date: "2026-04-08",
      }),
    ).toEqual({
      date: "2026-04-08",
    });
  });

  it("parses the documented leave overview response", () => {
    expect(
      leaveOverviewResponseSchema.parse({
        balance: {
          totalDays: 15,
          usedDays: 4.5,
          remainingDays: 10.5,
        },
        selectedDateContext: {
          date: "2026-04-08",
          leaveConflict: {
            companyEventContext: [],
            effectiveApprovedLeaveContext: [],
            pendingLeaveContext: [],
            staffingRisk: "warning",
            requiresApprovalConfirmation: true,
          },
        },
        requests: [
          {
            id: "req_leave_002",
            requestType: "leave",
            leaveType: "hourly",
            date: "2026-04-03",
            startAt: "2026-04-03T13:00:00+09:00",
            endAt: "2026-04-03T15:00:00+09:00",
            hours: 2,
            reason: "Personal appointment moved later.",
            status: "pending",
            requestedAt: "2026-03-30T11:25:00+09:00",
            reviewedAt: null,
            reviewComment: null,
            governingReviewComment: null,
            rootRequestId: "req_leave_001",
            parentRequestId: "req_leave_001",
            followUpKind: "change",
            supersededByRequestId: null,
            activeRequestId: "req_leave_002",
            activeStatus: "pending",
            effectiveRequestId: "req_leave_001",
            effectiveStatus: "approved",
            hasActiveFollowUp: true,
            nextAction: "admin_review",
            isTopSurfaceSuppressed: false,
          },
        ],
      }),
    ).toMatchObject({
      balance: {
        remainingDays: 10.5,
      },
      selectedDateContext: {
        date: "2026-04-08",
      },
      requests: [{ requestType: "leave", isTopSurfaceSuppressed: false }],
    });
  });

  it("requires startAt and endAt for hourly leave requests", () => {
    expect(() =>
      leaveRequestBodySchema.parse({
        leaveType: "hourly",
        date: "2026-04-03",
        reason: "Medical appointment",
      }),
    ).toThrow();
  });

  it("rejects stale hours write input for leave requests", () => {
    expect(() =>
      leaveRequestBodySchema.parse({
        leaveType: "hourly",
        date: "2026-04-03",
        startAt: "2026-04-03T13:00:00+09:00",
        endAt: "2026-04-03T15:00:00+09:00",
        hours: 2,
        reason: "Medical appointment",
      }),
    ).toThrow();
  });

  it("accepts the documented hourly leave request body", () => {
    expect(
      leaveRequestBodySchema.parse({
        leaveType: "hourly",
        date: "2026-04-03",
        startAt: "2026-04-03T13:00:00+09:00",
        endAt: "2026-04-03T15:00:00+09:00",
        reason: "Medical appointment moved later.",
        parentRequestId: "req_leave_001",
        followUpKind: "change",
      }),
    ).toMatchObject({
      leaveType: "hourly",
      followUpKind: "change",
    });
  });

  it("rejects hourly leave request bodies with inverted intervals", () => {
    expect(() =>
      leaveRequestBodySchema.parse({
        leaveType: "hourly",
        date: "2026-04-03",
        startAt: "2026-04-03T15:00:00+09:00",
        endAt: "2026-04-03T13:00:00+09:00",
        reason: "Medical appointment moved later.",
      }),
    ).toThrow();
  });

  it("requires leave follow-up fields to be paired", () => {
    expect(() =>
      leaveRequestBodySchema.parse({
        leaveType: "annual",
        date: "2026-04-03",
        reason: "Medical appointment",
        followUpKind: "resubmission",
      }),
    ).toThrow();

    expect(() =>
      leaveRequestBodySchema.parse({
        leaveType: "annual",
        date: "2026-04-03",
        reason: "Medical appointment",
        parentRequestId: "req_leave_001",
      }),
    ).toThrow();
  });

  it("rejects self-referential leave follow-up parent links", () => {
    expect(() =>
      leaveRequestResponseSchema.parse({
        id: "req_leave_002",
        requestType: "leave",
        leaveType: "hourly",
        date: "2026-04-03",
        startAt: "2026-04-03T13:00:00+09:00",
        endAt: "2026-04-03T15:00:00+09:00",
        hours: 2,
        reason: "Medical appointment moved later.",
        status: "pending",
        requestedAt: "2026-03-30T11:25:00+09:00",
        reviewedAt: null,
        reviewComment: null,
        governingReviewComment: null,
        rootRequestId: "req_leave_001",
        parentRequestId: "req_leave_002",
        followUpKind: "change",
        supersededByRequestId: null,
        activeRequestId: "req_leave_002",
        activeStatus: "pending",
        effectiveRequestId: "req_leave_002",
        effectiveStatus: "pending",
        hasActiveFollowUp: true,
        nextAction: "admin_review",
      }),
    ).toThrow();
  });

  it("exposes a leave patch schema", () => {
    expect(leaveContracts.leaveRequestPatchBodySchema).toBeDefined();

    expect(
      leaveContracts.leaveRequestPatchBodySchema?.parse({
        startAt: "2026-04-03T12:00:00+09:00",
        endAt: "2026-04-03T15:00:00+09:00",
        reason: "The appointment window expanded.",
      }),
    ).toMatchObject({
      reason: "The appointment window expanded.",
    });
  });

  it("rejects leave withdrawals that also edit fields", () => {
    expect(leaveContracts.leaveRequestPatchBodySchema).toBeDefined();

    expect(() =>
      leaveContracts.leaveRequestPatchBodySchema?.parse({
        status: "withdrawn",
        reason: "This should not be sent together.",
      }),
    ).toThrow();
  });

  it("rejects leave patch bodies that mix non-hourly leave types with hourly fields", () => {
    expect(leaveContracts.leaveRequestPatchBodySchema).toBeDefined();

    expect(() =>
      leaveContracts.leaveRequestPatchBodySchema?.parse({
        leaveType: "annual",
        startAt: "2026-04-03T12:00:00+09:00",
      }),
    ).toThrow();

    expect(() =>
      leaveContracts.leaveRequestPatchBodySchema?.parse({
        leaveType: "half_day_am",
        endAt: "2026-04-03T15:00:00+09:00",
      }),
    ).toThrow();
  });

  it("rejects leave patch bodies with inverted hourly intervals", () => {
    expect(leaveContracts.leaveRequestPatchBodySchema).toBeDefined();

    expect(() =>
      leaveContracts.leaveRequestPatchBodySchema?.parse({
        startAt: "2026-04-03T15:00:00+09:00",
        endAt: "2026-04-03T13:00:00+09:00",
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
        startAt: "2026-04-03T13:00:00+09:00",
        endAt: "2026-04-03T15:00:00+09:00",
        hours: 2,
        reason: "Medical appointment moved later.",
        status: "pending",
        requestedAt: "2026-03-30T11:25:00+09:00",
        reviewedAt: null,
        reviewComment: null,
        governingReviewComment: null,
        rootRequestId: "req_leave_001",
        parentRequestId: "req_leave_001",
        followUpKind: "change",
        supersededByRequestId: null,
        activeRequestId: "req_leave_002",
        activeStatus: "pending",
        effectiveRequestId: "req_leave_001",
        effectiveStatus: "approved",
        hasActiveFollowUp: true,
        nextAction: "admin_review",
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
        startAt: "2026-04-03T13:00:00+09:00",
        endAt: "2026-04-03T15:00:00+09:00",
        hours: null,
        reason: "Medical appointment",
        status: "pending",
        requestedAt: "2026-03-30T11:25:00+09:00",
        reviewedAt: null,
        reviewComment: null,
        governingReviewComment: null,
        rootRequestId: "req_leave_002",
        parentRequestId: null,
        followUpKind: null,
        supersededByRequestId: null,
        activeRequestId: "req_leave_002",
        activeStatus: "pending",
        effectiveRequestId: "req_leave_002",
        effectiveStatus: "pending",
        hasActiveFollowUp: false,
        nextAction: "admin_review",
      }),
    ).toThrow();
  });

  it("rejects non-hourly leave responses with hourly intervals", () => {
    expect(() =>
      leaveRequestResponseSchema.parse({
        id: "req_leave_002",
        requestType: "leave",
        leaveType: "annual",
        date: "2026-04-03",
        startAt: "2026-04-03T13:00:00+09:00",
        endAt: "2026-04-03T15:00:00+09:00",
        hours: null,
        reason: "Medical appointment",
        status: "pending",
        requestedAt: "2026-03-30T11:25:00+09:00",
        reviewedAt: null,
        reviewComment: null,
        governingReviewComment: null,
        rootRequestId: "req_leave_002",
        parentRequestId: null,
        followUpKind: null,
        supersededByRequestId: null,
        activeRequestId: "req_leave_002",
        activeStatus: "pending",
        effectiveRequestId: "req_leave_002",
        effectiveStatus: "pending",
        hasActiveFollowUp: false,
        nextAction: "admin_review",
      }),
    ).toThrow();
  });

  it("rejects rejected leave responses without a review comment", () => {
    expect(() =>
      leaveRequestResponseSchema.parse({
        id: "req_leave_002",
        requestType: "leave",
        leaveType: "annual",
        date: "2026-04-03",
        startAt: null,
        endAt: null,
        hours: null,
        reason: "Medical appointment",
        status: "rejected",
        requestedAt: "2026-03-30T11:25:00+09:00",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        reviewComment: null,
        governingReviewComment: "Please clarify the leave window.",
        rootRequestId: "req_leave_002",
        parentRequestId: null,
        followUpKind: null,
        supersededByRequestId: null,
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "req_leave_002",
        effectiveStatus: "rejected",
        hasActiveFollowUp: false,
        nextAction: "none",
      }),
    ).toThrow();
  });

  it("rejects approved leave responses with a review comment", () => {
    expect(() =>
      leaveRequestResponseSchema.parse({
        id: "req_leave_002",
        requestType: "leave",
        leaveType: "annual",
        date: "2026-04-03",
        startAt: null,
        endAt: null,
        hours: null,
        reason: "Medical appointment",
        status: "approved",
        requestedAt: "2026-03-30T11:25:00+09:00",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        reviewComment: "Should not be present",
        governingReviewComment: null,
        rootRequestId: "req_leave_002",
        parentRequestId: null,
        followUpKind: null,
        supersededByRequestId: null,
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "req_leave_002",
        effectiveStatus: "approved",
        hasActiveFollowUp: false,
        nextAction: "none",
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
              submittedAt: "2026-03-30T09:10:00+09:00",
              requestedClockInAt: "2026-03-30T09:00:00+09:00",
              requestedClockOutAt: null,
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
  it("rejects legacy request filters", () => {
    expect(() =>
      adminRequestsQuerySchema.parse({
        status: "pending",
      }),
    ).toThrow();
  });

  it("parses the documented request queue response", () => {
    expect(
      adminRequestsResponseSchema.parse({
        viewFilter: "needs_review",
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
            submittedAt: "2026-03-30T09:10:00+09:00",
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
        viewFilter: "needs_review",
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
            reviewComment: null,
            governingReviewComment: null,
            rootRequestId: "req_leave_001",
            parentRequestId: null,
            followUpKind: null,
            supersededByRequestId: null,
            activeRequestId: "req_leave_001",
            activeStatus: "pending",
            effectiveRequestId: "req_leave_001",
            effectiveStatus: "pending",
            hasActiveFollowUp: false,
            nextAction: "admin_review",
          },
        ],
      }),
    ).toThrow();
  });

  it("parses leave queue items with leave conflict context", () => {
    expect(
      adminRequestsResponseSchema.parse({
        viewFilter: "all",
        items: [
          {
            id: "req_leave_002",
            employee: {
              id: "emp_001",
              name: "Alex Kim",
              department: "Product",
            },
            requestType: "leave",
            subtype: "hourly",
            targetDate: "2026-04-03",
            reason: "Medical appointment moved later.",
            status: "pending",
            requestedAt: "2026-03-30T11:25:00+09:00",
            reviewedAt: null,
            reviewComment: null,
            governingReviewComment: null,
            rootRequestId: "req_leave_001",
            parentRequestId: "req_leave_001",
            followUpKind: "change",
            supersededByRequestId: null,
            activeRequestId: "req_leave_002",
            activeStatus: "pending",
            effectiveRequestId: "req_leave_001",
            effectiveStatus: "approved",
            hasActiveFollowUp: true,
            nextAction: "admin_review",
            leaveConflict: {
              companyEventContext: [],
              effectiveApprovedLeaveContext: [],
              pendingLeaveContext: [],
              staffingRisk: "warning",
              requiresApprovalConfirmation: true,
            },
          },
        ],
      }),
    ).toMatchObject({
      items: [{ requestType: "leave" }],
    });
  });

  it("rejects reviewed non-approved queue items without a review comment", () => {
    expect(() =>
      adminRequestsResponseSchema.parse({
        viewFilter: "completed",
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
            submittedAt: "2026-03-30T09:10:00+09:00",
            reviewedAt: "2026-03-30T13:15:00+09:00",
            reviewComment: null,
            governingReviewComment:
              "Please clarify the missing clock-out time.",
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
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects approved queue items with a review comment", () => {
    expect(() =>
      adminRequestsResponseSchema.parse({
        viewFilter: "completed",
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
            reviewComment: "Should not be present",
            governingReviewComment: null,
            rootRequestId: "req_leave_001",
            parentRequestId: null,
            followUpKind: null,
            supersededByRequestId: null,
            activeRequestId: null,
            activeStatus: null,
            effectiveRequestId: "req_leave_001",
            effectiveStatus: "approved",
            hasActiveFollowUp: false,
            nextAction: "none",
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

  it("requires a review comment when requesting revision", () => {
    expect(() =>
      adminRequestDecisionBodySchema.parse({
        decision: "request_revision",
      }),
    ).toThrow();
  });

  it("rejects rejection reasons on approve decisions", () => {
    expect(() =>
      adminRequestDecisionBodySchema.parse({
        decision: "approve",
        reviewComment: "This should not be sent for approvals.",
      }),
    ).toThrow();
  });

  it("parses the documented request decision response", () => {
    expect(
      adminRequestDecisionResponseSchema.parse({
        id: "req_manual_001",
        requestType: "manual_attendance",
        status: "revision_requested",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        reviewComment: "Please clarify the missing clock-out time.",
        governingReviewComment: "Please clarify the missing clock-out time.",
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "revision_requested",
        hasActiveFollowUp: false,
        nextAction: "none",
      }),
    ).toMatchObject({
      status: "revision_requested",
    });
  });

  it("allows leave decision responses to keep the prior approval effective", () => {
    expect(
      adminRequestDecisionResponseSchema.parse({
        id: "req_leave_002",
        requestType: "leave",
        status: "rejected",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        reviewComment:
          "The original approved leave remains effective until a corrected follow-up is submitted.",
        governingReviewComment:
          "The original approved leave remains effective until a corrected follow-up is submitted.",
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "req_leave_001",
        effectiveStatus: "approved",
        hasActiveFollowUp: false,
        nextAction: "none",
      }),
    ).toMatchObject({
      status: "rejected",
      effectiveStatus: "approved",
    });
  });

  it("rejects pending statuses in request decision responses", () => {
    expect(() =>
      adminRequestDecisionResponseSchema.parse({
        id: "req_manual_001",
        requestType: "manual_attendance",
        status: "pending",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        reviewComment: null,
        governingReviewComment: null,
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "pending",
        hasActiveFollowUp: false,
        nextAction: "none",
      }),
    ).toThrow();
  });

  it("rejects manual-attendance decision responses that keep a prior approval effective", () => {
    expect(() =>
      adminRequestDecisionResponseSchema.parse({
        id: "req_manual_002",
        requestType: "manual_attendance",
        status: "rejected",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        reviewComment:
          "Manual attendance follow-ups cannot keep an earlier approval effective.",
        governingReviewComment:
          "Manual attendance follow-ups cannot keep an earlier approval effective.",
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "approved",
        hasActiveFollowUp: false,
        nextAction: "none",
      }),
    ).toThrow();
  });

  it("rejects decision responses that keep active request fields populated", () => {
    expect(() =>
      adminRequestDecisionResponseSchema.parse({
        id: "req_leave_002",
        requestType: "leave",
        status: "approved",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        reviewComment: null,
        governingReviewComment: null,
        activeRequestId: "req_leave_003",
        activeStatus: "pending",
        effectiveRequestId: "req_leave_002",
        effectiveStatus: "approved",
        hasActiveFollowUp: true,
        nextAction: "admin_review",
      }),
    ).toThrow();
  });

  it("rejects revision-requested decision responses without a review comment", () => {
    expect(() =>
      adminRequestDecisionResponseSchema.parse({
        id: "req_manual_001",
        requestType: "manual_attendance",
        status: "revision_requested",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        reviewComment: null,
        governingReviewComment: "Please clarify the missing clock-out time.",
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "revision_requested",
        hasActiveFollowUp: false,
        nextAction: "none",
      }),
    ).toThrow();
  });

  it("rejects rejected decision responses with an empty review comment", () => {
    expect(() =>
      adminRequestDecisionResponseSchema.parse({
        id: "req_manual_001",
        requestType: "manual_attendance",
        status: "rejected",
        reviewedAt: "2026-03-30T13:15:00+09:00",
        reviewComment: "   ",
        governingReviewComment: "Please clarify the missing clock-out time.",
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "req_manual_001",
        effectiveStatus: "rejected",
        hasActiveFollowUp: false,
        nextAction: "none",
      }),
    ).toThrow();
  });
});
