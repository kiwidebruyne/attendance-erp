import { describe, expect, it } from "vitest";

import {
  buildExceptionSurfaceModels,
  buildHistoryAction,
  buildHistoryCorrectionDraft,
} from "@/app/(erp)/(employee)/attendance/_lib/view-model";
import type {
  AttendanceHistoryResponse,
  AttendanceTodayResponse,
} from "@/lib/contracts/attendance";
import type {
  AttendanceAttempt,
  AttendanceDisplay,
  AttendanceSurfaceManualRequestResource,
  ExpectedWorkday,
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
    manualRequest: null,
    ...overrides,
  };
}

function createFailedAttempt(
  overrides: Partial<Extract<AttendanceAttempt, { status: "failed" }>> = {},
): Extract<AttendanceAttempt, { status: "failed" }> {
  return {
    id: "attempt_failed_001",
    date: "2026-04-13",
    action: "clock_in",
    attemptedAt: "2026-04-13T09:05:00+09:00",
    status: "failed",
    failureReason: "BLE beacon not detected",
    ...overrides,
  };
}

function createManualRequest(
  overrides: Partial<AttendanceSurfaceManualRequestResource> = {},
): AttendanceSurfaceManualRequestResource {
  return {
    id: "manual_request_emp_001_2026-04-13_root",
    requestType: "manual_attendance",
    action: "clock_in",
    date: "2026-04-13",
    submittedAt: "2026-04-13T10:05:00+09:00",
    requestedClockInAt: "2026-04-13T09:05:00+09:00",
    requestedClockOutAt: null,
    reason: "Beacon was unavailable during check-in.",
    status: "pending",
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: "manual_request_emp_001_2026-04-13_root",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
    activeRequestId: "manual_request_emp_001_2026-04-13_root",
    activeStatus: "pending",
    effectiveRequestId: "manual_request_emp_001_2026-04-13_root",
    effectiveStatus: "pending",
    governingReviewComment: null,
    hasActiveFollowUp: false,
    nextAction: "admin_review",
    ...overrides,
  };
}

function createTodayResponse(
  overrides: Partial<AttendanceTodayResponse> = {},
): AttendanceTodayResponse {
  return {
    date: "2026-04-13",
    employee: {
      id: "emp_001",
      name: "Minji Park",
      department: "Operations",
    },
    expectedWorkday: createExpectedWorkday(),
    todayRecord: null,
    attempts: [],
    manualRequest: null,
    display: createDisplay({
      activeExceptions: ["not_checked_in"],
      nextAction: {
        type: "submit_manual_request",
        relatedRequestId: null,
      },
    }),
    ...overrides,
  };
}

describe("attendance page view model", () => {
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

  it("builds a pending history action for rows with an active manual request", () => {
    expect(
      buildHistoryAction(
        createHistoryRecord({
          date: "2026-04-09",
          display: createDisplay({
            activeExceptions: ["manual_request_pending", "absent"],
            nextAction: {
              type: "review_request_status",
              relatedRequestId: "manual_request_emp_001_2026-04-09_root",
            },
          }),
          manualRequest: createManualRequest({
            id: "manual_request_emp_001_2026-04-09_root",
            date: "2026-04-09",
            action: "both",
            requestedClockInAt: "2026-04-09T09:03:00+09:00",
            requestedClockOutAt: "2026-04-09T18:04:00+09:00",
            rootRequestId: "manual_request_emp_001_2026-04-09_root",
            activeRequestId: "manual_request_emp_001_2026-04-09_root",
            effectiveRequestId: "manual_request_emp_001_2026-04-09_root",
          }),
        }),
      ),
    ).toMatchObject({
      kind: "pending",
      label: "요청 보기",
      tone: "warning",
      title: "근무 기록 정정 요청을 확인하고 있어요",
      request: {
        id: "manual_request_emp_001_2026-04-09_root",
      },
    });
  });

  it("suppresses duplicate same-day correction surfaces when a pending request exists", () => {
    expect(
      buildExceptionSurfaceModels(
        createTodayResponse({
          attempts: [createFailedAttempt()],
          manualRequest: createManualRequest(),
          display: createDisplay({
            activeExceptions: [
              "attempt_failed",
              "manual_request_pending",
              "not_checked_in",
            ],
            nextAction: {
              type: "review_request_status",
              relatedRequestId: "manual_request_emp_001_2026-04-13_root",
            },
          }),
        }),
      ),
    ).toMatchObject([
      {
        id: "manual-request-summary",
        kind: "pending",
        title: "출근 시간 정정 요청을 확인하고 있어요",
      },
    ]);
  });
});
