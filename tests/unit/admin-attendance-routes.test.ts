import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  adminAttendanceListResponseSchema,
  adminAttendanceTodayResponseSchema,
} from "@/lib/contracts/admin-attendance";
import { createSeedRepository } from "@/lib/repositories";
import { canonicalSeedWorld } from "@/lib/seed/world";

const mocks = vi.hoisted(() => {
  const requestLogger = {
    info: vi.fn(),
  };

  return {
    requestLogger,
    createRequestLoggerMock: vi.fn(() => requestLogger),
  };
});

vi.mock("@/lib/server/logger", () => ({
  createRequestLogger: mocks.createRequestLoggerMock,
}));

import { GET as getAdminAttendanceList } from "@/app/api/admin/attendance/list/route";
import { GET as getAdminAttendanceToday } from "@/app/api/admin/attendance/today/route";

const baselineDate = canonicalSeedWorld.baselineDate;
const seededRepository = createSeedRepository({
  world: canonicalSeedWorld,
});

beforeEach(() => {
  mocks.requestLogger.info.mockClear();
  mocks.createRequestLoggerMock.mockClear();
});

describe("admin attendance route handlers", () => {
  it("returns the seeded admin today payload, logs one fetch event, and keeps the summary aligned with visible rows", async () => {
    const expectedBody = seededRepository.getAdminAttendanceToday({
      date: baselineDate,
    });

    const response = await getAdminAttendanceToday(
      new Request("https://example.com/api/admin/attendance/today"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expectedBody);
    expect(() => adminAttendanceTodayResponseSchema.parse(body)).not.toThrow();
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

    expect(body.items.some((item) => item.todayRecord === null)).toBe(true);
    expect(body.summary.checkedInCount).toBe(
      body.items.filter((item) => item.todayRecord !== null).length,
    );
    expect(body.summary.previousDayOpenCount).toBe(
      body.items.filter((item) => item.previousDayOpenRecord !== null).length,
    );
    expect(body.summary.failedAttemptCount).toBe(
      body.items.filter((item) => item.latestFailedAttempt !== null).length,
    );
    expect(body.summary.onLeaveCount).toBe(
      body.items.filter((item) => item.expectedWorkday.leaveCoverage !== null)
        .length,
    );
    expect(body.summary.notCheckedInCount).toBe(
      body.items.filter(
        (item) =>
          item.todayRecord === null &&
          item.expectedWorkday.countsTowardAdminSummary &&
          item.expectedWorkday.leaveCoverage === null &&
          item.display.activeExceptions.includes("not_checked_in"),
      ).length,
    );

    const carryOverRow = body.items.find(
      (item) => item.previousDayOpenRecord !== null,
    );

    expect(carryOverRow).toBeDefined();
    expect(carryOverRow?.previousDayOpenRecord?.date).toBe("2026-04-10");
    expect(carryOverRow?.manualRequest).toBeNull();

    const activeManualRequestRow = body.items.find(
      (item) => item.manualRequest !== null,
    );

    expect(activeManualRequestRow).toBeDefined();
    expect(activeManualRequestRow?.employee.id).toBe("emp_010");
    expect(activeManualRequestRow?.manualRequest?.date).toBe(baselineDate);

    const approvedWritebackRow = body.items.find(
      (item) => item.employee.id === "emp_007",
    );

    expect(approvedWritebackRow).toBeDefined();
    expect(approvedWritebackRow?.manualRequest).toBeNull();
  });

  it("returns the seeded admin list payload for a valid name filter, logs one fetch event, and keeps attendance-history rows free of embedded carry-over projections", async () => {
    const expectedBody = seededRepository.getAdminAttendanceList({
      from: "2026-04-10",
      to: "2026-04-13",
      name: "alex",
    });

    const response = await getAdminAttendanceList(
      new Request(
        "https://example.com/api/admin/attendance/list?from=2026-04-10&to=2026-04-13&name=alex",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expectedBody);
    expect(() => adminAttendanceListResponseSchema.parse(body)).not.toThrow();
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

    expect(body.records.every((record) => !("manualRequest" in record))).toBe(
      true,
    );
    expect(
      body.records.every((record) => !("previousDayOpenRecord" in record)),
    ).toBe(true);
  });

  it.each([
    [
      "missing from",
      "https://example.com/api/admin/attendance/list?to=2026-04-13",
      'Invalid query parameter "from": Invalid input: expected string, received undefined',
    ],
    [
      "missing to",
      "https://example.com/api/admin/attendance/list?from=2026-04-10",
      'Invalid query parameter "to": Invalid input: expected string, received undefined',
    ],
    [
      "empty name",
      "https://example.com/api/admin/attendance/list?from=2026-04-10&to=2026-04-13&name=",
      'Invalid query parameter "name": Too small: expected string to have >=1 characters',
    ],
  ])(
    "returns the shared validation envelope for %s and does not log",
    async (_label, url, message) => {
      const response = await getAdminAttendanceList(new Request(url));

      expect(response.status).toBe(400);
      expect(mocks.createRequestLoggerMock).not.toHaveBeenCalled();
      expect(mocks.requestLogger.info).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "validation_error",
          message,
        },
      });
    },
  );
});
