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
  approvalStatusSchema,
  attendanceStatusSchema,
  errorResponseSchema,
  leaveTypeSchema,
  manualAttendanceActionSchema,
  requestTypeSchema,
  verificationMethodSchema,
} from "@/lib/contracts/shared";

describe("shared contract schemas", () => {
  it("accept documented enum vocabulary and ISO date primitives", () => {
    expect(attendanceStatusSchema.options).toEqual([
      "working",
      "normal",
      "late",
      "early_leave",
      "absent",
      "on_leave",
    ]);
    expect(verificationMethodSchema.options).toEqual([
      "beacon",
      "manual",
      "none",
    ]);
    expect(approvalStatusSchema.options).toEqual([
      "pending",
      "approved",
      "rejected",
    ]);
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
        today: {
          clockInAt: "2026-03-30T09:03:00+09:00",
          clockOutAt: null,
          workMinutes: null,
          status: "working",
          beaconVerified: true,
          verificationMethod: "beacon",
          manualRequest: null,
        },
      }),
    ).toMatchObject({
      date: "2026-03-30",
      employee: {
        id: "emp_001",
      },
      today: {
        status: "working",
        beaconVerified: true,
      },
    });
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
            clockInAt: "2026-03-30T09:03:00+09:00",
            clockOutAt: null,
            workMinutes: null,
            status: "working",
            beaconVerified: true,
            verificationMethod: "beacon",
          },
        ],
      }),
    ).toMatchObject({
      records: [{ status: "working" }],
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
      }),
    ).toMatchObject({
      id: "req_manual_001",
      requestType: "manual_attendance",
      status: "pending",
    });
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
        },
        items: [
          {
            employeeId: "emp_001",
            name: "Alex Kim",
            department: "Product",
            clockInAt: "2026-03-30T09:03:00+09:00",
            clockOutAt: null,
            status: "working",
            verificationMethod: "beacon",
          },
        ],
      }),
    ).toMatchObject({
      summary: {
        checkedInCount: 8,
      },
    });
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
            employeeId: "emp_001",
            name: "Alex Kim",
            department: "Product",
            clockInAt: "2026-03-30T09:03:00+09:00",
            clockOutAt: null,
            workMinutes: null,
            status: "working",
            verificationMethod: "beacon",
          },
        ],
      }),
    ).toMatchObject({
      total: 22,
      records: [{ employeeId: "emp_001" }],
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
});
