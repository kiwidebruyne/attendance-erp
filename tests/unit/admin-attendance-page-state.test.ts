import { describe, expect, it } from "vitest";

import {
  groupAdminAttendanceTodayRows,
  normalizeAdminAttendanceUrlState,
} from "@/app/(erp)/(admin)/admin/attendance/_lib/page-state";
import type { AdminAttendanceTodayResponse } from "@/lib/contracts/admin-attendance";
import type { AttendanceSurfaceManualRequestResource } from "@/lib/contracts/shared";

const seededToday = "2026-04-13";

function makeManualRequestFixture(
  overrides: Partial<AttendanceSurfaceManualRequestResource> = {},
): AttendanceSurfaceManualRequestResource {
  const id = overrides.id ?? "manual_request_001";
  const status = overrides.status ?? "pending";
  const effectiveRequestId = overrides.effectiveRequestId ?? id;
  const activeRequestId = overrides.activeRequestId ?? effectiveRequestId;
  const rootRequestId = overrides.rootRequestId ?? effectiveRequestId;

  return {
    id,
    requestType: "manual_attendance",
    action: "clock_in",
    date: "2026-04-13",
    submittedAt: "2026-04-13T09:20:00+09:00",
    requestedClockInAt: "2026-04-13T09:08:00+09:00",
    requestedClockOutAt: null,
    reason: "Need to correct clock-in time.",
    status,
    reviewedAt: null,
    reviewComment: null,
    rootRequestId,
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
    activeRequestId,
    activeStatus: "pending",
    effectiveRequestId,
    effectiveStatus: status,
    governingReviewComment: null,
    hasActiveFollowUp: false,
    nextAction: "admin_review",
    ...overrides,
  };
}

function makeTodayItem(
  overrides: Partial<AdminAttendanceTodayResponse["items"][number]> = {},
): AdminAttendanceTodayResponse["items"][number] {
  return {
    employee: {
      id: "emp_001",
      name: "박민지",
      department: "운영",
    },
    expectedWorkday: {
      isWorkday: true,
      expectedClockInAt: null,
      expectedClockOutAt: null,
      adjustedClockInAt: null,
      adjustedClockOutAt: null,
      countsTowardAdminSummary: true,
      leaveCoverage: null,
    },
    todayRecord: null,
    display: {
      phase: "working",
      flags: [],
      activeExceptions: [],
      nextAction: {
        type: "wait",
        relatedRequestId: null,
      },
    },
    latestFailedAttempt: null,
    previousDayOpenRecord: null,
    manualRequest: null,
    ...overrides,
  };
}

describe("normalizeAdminAttendanceUrlState", () => {
  it("defaults missing query state to today mode", () => {
    expect(normalizeAdminAttendanceUrlState(new URLSearchParams())).toEqual({
      mode: "today",
    });
  });

  it("defaults history mode without explicit dates to the last 7 days including seeded today", () => {
    const normalized = normalizeAdminAttendanceUrlState(
      new URLSearchParams("mode=history"),
    );

    expect(normalized).toEqual({
      mode: "history",
      from: "2026-04-07",
      to: seededToday,
    });
  });

  it("falls back to the seeded 7-day history window when history state is partial or invalid", () => {
    expect(
      normalizeAdminAttendanceUrlState(
        new URLSearchParams("mode=history&from=2026-04-10"),
      ),
    ).toEqual({
      mode: "history",
      from: "2026-04-07",
      to: seededToday,
    });

    expect(
      normalizeAdminAttendanceUrlState(
        new URLSearchParams("mode=history&from=not-a-date&to=2026-04-13"),
      ),
    ).toEqual({
      mode: "history",
      from: "2026-04-07",
      to: seededToday,
    });
  });

  it("falls back to the seeded 7-day history window when history dates are reversed", () => {
    expect(
      normalizeAdminAttendanceUrlState(
        new URLSearchParams("mode=history&from=2026-04-13&to=2026-04-07"),
      ),
    ).toEqual({
      mode: "history",
      from: "2026-04-07",
      to: seededToday,
    });
  });

  it("omits blank or whitespace-only names from normalized URL state", () => {
    expect(
      normalizeAdminAttendanceUrlState(
        new URLSearchParams("mode=today&name=%20%20%20"),
      ),
    ).toEqual({
      mode: "today",
    });

    expect(
      normalizeAdminAttendanceUrlState(
        new URLSearchParams(
          "mode=history&from=2026-04-07&to=2026-04-13&name=alex",
        ),
      ),
    ).toEqual({
      mode: "history",
      from: "2026-04-07",
      to: seededToday,
      name: "alex",
    });
  });
});

describe("groupAdminAttendanceTodayRows", () => {
  it("assigns each row to the highest-priority mutually exclusive group", () => {
    const grouped = groupAdminAttendanceTodayRows([
      makeTodayItem({
        employee: {
          id: "emp_101",
          name: "Prev Day Open",
          department: "운영",
        },
        previousDayOpenRecord: {
          date: "2026-04-12",
          clockInAt: "2026-04-12T09:00:00+09:00",
          clockOutAt: null,
          expectedClockOutAt: "2026-04-12T18:00:00+09:00",
        },
        latestFailedAttempt: {
          id: "failed_attempt",
          date: "2026-04-13",
          action: "clock_in",
          attemptedAt: "2026-04-13T09:05:00+09:00",
          status: "failed",
          failureReason: "Beacon not found",
        },
        manualRequest: makeManualRequestFixture({
          id: "manual_request",
        }),
      }),
      makeTodayItem({
        employee: {
          id: "emp_102",
          name: "Failed Attempt",
          department: "운영",
        },
        latestFailedAttempt: {
          id: "failed_attempt_only",
          date: "2026-04-13",
          action: "clock_out",
          attemptedAt: "2026-04-13T18:05:00+09:00",
          status: "failed",
          failureReason: "Beacon not found",
        },
        manualRequest: makeManualRequestFixture({
          id: "manual_request_shadowed",
          activeRequestId: "manual_request_shadowed",
          effectiveRequestId: "manual_request_shadowed",
        }),
      }),
      makeTodayItem({
        employee: {
          id: "emp_103",
          name: "Manual Request",
          department: "운영",
        },
        manualRequest: makeManualRequestFixture({
          id: "manual_request_only",
          activeRequestId: "manual_request_only",
          effectiveRequestId: "manual_request_only",
        }),
      }),
      makeTodayItem({
        employee: {
          id: "emp_104",
          name: "Operational",
          department: "운영",
        },
      }),
    ]);

    expect(grouped.previousDayOpen.map((item) => item.employee.id)).toEqual([
      "emp_101",
    ]);
    expect(grouped.failedAttempts.map((item) => item.employee.id)).toEqual([
      "emp_102",
    ]);
    expect(grouped.manualRequests.map((item) => item.employee.id)).toEqual([
      "emp_103",
    ]);
    expect(grouped.operationalRows.map((item) => item.employee.id)).toEqual([
      "emp_104",
    ]);
  });
});
