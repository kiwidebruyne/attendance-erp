import { describe, expect, it } from "vitest";

import {
  adminAttendanceListResponseSchema,
  adminAttendanceTodayResponseSchema,
} from "@/lib/contracts/admin-attendance";
import {
  attendanceHistoryResponseSchema,
  attendanceTodayResponseSchema,
} from "@/lib/contracts/attendance";
import {
  getAdminAttendanceList,
  getAdminAttendanceToday,
  getEmployeeAttendanceHistory,
  getEmployeeAttendanceToday,
} from "@/lib/repositories/attendance";
import { canonicalSeedWorld } from "@/lib/seed/world";

const snapshotNow = "2026-04-13T10:00:00+09:00";

function createCanceledLeaveWorld() {
  const world = structuredClone(canonicalSeedWorld);

  world.leaveRequests.push(
    {
      id: "leave_request_emp_002_2026-04-14_root",
      employeeId: "emp_002",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-14",
      startAt: null,
      endAt: null,
      reason: "Original approved leave before cancellation.",
      requestedAt: "2026-04-12T09:00:00+09:00",
      status: "approved",
      reviewedAt: "2026-04-12T11:00:00+09:00",
      reviewComment: null,
      rootRequestId: "leave_request_emp_002_2026-04-14_root",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: "leave_request_emp_002_2026-04-14_cancel",
    },
    {
      id: "leave_request_emp_002_2026-04-14_cancel",
      employeeId: "emp_002",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-14",
      startAt: null,
      endAt: null,
      reason: "Approved cancel follow-up should clear leave coverage.",
      requestedAt: "2026-04-13T09:00:00+09:00",
      status: "approved",
      reviewedAt: "2026-04-13T10:00:00+09:00",
      reviewComment: null,
      rootRequestId: "leave_request_emp_002_2026-04-14_root",
      parentRequestId: "leave_request_emp_002_2026-04-14_root",
      followUpKind: "cancel",
      supersededByRequestId: null,
    },
  );

  return world;
}

describe("attendance repository helpers", () => {
  it("builds the carry-over attendance today response for the open prior workday", () => {
    const response = getEmployeeAttendanceToday(canonicalSeedWorld, {
      employeeId: "emp_001",
      date: "2026-04-13",
      now: snapshotNow,
    });

    expect(() => attendanceTodayResponseSchema.parse(response)).not.toThrow();
    expect(attendanceTodayResponseSchema.parse(response)).toMatchObject({
      date: "2026-04-13",
      employee: {
        id: "emp_001",
      },
      previousDayOpenRecord: {
        date: "2026-04-10",
        clockOutAt: null,
      },
      display: expect.objectContaining({
        activeExceptions: ["previous_day_checkout_missing", "not_checked_in"],
        nextAction: expect.objectContaining({
          type: "resolve_previous_day_checkout",
        }),
      }),
    });
  });

  it("surfaces the unresolved failed attempt together with the active manual request", () => {
    const response = getEmployeeAttendanceToday(canonicalSeedWorld, {
      employeeId: "emp_010",
      date: "2026-04-13",
      now: snapshotNow,
    });

    expect(() => attendanceTodayResponseSchema.parse(response)).not.toThrow();
    expect(attendanceTodayResponseSchema.parse(response)).toMatchObject({
      date: "2026-04-13",
      attempts: [
        expect.objectContaining({
          status: "failed",
          failureReason: "The phone app could not reach the beacon service.",
        }),
      ],
      manualRequest: {
        id: "manual_request_emp_010_2026-04-13_resubmission",
        date: "2026-04-13",
        status: "pending",
        governingReviewComment:
          "Please submit a follow-up if the beacon issue continues.",
        activeRequestId: "manual_request_emp_010_2026-04-13_resubmission",
        activeStatus: "pending",
        effectiveRequestId: "manual_request_emp_010_2026-04-13_resubmission",
        effectiveStatus: "pending",
      },
      display: expect.objectContaining({
        activeExceptions: [
          "attempt_failed",
          "manual_request_pending",
          "not_checked_in",
        ],
        nextAction: expect.objectContaining({
          type: "review_request_status",
        }),
      }),
    });
  });

  it("assembles a date range history table with every requested day", () => {
    const response = getEmployeeAttendanceHistory(canonicalSeedWorld, {
      employeeId: "emp_001",
      from: "2026-04-10",
      to: "2026-04-13",
      now: snapshotNow,
    });

    expect(() => attendanceHistoryResponseSchema.parse(response)).not.toThrow();
    expect(attendanceHistoryResponseSchema.parse(response)).toMatchObject({
      from: "2026-04-10",
      to: "2026-04-13",
      records: expect.arrayContaining([
        expect.objectContaining({
          date: "2026-04-10",
          record: expect.objectContaining({
            clockOutAt: null,
          }),
        }),
        expect.objectContaining({
          date: "2026-04-13",
          display: expect.objectContaining({
            activeExceptions: [
              "previous_day_checkout_missing",
              "not_checked_in",
            ],
          }),
        }),
      ]),
    });
    expect(response.records).toHaveLength(4);
  });

  it("does not keep leave coverage after an approved cancel follow-up becomes effective", () => {
    const response = getEmployeeAttendanceToday(createCanceledLeaveWorld(), {
      employeeId: "emp_002",
      date: "2026-04-14",
      now: snapshotNow,
    });

    expect(() => attendanceTodayResponseSchema.parse(response)).not.toThrow();
    expect(attendanceTodayResponseSchema.parse(response)).toMatchObject({
      expectedWorkday: {
        leaveCoverage: null,
      },
    });
  });

  it("builds the admin summary and list projections from the same seed world", () => {
    const todayResponse = getAdminAttendanceToday(canonicalSeedWorld, {
      date: "2026-04-13",
      now: snapshotNow,
    });
    const listResponse = getAdminAttendanceList(canonicalSeedWorld, {
      from: "2026-04-13",
      to: "2026-04-13",
      name: "Hyun",
      now: snapshotNow,
    });

    expect(() =>
      adminAttendanceTodayResponseSchema.parse(todayResponse),
    ).not.toThrow();
    expect(
      adminAttendanceTodayResponseSchema.parse(todayResponse),
    ).toMatchObject({
      date: "2026-04-13",
      summary: {
        previousDayOpenCount: 1,
        failedAttemptCount: 1,
      },
      items: expect.arrayContaining([
        expect.objectContaining({
          employee: expect.objectContaining({
            id: "emp_001",
          }),
          previousDayOpenRecord: expect.objectContaining({
            date: "2026-04-10",
          }),
        }),
        expect.objectContaining({
          employee: expect.objectContaining({
            id: "emp_010",
          }),
          latestFailedAttempt: expect.objectContaining({
            status: "failed",
          }),
        }),
      ]),
    });

    expect(() =>
      adminAttendanceListResponseSchema.parse(listResponse),
    ).not.toThrow();
    expect(adminAttendanceListResponseSchema.parse(listResponse)).toMatchObject(
      {
        from: "2026-04-13",
        to: "2026-04-13",
        filters: {
          name: "hyun",
        },
        total: 1,
        records: [
          expect.objectContaining({
            employee: expect.objectContaining({
              id: "emp_010",
            }),
            latestFailedAttempt: expect.objectContaining({
              failureReason:
                "The phone app could not reach the beacon service.",
            }),
          }),
        ],
      },
    );
  });
});
