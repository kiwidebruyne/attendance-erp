import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  adminAttendanceListResponseSchema,
  adminAttendanceTodayResponseSchema,
} from "@/lib/contracts/admin-attendance";
import { canonicalSeedWorld } from "@/lib/seed/world";

const mocks = vi.hoisted(() => {
  const requestLogger = {
    info: vi.fn(),
  };

  return {
    requestLogger,
    createRequestLoggerMock: vi.fn(() => requestLogger),
    getAdminAttendanceTodayMock: vi.fn(),
    getAdminAttendanceListMock: vi.fn(),
  };
});

vi.mock("@/lib/server/logger", () => ({
  createRequestLogger: mocks.createRequestLoggerMock,
}));

vi.mock("@/app/api/admin/attendance/_lib/repository", () => ({
  adminAttendanceRepository: {
    getAdminAttendanceToday: mocks.getAdminAttendanceTodayMock,
    getAdminAttendanceList: mocks.getAdminAttendanceListMock,
  },
}));

import { GET as getAdminAttendanceList } from "@/app/api/admin/attendance/list/route";
import { GET as getAdminAttendanceToday } from "@/app/api/admin/attendance/today/route";

const baselineDate = canonicalSeedWorld.baselineDate;

beforeEach(() => {
  mocks.requestLogger.info.mockClear();
  mocks.createRequestLoggerMock.mockClear();
  mocks.getAdminAttendanceTodayMock.mockClear();
  mocks.getAdminAttendanceListMock.mockClear();
});

describe("admin attendance route handlers", () => {
  it("returns the admin today payload unchanged and logs one fetch event", async () => {
    const responseFixture = {
      date: baselineDate,
      summary: {
        checkedInCount: 7,
        notCheckedInCount: 2,
        lateCount: 1,
        onLeaveCount: 1,
        failedAttemptCount: 1,
        previousDayOpenCount: 1,
      },
      items: [
        {
          employee: {
            id: "emp_003",
            name: "Jisoo Lee",
            department: "Engineering",
          },
          expectedWorkday: {
            isWorkday: true,
            expectedClockInAt: `${baselineDate}T09:00:00+09:00`,
            expectedClockOutAt: `${baselineDate}T18:00:00+09:00`,
            adjustedClockInAt: `${baselineDate}T09:00:00+09:00`,
            adjustedClockOutAt: `${baselineDate}T18:00:00+09:00`,
            countsTowardAdminSummary: true,
            leaveCoverage: null,
          },
          todayRecord: null,
          display: {
            phase: "before_check_in",
            flags: [],
            activeExceptions: ["not_checked_in"],
            nextAction: {
              type: "clock_in",
              relatedRequestId: null,
            },
          },
          latestFailedAttempt: null,
          previousDayOpenRecord: null,
          manualRequest: null,
        },
        {
          employee: {
            id: "emp_001",
            name: "Minji Park",
            department: "Operations",
          },
          expectedWorkday: {
            isWorkday: true,
            expectedClockInAt: `${baselineDate}T09:00:00+09:00`,
            expectedClockOutAt: `${baselineDate}T18:00:00+09:00`,
            adjustedClockInAt: `${baselineDate}T09:00:00+09:00`,
            adjustedClockOutAt: `${baselineDate}T18:00:00+09:00`,
            countsTowardAdminSummary: true,
            leaveCoverage: null,
          },
          todayRecord: null,
          display: {
            phase: "before_check_in",
            flags: [],
            activeExceptions: [
              "previous_day_checkout_missing",
              "not_checked_in",
            ],
            nextAction: {
              type: "resolve_previous_day_checkout",
              relatedRequestId: null,
            },
          },
          latestFailedAttempt: null,
          previousDayOpenRecord: {
            date: "2026-04-10",
            clockInAt: "2026-04-10T08:56:00+09:00",
            clockOutAt: null,
            expectedClockOutAt: "2026-04-10T18:00:00+09:00",
          },
          manualRequest: {
            id: "manual_request_emp_001_2026-04-10_root",
            requestType: "manual_attendance",
            action: "clock_in",
            date: "2026-04-10",
            submittedAt: "2026-04-10T11:25:00+09:00",
            requestedClockInAt: "2026-04-10T09:02:00+09:00",
            requestedClockOutAt: null,
            reason: "Beacon was still not detecting the prior-day checkout.",
            status: "pending",
            reviewedAt: null,
            reviewComment: null,
            governingReviewComment:
              "Please resubmit after confirming the prior-day checkout.",
            rootRequestId: "manual_request_emp_001_2026-04-10_root",
            parentRequestId: null,
            followUpKind: null,
            supersededByRequestId: null,
            activeRequestId: "manual_request_emp_001_2026-04-10_root",
            activeStatus: "pending",
            effectiveRequestId: "manual_request_emp_001_2026-04-10_root",
            effectiveStatus: "pending",
            hasActiveFollowUp: false,
            nextAction: "admin_review",
          },
        },
        {
          employee: {
            id: "emp_007",
            name: "Doyun Choi",
            department: "Customer Success",
          },
          expectedWorkday: {
            isWorkday: true,
            expectedClockInAt: `${baselineDate}T09:00:00+09:00`,
            expectedClockOutAt: `${baselineDate}T18:00:00+09:00`,
            adjustedClockInAt: `${baselineDate}T09:00:00+09:00`,
            adjustedClockOutAt: `${baselineDate}T18:00:00+09:00`,
            countsTowardAdminSummary: true,
            leaveCoverage: null,
          },
          todayRecord: {
            id: "attendance_record_emp_007_2026-04-03",
            date: "2026-04-03",
            clockInAt: "2026-04-03T09:00:00+09:00",
            clockInSource: "beacon",
            clockOutAt: "2026-04-03T18:05:00+09:00",
            clockOutSource: "manual",
            workMinutes: 545,
          },
          display: {
            phase: "checked_out",
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
        },
      ],
    };

    mocks.getAdminAttendanceTodayMock.mockReturnValue(responseFixture);

    const response = await getAdminAttendanceToday(
      new Request("https://example.com/api/admin/attendance/today"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.createRequestLoggerMock).toHaveBeenCalledTimes(1);
    expect(mocks.createRequestLoggerMock).toHaveBeenCalledWith(
      expect.any(Request),
      {
        bindings: {
          date: baselineDate,
        },
      },
    );
    expect(mocks.requestLogger.info).toHaveBeenCalledTimes(1);
    expect(mocks.requestLogger.info).toHaveBeenCalledWith(
      {
        event: "admin.attendance.today.fetch",
        date: baselineDate,
      },
      "Fetched admin attendance today",
    );
    expect(mocks.getAdminAttendanceTodayMock).toHaveBeenCalledTimes(1);
    expect(mocks.getAdminAttendanceTodayMock).toHaveBeenCalledWith({
      date: baselineDate,
    });

    expect(() => adminAttendanceTodayResponseSchema.parse(body)).not.toThrow();
    expect(body).toEqual(responseFixture);
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employee: expect.objectContaining({
            id: "emp_003",
          }),
          todayRecord: null,
        }),
        expect.objectContaining({
          employee: expect.objectContaining({
            id: "emp_001",
          }),
          manualRequest: expect.objectContaining({
            date: "2026-04-10",
          }),
        }),
        expect.objectContaining({
          employee: expect.objectContaining({
            id: "emp_007",
          }),
          manualRequest: null,
        }),
      ]),
    );
  });

  it("parses the admin list query, logs one fetch event, and returns the repo payload unchanged", async () => {
    const responseFixture = {
      from: "2026-04-10",
      to: "2026-04-13",
      filters: {
        name: "alex",
      },
      total: 1,
      records: [
        {
          date: "2026-04-13",
          employee: {
            id: "emp_001",
            name: "Alex Kim",
            department: "Product",
          },
          expectedWorkday: {
            isWorkday: true,
            expectedClockInAt: "2026-04-13T09:00:00+09:00",
            expectedClockOutAt: "2026-04-13T18:00:00+09:00",
            adjustedClockInAt: "2026-04-13T09:00:00+09:00",
            adjustedClockOutAt: "2026-04-13T18:00:00+09:00",
            countsTowardAdminSummary: true,
            leaveCoverage: null,
          },
          record: null,
          display: {
            phase: "before_check_in",
            flags: [],
            activeExceptions: ["not_checked_in"],
            nextAction: {
              type: "clock_in",
              relatedRequestId: null,
            },
          },
          latestFailedAttempt: null,
        },
      ],
    };

    mocks.getAdminAttendanceListMock.mockReturnValue(responseFixture);

    const response = await getAdminAttendanceList(
      new Request(
        "https://example.com/api/admin/attendance/list?from=2026-04-10&to=2026-04-13&name=alex",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.createRequestLoggerMock).toHaveBeenCalledTimes(1);
    expect(mocks.createRequestLoggerMock).toHaveBeenCalledWith(
      expect.any(Request),
      {
        bindings: {
          from: "2026-04-10",
          to: "2026-04-13",
          name: "alex",
        },
      },
    );
    expect(mocks.requestLogger.info).toHaveBeenCalledTimes(1);
    expect(mocks.requestLogger.info).toHaveBeenCalledWith(
      {
        event: "admin.attendance.list.fetch",
        from: "2026-04-10",
        to: "2026-04-13",
        name: "alex",
      },
      "Fetched admin attendance list",
    );
    expect(mocks.getAdminAttendanceListMock).toHaveBeenCalledTimes(1);
    expect(mocks.getAdminAttendanceListMock).toHaveBeenCalledWith({
      from: "2026-04-10",
      to: "2026-04-13",
      name: "alex",
    });

    expect(() => adminAttendanceListResponseSchema.parse(body)).not.toThrow();
    expect(body).toEqual(responseFixture);
    expect(body.records[0]).not.toHaveProperty("manualRequest");
    expect(body.records[0]).not.toHaveProperty("previousDayOpenRecord");
  });

  it("returns the shared validation envelope for an empty admin name query and does not log", async () => {
    const response = await getAdminAttendanceList(
      new Request(
        "https://example.com/api/admin/attendance/list?from=2026-04-10&to=2026-04-13&name=",
      ),
    );

    expect(response.status).toBe(400);
    expect(mocks.createRequestLoggerMock).not.toHaveBeenCalled();
    expect(mocks.requestLogger.info).not.toHaveBeenCalled();
    expect(mocks.getAdminAttendanceListMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "validation_error",
        message:
          'Invalid query parameter "name": Too small: expected string to have >=1 characters',
      },
    });
  });
});
