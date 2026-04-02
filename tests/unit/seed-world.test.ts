import { describe, expect, it } from "vitest";

import {
  attendanceAttemptEntitySchema,
  attendanceRecordEntitySchema,
  companyEventEntitySchema,
  leaveRequestEntitySchema,
  manualAttendanceRequestEntitySchema,
  requestReviewEventEntitySchema,
} from "@/lib/seed/entities";
import {
  buildFixedSeoulDateTime,
  fixedSeoulBaselineDate,
  fixedSeoulCalendarWindow,
  fixedSeoulTimeZone,
  fixedSeoulUtcOffset,
} from "@/lib/seed/seoul-clock";
import { canonicalSeedWorld, seedScenarioAnchors } from "@/lib/seed/world";

describe("fixed Seoul seed clock", () => {
  it("locks the deterministic Seoul baseline date and window", () => {
    expect(fixedSeoulTimeZone).toBe("Asia/Seoul");
    expect(fixedSeoulUtcOffset).toBe("+09:00");
    expect(fixedSeoulBaselineDate).toBe("2026-04-13");
    expect(fixedSeoulCalendarWindow).toEqual({
      start: "2026-03-23",
      end: "2026-04-20",
    });
    expect(buildFixedSeoulDateTime("2026-04-15", "08:45:00")).toBe(
      "2026-04-15T08:45:00+09:00",
    );
  });
});

describe("canonical seed world", () => {
  it("seeds one deterministic canonical world with 12 employees", () => {
    expect(canonicalSeedWorld.employees).toHaveLength(12);
    expect(canonicalSeedWorld.employees[0]).toEqual({
      id: "emp_001",
      name: "Minji Park",
      department: "Operations",
      role: "employee",
    });
    expect(canonicalSeedWorld.employees.at(-1)).toEqual({
      id: "emp_012",
      name: "Jiwon Han",
      department: "People",
      role: "admin",
    });
  });

  it("covers the required seed-world scenario anchors", () => {
    expect(seedScenarioAnchors.previousDayMissingCheckout).toEqual({
      employeeId: "emp_001",
      recordDate: "2026-04-10",
      surfaceDate: "2026-04-13",
      attendanceRecordId: "attendance_record_emp_001_2026-04-10",
    });
    expect(seedScenarioAnchors.nextDayCheckout).toEqual({
      employeeId: "emp_002",
      recordDate: "2026-04-14",
      checkoutAttemptId: "attendance_attempt_emp_002_2026-04-14_clock_out",
      closedAt: "2026-04-15T08:45:00+09:00",
    });
    expect(seedScenarioAnchors.unresolvedFailedAttempt).toEqual({
      employeeId: "emp_003",
      date: "2026-04-16",
      attemptId: "attendance_attempt_emp_003_2026-04-16_clock_out_failed",
    });
    expect(seedScenarioAnchors.companyEventSensitiveLeaveDate).toEqual({
      employeeId: "emp_004",
      date: "2026-04-16",
      eventId: "company_event_2026-04-16_spring-launch",
      activeRequestId: "leave_request_emp_004_2026-04-16_change",
    });
    expect(seedScenarioAnchors.staffingSensitiveLeaveDate).toEqual({
      employeeId: "emp_006",
      date: "2026-04-17",
      activeRequestId: "leave_request_emp_006_2026-04-17_root",
    });
    expect(seedScenarioAnchors.leaveWorkConflict).toEqual({
      employeeId: "emp_005",
      date: "2026-04-18",
      attendanceRecordId: "attendance_record_emp_005_2026-04-18",
      leaveRequestId: "leave_request_emp_005_2026-04-18_root",
    });
    expect(seedScenarioAnchors.manualAttendanceResubmissionChain).toEqual({
      employeeId: "emp_009",
      rootRequestId: "manual_request_emp_009_2026-04-08_root",
      activeRequestId: "manual_request_emp_009_2026-04-08_resubmission",
    });
    expect(seedScenarioAnchors.pendingManualEdit).toEqual({
      employeeId: "emp_010",
      requestId: "manual_request_emp_010_2026-04-09_root",
    });
    expect(seedScenarioAnchors.pendingManualWithdraw).toEqual({
      employeeId: "emp_011",
      requestId: "manual_request_emp_011_2026-04-07_root",
    });
    expect(seedScenarioAnchors.approvedManualWriteback).toEqual({
      employeeId: "emp_007",
      requestId: "manual_request_emp_007_2026-04-03_root",
      attendanceRecordId: "attendance_record_emp_007_2026-04-03",
    });
    expect(seedScenarioAnchors.reviewedNonApprovedLeaveTrail).toEqual({
      employeeId: "emp_010",
      reviewedRequestId: "leave_request_emp_010_2026-04-20_root",
      activeRequestId: "leave_request_emp_010_2026-04-20_resubmission",
    });
  });

  it("links approved manual writeback facts back into the canonical attendance record", () => {
    expect(
      canonicalSeedWorld.attendanceRecords.find(
        (record) =>
          record.id ===
          seedScenarioAnchors.approvedManualWriteback.attendanceRecordId,
      ),
    ).toMatchObject({
      employeeId: "emp_007",
      date: "2026-04-03",
      clockOutSource: "manual",
      manualRequestId: "manual_request_emp_007_2026-04-03_root",
    });
  });

  it("keeps seeded leave anchors on canonical workdays and stores leave request timestamps", () => {
    expect(
      canonicalSeedWorld.expectedWorkdays.find(
        (workday) =>
          workday.employeeId === "emp_005" && workday.date === "2026-04-18",
      ),
    ).toMatchObject({
      employeeId: "emp_005",
      date: "2026-04-18",
      isWorkday: true,
      expectedClockInAt: "2026-04-18T09:00:00+09:00",
      expectedClockOutAt: "2026-04-18T18:00:00+09:00",
    });

    expect(
      canonicalSeedWorld.leaveRequests.find(
        (request) => request.id === "leave_request_emp_004_2026-04-16_root",
      ),
    ).toMatchObject({
      requestedAt: "2026-04-13T09:30:00+09:00",
    });
  });

  it("keeps seeded company events read-only", () => {
    expect(canonicalSeedWorld.companyEvents).toHaveLength(2);
    expect(canonicalSeedWorld.companyEvents).toEqual([
      {
        id: "company_event_2026-04-16_spring-launch",
        date: "2026-04-16",
        title: "Spring Launch Dry Run",
      },
      {
        id: "company_event_2026-04-17_inventory-audit",
        date: "2026-04-17",
        title: "Quarterly Inventory Audit",
      },
    ]);
    expect(Object.isFrozen(canonicalSeedWorld.companyEvents)).toBe(true);
    expect(Object.isFrozen(canonicalSeedWorld.companyEvents[0])).toBe(true);
    expect(() => {
      (canonicalSeedWorld.companyEvents as Array<{ title: string }>)[0].title =
        "Mutated";
    }).toThrow();
  });

  it("rejects canonical entity samples that violate promoted enum contracts", () => {
    expect(() =>
      attendanceAttemptEntitySchema.parse({
        id: "attempt_invalid",
        employeeId: "emp_001",
        date: "2026-04-13",
        action: "clock_break",
        attemptedAt: "2026-04-13T09:00:00+09:00",
        status: "success",
        failureReason: null,
      }),
    ).toThrow();

    expect(() =>
      attendanceRecordEntitySchema.parse({
        id: "record_invalid",
        employeeId: "emp_001",
        date: "2026-04-13",
        clockInAt: "2026-04-13T09:00:00+09:00",
        clockInSource: "app",
        clockOutAt: null,
        clockOutSource: null,
        workMinutes: null,
        manualRequestId: null,
      }),
    ).toThrow();

    expect(() =>
      leaveRequestEntitySchema.parse({
        id: "leave_invalid",
        employeeId: "emp_001",
        requestType: "leave",
        leaveType: "sick",
        date: "2026-04-16",
        startAt: null,
        endAt: null,
        reason: "Invalid leave type",
        status: "pending",
        requestedAt: "2026-04-13T10:00:00+09:00",
        reviewedAt: null,
        reviewComment: null,
        rootRequestId: "leave_invalid",
        parentRequestId: null,
        followUpKind: null,
        supersededByRequestId: null,
      }),
    ).toThrow();

    expect(() =>
      manualAttendanceRequestEntitySchema.parse({
        id: "manual_invalid",
        employeeId: "emp_001",
        requestType: "manual_attendance",
        action: "clock_pause",
        date: "2026-04-13",
        submittedAt: "2026-04-13T11:00:00+09:00",
        requestedClockInAt: "2026-04-13T09:15:00+09:00",
        requestedClockOutAt: null,
        reason: "Invalid manual action",
        status: "pending",
        reviewedAt: null,
        reviewComment: null,
        rootRequestId: "manual_invalid",
        parentRequestId: null,
        followUpKind: null,
        supersededByRequestId: null,
      }),
    ).toThrow();

    expect(() =>
      manualAttendanceRequestEntitySchema.parse({
        id: "manual_follow_up_invalid",
        employeeId: "emp_001",
        requestType: "manual_attendance",
        action: "clock_in",
        date: "2026-04-13",
        submittedAt: "2026-04-13T11:00:00+09:00",
        requestedClockInAt: "2026-04-13T09:15:00+09:00",
        requestedClockOutAt: null,
        reason: "Invalid manual follow-up kind",
        status: "pending",
        reviewedAt: null,
        reviewComment: null,
        rootRequestId: "manual_follow_up_invalid_root",
        parentRequestId: "manual_follow_up_invalid_root",
        followUpKind: "change",
        supersededByRequestId: null,
      }),
    ).toThrow();

    expect(() =>
      requestReviewEventEntitySchema.parse({
        id: "review_invalid",
        requestId: "leave_request_emp_004_2026-04-16_root",
        decision: "revise",
        reviewComment: "Invalid decision",
        reviewedAt: "2026-04-13T13:00:00+09:00",
        reviewerId: "emp_012",
      }),
    ).toThrow();

    expect(() =>
      companyEventEntitySchema.parse({
        id: "event_invalid",
        date: "2026-04-16",
        title: "",
      }),
    ).toThrow();
  });
});
