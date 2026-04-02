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

function createPastDueNoShowWorld() {
  const world = structuredClone(canonicalSeedWorld);

  world.attendanceRecords = world.attendanceRecords.filter(
    (record) =>
      !(record.employeeId === "emp_002" && record.date === "2026-04-10"),
  );
  world.attendanceAttempts = world.attendanceAttempts.filter(
    (attempt) =>
      !(attempt.employeeId === "emp_002" && attempt.date === "2026-04-10"),
  );
  world.manualAttendanceRequests = world.manualAttendanceRequests.filter(
    (request) =>
      !(request.employeeId === "emp_002" && request.date === "2026-04-10"),
  );
  world.leaveRequests = world.leaveRequests.filter(
    (request) =>
      !(request.employeeId === "emp_002" && request.date === "2026-04-10"),
  );

  const expectedWorkday = world.expectedWorkdays.find(
    (workday) =>
      workday.employeeId === "emp_002" && workday.date === "2026-04-10",
  );

  if (expectedWorkday !== undefined) {
    expectedWorkday.isWorkday = true;
    expectedWorkday.expectedClockInAt = "2026-04-10T09:00:00+09:00";
    expectedWorkday.expectedClockOutAt = "2026-04-10T18:00:00+09:00";
    expectedWorkday.adjustedClockInAt = "2026-04-10T09:00:00+09:00";
    expectedWorkday.adjustedClockOutAt = "2026-04-10T18:00:00+09:00";
    expectedWorkday.countsTowardAdminSummary = true;
    expectedWorkday.leaveCoverage = null;
  }

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
        phase: "working",
        activeExceptions: ["previous_day_checkout_missing"],
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
            activeExceptions: ["previous_day_checkout_missing"],
          }),
        }),
      ]),
    });
    expect(response.records).toHaveLength(4);
  });

  it("keeps the seeded employee history populated across the rolling week and month windows", () => {
    const weekResponse = getEmployeeAttendanceHistory(canonicalSeedWorld, {
      employeeId: "emp_001",
      from: "2026-04-07",
      to: "2026-04-13",
      now: snapshotNow,
    });
    const monthResponse = getEmployeeAttendanceHistory(canonicalSeedWorld, {
      employeeId: "emp_001",
      from: "2026-03-24",
      to: "2026-04-13",
      now: snapshotNow,
    });

    expect(
      weekResponse.records.find((record) => record.date === "2026-04-07")
        ?.record,
    ).toMatchObject({
      clockInAt: "2026-04-07T08:57:00+09:00",
      clockOutAt: "2026-04-07T18:04:00+09:00",
    });
    expect(
      weekResponse.records.find((record) => record.date === "2026-04-08")
        ?.record,
    ).toMatchObject({
      clockInAt: "2026-04-08T09:18:00+09:00",
      clockOutAt: "2026-04-08T18:02:00+09:00",
    });
    expect(
      weekResponse.records.find((record) => record.date === "2026-04-09")
        ?.record,
    ).toMatchObject({
      clockInAt: "2026-04-09T08:59:00+09:00",
      clockOutAt: "2026-04-09T17:21:00+09:00",
    });
    expect(
      monthResponse.records.find((record) => record.date === "2026-03-24")
        ?.record,
    ).toMatchObject({
      clockInAt: "2026-03-24T08:58:00+09:00",
      clockOutAt: "2026-03-24T18:02:00+09:00",
    });
  });

  it("marks past unattended workdays as absent in history and admin lists", () => {
    const world = createPastDueNoShowWorld();
    const historyResponse = getEmployeeAttendanceHistory(world, {
      employeeId: "emp_002",
      from: "2026-04-10",
      to: "2026-04-10",
      now: snapshotNow,
    });
    const listResponse = getAdminAttendanceList(world, {
      from: "2026-04-10",
      to: "2026-04-10",
      now: snapshotNow,
    });

    expect(() =>
      attendanceHistoryResponseSchema.parse(historyResponse),
    ).not.toThrow();
    expect(() =>
      adminAttendanceListResponseSchema.parse(listResponse),
    ).not.toThrow();

    expect(historyResponse.records).toHaveLength(1);
    expect(historyResponse.records[0]?.display.activeExceptions).toContain(
      "absent",
    );
    expect(historyResponse.records[0]?.display.activeExceptions).not.toContain(
      "not_checked_in",
    );

    const adminRecord = listResponse.records.find(
      (record) =>
        record.employee.id === "emp_002" && record.date === "2026-04-10",
    );

    expect(adminRecord).toBeDefined();
    expect(adminRecord?.display.activeExceptions).toContain("absent");
    expect(adminRecord?.display.activeExceptions).not.toContain(
      "not_checked_in",
    );
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
        checkedInCount: 9,
        notCheckedInCount: 2,
        lateCount: 1,
        onLeaveCount: 1,
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

  it("treats a blank admin name filter as unset", () => {
    const unfilteredResponse = getAdminAttendanceList(canonicalSeedWorld, {
      from: "2026-04-13",
      to: "2026-04-13",
      now: snapshotNow,
    });
    const blankFilterResponse = getAdminAttendanceList(canonicalSeedWorld, {
      from: "2026-04-13",
      to: "2026-04-13",
      name: "   ",
      now: snapshotNow,
    });

    expect(() =>
      adminAttendanceListResponseSchema.parse(blankFilterResponse),
    ).not.toThrow();
    expect(blankFilterResponse.filters).toEqual({});
    expect(blankFilterResponse.total).toBe(unfilteredResponse.total);
    expect(blankFilterResponse.records).toEqual(unfilteredResponse.records);
  });
});
