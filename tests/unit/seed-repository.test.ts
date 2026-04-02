import { describe, expect, it } from "vitest";

import {
  adminAttendanceListResponseSchema,
  adminAttendanceTodayResponseSchema,
} from "@/lib/contracts/admin-attendance";
import {
  attendanceHistoryResponseSchema,
  attendanceTodayResponseSchema,
} from "@/lib/contracts/attendance";
import { leaveOverviewResponseSchema } from "@/lib/contracts/leave";
import { adminRequestsResponseSchema } from "@/lib/contracts/requests";
import { createSeedRepository } from "@/lib/repositories";
import { canonicalSeedWorld } from "@/lib/seed/world";

const repositoryNow = "2026-04-13T10:00:00+09:00";

describe("seed repository", () => {
  it("exports the read-only repository factory", () => {
    expect(typeof createSeedRepository).toBe("function");
  });

  it("exposes the planned public methods", () => {
    const repository = createSeedRepository({
      world: canonicalSeedWorld,
      now: repositoryNow,
    });

    expect(repository).not.toBeNull();
    expect(typeof repository?.findEmployeeById).toBe("function");
    expect(typeof repository?.findRequestChainByRequestId).toBe("function");
    expect(typeof repository?.getEmployeeAttendanceToday).toBe("function");
    expect(typeof repository?.getEmployeeAttendanceHistory).toBe("function");
    expect(typeof repository?.getEmployeeLeaveOverview).toBe("function");
    expect(typeof repository?.getAdminAttendanceToday).toBe("function");
    expect(typeof repository?.getAdminAttendanceList).toBe("function");
    expect(typeof repository?.getAdminRequests).toBe("function");
  });

  it("returns contract-aligned employee responses", () => {
    const repository = createSeedRepository({
      world: canonicalSeedWorld,
      now: repositoryNow,
    });

    const todayResponse = repository?.getEmployeeAttendanceToday({
      employeeId: "emp_001",
      date: "2026-04-13",
    });
    const historyResponse = repository?.getEmployeeAttendanceHistory({
      employeeId: "emp_001",
      from: "2026-04-10",
      to: "2026-04-13",
    });
    const leaveOverview = repository?.getEmployeeLeaveOverview({
      employeeId: "emp_004",
      date: "2026-04-16",
    });

    expect(() =>
      attendanceTodayResponseSchema.parse(todayResponse),
    ).not.toThrow();
    expect(attendanceTodayResponseSchema.parse(todayResponse)).toMatchObject({
      date: "2026-04-13",
      employee: {
        id: "emp_001",
      },
      todayRecord: {
        date: "2026-04-13",
        clockInSource: "beacon",
        clockOutAt: null,
      },
      display: {
        nextAction: {
          type: "clock_out",
        },
      },
    });

    expect(() =>
      attendanceHistoryResponseSchema.parse(historyResponse),
    ).not.toThrow();
    expect(
      attendanceHistoryResponseSchema.parse(historyResponse),
    ).toMatchObject({
      from: "2026-04-10",
      to: "2026-04-13",
      records: expect.arrayContaining([
        expect.objectContaining({
          date: "2026-04-10",
        }),
      ]),
    });

    expect(() =>
      leaveOverviewResponseSchema.parse(leaveOverview),
    ).not.toThrow();
    expect(leaveOverviewResponseSchema.parse(leaveOverview)).toMatchObject({
      balance: {
        totalDays: 15,
        usedDays: 1,
        remainingDays: 14,
      },
      selectedDateContext: {
        date: "2026-04-16",
        leaveConflict: {
          companyEventContext: [
            {
              id: "company_event_2026-04-16_spring-launch",
            },
          ],
          requiresApprovalConfirmation: true,
        },
      },
      requests: expect.arrayContaining([
        expect.objectContaining({
          id: "leave_request_emp_004_2026-04-16_change",
          activeRequestId: "leave_request_emp_004_2026-04-16_change",
          effectiveRequestId: "leave_request_emp_004_2026-04-16_root",
          effectiveStatus: "approved",
          isTopSurfaceSuppressed: false,
        }),
      ]),
    });
  });

  it("returns contract-aligned admin responses", () => {
    const repository = createSeedRepository({
      world: canonicalSeedWorld,
      now: repositoryNow,
    });

    const todayResponse = repository?.getAdminAttendanceToday({
      date: "2026-04-13",
    });
    const listResponse = repository?.getAdminAttendanceList({
      from: "2026-04-10",
      to: "2026-04-13",
      name: "Minji",
    });
    const requestsResponse = repository?.getAdminRequests({
      view: "all",
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
      },
    });

    expect(() =>
      adminAttendanceListResponseSchema.parse(listResponse),
    ).not.toThrow();
    const parsedListResponse =
      adminAttendanceListResponseSchema.parse(listResponse);

    expect(parsedListResponse.filters).toEqual({
      name: "minji",
    });
    expect(parsedListResponse.total).toBe(4);
    expect(parsedListResponse.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employee: expect.objectContaining({
            id: "emp_001",
          }),
        }),
      ]),
    );

    expect(() =>
      adminRequestsResponseSchema.parse(requestsResponse),
    ).not.toThrow();
    expect(adminRequestsResponseSchema.parse(requestsResponse)).toMatchObject({
      viewFilter: "all",
      items: expect.arrayContaining([
        expect.objectContaining({
          id: "leave_request_emp_004_2026-04-16_change",
          requestType: "leave",
        }),
        expect.objectContaining({
          id: "manual_request_emp_010_2026-04-13_resubmission",
          requestType: "manual_attendance",
        }),
      ]),
    });
  });

  it("finds employees and request chains through lookup helpers", () => {
    const repository = createSeedRepository({
      world: canonicalSeedWorld,
      now: repositoryNow,
    });

    const employee = repository?.findEmployeeById("emp_010");
    const requestChain = repository?.findRequestChainByRequestId(
      "leave_request_emp_010_2026-04-20_resubmission",
    );

    expect(employee).toMatchObject({
      id: "emp_010",
      name: "Hyunwoo Baek",
    });
    expect(requestChain).toMatchObject({
      rootRequestId: "leave_request_emp_010_2026-04-20_root",
      requestType: "leave",
      requestIds: [
        "leave_request_emp_010_2026-04-20_root",
        "leave_request_emp_010_2026-04-20_resubmission",
      ],
      activeRequestId: "leave_request_emp_010_2026-04-20_resubmission",
      effectiveRequestId: "leave_request_emp_010_2026-04-20_resubmission",
    });
  });
});
