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

const baselineSnapshotNow = "2026-04-03T10:00:00+09:00";
const laterSnapshotNow = "2026-04-13T10:00:00+09:00";

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
  it("builds the baseline today response as an in-progress beacon workday", () => {
    const response = getEmployeeAttendanceToday(canonicalSeedWorld, {
      employeeId: "emp_001",
      date: "2026-04-03",
      now: baselineSnapshotNow,
    });

    expect(() => attendanceTodayResponseSchema.parse(response)).not.toThrow();
    expect(attendanceTodayResponseSchema.parse(response)).toMatchObject({
      date: "2026-04-03",
      employee: {
        id: "emp_001",
      },
      todayRecord: {
        date: "2026-04-03",
        clockInSource: "beacon",
        clockOutAt: null,
      },
      display: expect.objectContaining({
        phase: "working",
        activeExceptions: [],
        nextAction: expect.objectContaining({
          type: "clock_out",
        }),
      }),
    });
  });

  it("surfaces the unresolved failed attempt together with the active manual request", () => {
    const response = getEmployeeAttendanceToday(canonicalSeedWorld, {
      employeeId: "emp_010",
      date: "2026-04-03",
      now: baselineSnapshotNow,
    });

    expect(() => attendanceTodayResponseSchema.parse(response)).not.toThrow();
    expect(attendanceTodayResponseSchema.parse(response)).toMatchObject({
      date: "2026-04-03",
      attempts: [
        expect.objectContaining({
          status: "failed",
          failureReason: "The phone app could not reach the beacon service.",
        }),
      ],
      manualRequest: {
        id: "manual_request_emp_010_2026-04-03_resubmission",
        date: "2026-04-03",
        status: "pending",
        governingReviewComment:
          "Please submit a follow-up if the beacon issue continues.",
        activeRequestId: "manual_request_emp_010_2026-04-03_resubmission",
        activeStatus: "pending",
        effectiveRequestId: "manual_request_emp_010_2026-04-03_resubmission",
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
      from: "2026-03-31",
      to: "2026-04-03",
      now: baselineSnapshotNow,
    });

    expect(() => attendanceHistoryResponseSchema.parse(response)).not.toThrow();
    expect(attendanceHistoryResponseSchema.parse(response)).toMatchObject({
      from: "2026-03-31",
      to: "2026-04-03",
      records: expect.arrayContaining([
        expect.objectContaining({
          date: "2026-03-31",
          manualRequest: null,
          record: expect.objectContaining({
            clockOutAt: "2026-03-31T18:04:00+09:00",
          }),
        }),
        expect.objectContaining({
          date: "2026-04-03",
          manualRequest: null,
          record: expect.objectContaining({
            clockInAt: "2026-04-03T09:02:00+09:00",
            clockOutAt: null,
          }),
          display: expect.objectContaining({
            phase: "working",
            activeExceptions: [],
          }),
        }),
      ]),
    });
    expect(response.records).toHaveLength(4);
  });

  it("projects only pending manual attendance requests into history rows", () => {
    const world = structuredClone(canonicalSeedWorld);

    world.manualAttendanceRequests.push(
      {
        id: "manual_request_emp_001_2026-04-10_root",
        employeeId: "emp_001",
        requestType: "manual_attendance",
        action: "clock_out",
        date: "2026-04-10",
        submittedAt: "2026-04-13T09:20:00+09:00",
        requestedClockInAt: null,
        requestedClockOutAt: "2026-04-10T18:10:00+09:00",
        reason: "Submitting a carry-over checkout correction.",
        status: "pending",
        reviewedAt: null,
        reviewComment: null,
        rootRequestId: "manual_request_emp_001_2026-04-10_root",
        parentRequestId: null,
        followUpKind: null,
        supersededByRequestId: null,
      },
      {
        id: "manual_request_emp_001_2026-04-09_reviewed",
        employeeId: "emp_001",
        requestType: "manual_attendance",
        action: "clock_in",
        date: "2026-04-09",
        submittedAt: "2026-04-13T09:25:00+09:00",
        requestedClockInAt: "2026-04-09T09:03:00+09:00",
        requestedClockOutAt: null,
        reason: "Rejected requests should stay out of history projection.",
        status: "rejected",
        reviewedAt: "2026-04-13T11:00:00+09:00",
        reviewComment: "Please clarify the correction context.",
        rootRequestId: "manual_request_emp_001_2026-04-09_reviewed",
        parentRequestId: null,
        followUpKind: null,
        supersededByRequestId: null,
      },
    );

    const response = getEmployeeAttendanceHistory(world, {
      employeeId: "emp_001",
      from: "2026-04-09",
      to: "2026-04-10",
      now: laterSnapshotNow,
    });

    expect(
      response.records.find((record) => record.date === "2026-04-10")
        ?.manualRequest,
    ).toMatchObject({
      id: "manual_request_emp_001_2026-04-10_root",
      status: "pending",
    });
    expect(
      response.records.find((record) => record.date === "2026-04-09")
        ?.manualRequest,
    ).toBeNull();
  });

  it("keeps the seeded employee history populated across the rolling week and month windows", () => {
    const weekResponse = getEmployeeAttendanceHistory(canonicalSeedWorld, {
      employeeId: "emp_001",
      from: "2026-04-07",
      to: "2026-04-13",
      now: laterSnapshotNow,
    });
    const monthResponse = getEmployeeAttendanceHistory(canonicalSeedWorld, {
      employeeId: "emp_001",
      from: "2026-03-15",
      to: "2026-04-13",
      now: laterSnapshotNow,
    });
    const monthWorkdayRecords = monthResponse.records.filter(
      (record) => record.expectedWorkday.isWorkday,
    );

    expect(
      weekResponse.records.find((record) => record.date === "2026-04-07")
        ?.expectedWorkday.leaveCoverage,
    ).toMatchObject({
      leaveType: "hourly",
      startAt: "2026-04-07T13:00:00+09:00",
      endAt: "2026-04-07T16:00:00+09:00",
    });
    expect(
      weekResponse.records.find((record) => record.date === "2026-04-07")
        ?.record,
    ).toMatchObject({
      clockInAt: "2026-04-07T08:57:00+09:00",
      clockOutAt: "2026-04-07T18:04:00+09:00",
    });
    expect(
      monthResponse.records.find((record) => record.date === "2026-03-24")
        ?.expectedWorkday.leaveCoverage,
    ).toMatchObject({
      leaveType: "annual",
    });
    expect(
      monthResponse.records.find((record) => record.date === "2026-03-16")
        ?.record,
    ).toMatchObject({
      clockInAt: "2026-03-16T08:56:00+09:00",
      clockOutAt: "2026-03-16T18:01:00+09:00",
    });
    expect(
      monthResponse.records.find((record) => record.date === "2026-03-23")
        ?.record,
    ).toMatchObject({
      clockInAt: "2026-03-23T08:59:00+09:00",
      clockOutAt: "2026-03-23T18:03:00+09:00",
    });
    expect(
      monthResponse.records.find((record) => record.date === "2026-03-30")
        ?.record,
    ).toMatchObject({
      clockInAt: "2026-03-30T08:58:00+09:00",
      clockOutAt: "2026-03-30T18:06:00+09:00",
    });
    expect(
      monthResponse.records.find((record) => record.date === "2026-03-27")
        ?.display.activeExceptions,
    ).toContain("absent");
    expect(
      monthResponse.records.find((record) => record.date === "2026-03-27")
        ?.display.activeExceptions,
    ).not.toContain("not_checked_in");
    expect(
      monthResponse.records.find((record) => record.date === "2026-04-10")
        ?.display.phase,
    ).toBe("working");
    expect(
      monthWorkdayRecords.filter((record) => record.record !== null),
    ).toHaveLength(18);
    expect(
      monthWorkdayRecords.filter((record) =>
        record.display.activeExceptions.includes("absent"),
      ),
    ).toHaveLength(1);
    expect(
      monthWorkdayRecords.filter((record) =>
        record.display.activeExceptions.includes("not_checked_in"),
      ),
    ).toHaveLength(1);
    expect(
      monthWorkdayRecords.filter(
        (record) =>
          record.expectedWorkday.leaveCoverage !== null &&
          record.record === null,
      ),
    ).toHaveLength(1);
  });

  it("marks past unattended workdays as absent in history and admin lists", () => {
    const world = createPastDueNoShowWorld();
    const historyResponse = getEmployeeAttendanceHistory(world, {
      employeeId: "emp_002",
      from: "2026-04-10",
      to: "2026-04-10",
      now: laterSnapshotNow,
    });
    const listResponse = getAdminAttendanceList(world, {
      from: "2026-04-10",
      to: "2026-04-10",
      now: laterSnapshotNow,
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
      now: laterSnapshotNow,
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
      date: "2026-04-03",
      now: baselineSnapshotNow,
    });
    const listResponse = getAdminAttendanceList(canonicalSeedWorld, {
      from: "2026-04-03",
      to: "2026-04-03",
      name: "Hyun",
      now: baselineSnapshotNow,
    });

    expect(() =>
      adminAttendanceTodayResponseSchema.parse(todayResponse),
    ).not.toThrow();
    expect(
      adminAttendanceTodayResponseSchema.parse(todayResponse),
    ).toMatchObject({
      date: "2026-04-03",
      summary: {
        failedAttemptCount: 1,
        checkedInCount: 9,
      },
      items: expect.arrayContaining([
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
        from: "2026-04-03",
        to: "2026-04-03",
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
      from: "2026-04-03",
      to: "2026-04-03",
      now: baselineSnapshotNow,
    });
    const blankFilterResponse = getAdminAttendanceList(canonicalSeedWorld, {
      from: "2026-04-03",
      to: "2026-04-03",
      name: "   ",
      now: baselineSnapshotNow,
    });

    expect(() =>
      adminAttendanceListResponseSchema.parse(blankFilterResponse),
    ).not.toThrow();
    expect(blankFilterResponse.filters).toEqual({});
    expect(blankFilterResponse.total).toBe(unfilteredResponse.total);
    expect(blankFilterResponse.records).toEqual(unfilteredResponse.records);
  });
});
