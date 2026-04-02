import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  adminAttendanceListResponseSchema,
  adminAttendanceTodayResponseSchema,
} from "@/lib/contracts/admin-attendance";
import { createSeedRepository } from "@/lib/repositories";
import { canonicalSeedWorld } from "@/lib/seed/world";

const repositoryModulePath = "@/app/api/admin/attendance/_lib/repository";
const todayRouteModulePath = "@/app/api/admin/attendance/today/route";
const listRouteModulePath = "@/app/api/admin/attendance/list/route";

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

const baselineDate = canonicalSeedWorld.baselineDate;
const seededRepository = createSeedRepository({
  world: canonicalSeedWorld,
});

async function loadTodayRoute(world = canonicalSeedWorld) {
  vi.resetModules();
  vi.doUnmock(repositoryModulePath);

  if (world !== canonicalSeedWorld) {
    vi.doMock(repositoryModulePath, () => ({
      adminAttendanceBaselineDate: world.baselineDate,
      adminAttendanceRepository: createSeedRepository({
        world,
      }),
    }));
  }

  const { GET } = await import(todayRouteModulePath);

  return GET;
}

async function loadListRoute(world = canonicalSeedWorld) {
  vi.resetModules();
  vi.doUnmock(repositoryModulePath);

  if (world !== canonicalSeedWorld) {
    vi.doMock(repositoryModulePath, () => ({
      adminAttendanceBaselineDate: world.baselineDate,
      adminAttendanceRepository: createSeedRepository({
        world,
      }),
    }));
  }

  const { GET } = await import(listRouteModulePath);

  return GET;
}

beforeEach(() => {
  mocks.requestLogger.info.mockClear();
  mocks.createRequestLoggerMock.mockClear();
});

afterEach(() => {
  vi.doUnmock(repositoryModulePath);
  vi.resetModules();
});

describe("admin attendance route handlers", () => {
  it("returns the seeded admin today payload, logs one fetch event, and keeps the summary aligned with visible rows", async () => {
    const GET = await loadTodayRoute();
    const expectedBody = seededRepository.getAdminAttendanceToday({
      date: baselineDate,
    });

    const response = await GET(
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

  it("preserves a prior-workday manual request date on the carry-over row when the prior workday still governs the today surface", async () => {
    const carryOverRow = seededRepository
      .getAdminAttendanceToday({
        date: baselineDate,
      })
      .items.find((item) => item.previousDayOpenRecord !== null);

    expect(carryOverRow).toBeDefined();
    expect(carryOverRow?.employee.id).toBe("emp_001");
    expect(carryOverRow?.previousDayOpenRecord?.date).toBe("2026-04-10");

    const modifiedWorld = structuredClone(canonicalSeedWorld);

    modifiedWorld.manualAttendanceRequests.push({
      id: "manual_request_emp_001_2026-04-10_root",
      employeeId: "emp_001",
      requestType: "manual_attendance",
      action: "clock_in",
      date: "2026-04-10",
      submittedAt: "2026-04-10T12:30:00+09:00",
      requestedClockInAt: "2026-04-10T09:04:00+09:00",
      requestedClockOutAt: null,
      reason: "Prior-day checkout is still being resolved.",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: "manual_request_emp_001_2026-04-10_root",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    });

    const GET = await loadTodayRoute(modifiedWorld);
    const response = await GET(
      new Request("https://example.com/api/admin/attendance/today"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(() => adminAttendanceTodayResponseSchema.parse(body)).not.toThrow();
    expect(mocks.createRequestLoggerMock).toHaveBeenCalledTimes(1);
    expect(mocks.requestLogger.info).toHaveBeenCalledTimes(1);
    expect(mocks.requestLogger.info).toHaveBeenCalledWith(
      {
        event: "admin.attendance.today.fetch",
        date: baselineDate,
      },
      "Fetched admin attendance today",
    );

    const updatedCarryOverRow = body.items.find(
      (item) => item.employee.id === "emp_001",
    );

    expect(updatedCarryOverRow).toBeDefined();
    expect(updatedCarryOverRow?.previousDayOpenRecord?.date).toBe("2026-04-10");
    expect(updatedCarryOverRow?.manualRequest?.date).toBe("2026-04-10");
    expect(updatedCarryOverRow?.manualRequest?.status).toBe("pending");
  });

  it("returns the seeded admin list payload for a valid name filter, logs one fetch event, and keeps attendance-history rows free of embedded carry-over projections", async () => {
    const GET = await loadListRoute();
    const expectedBody = seededRepository.getAdminAttendanceList({
      from: "2026-04-10",
      to: "2026-04-13",
      name: "alex",
    });

    const response = await GET(
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
      "from",
    ],
    [
      "missing to",
      "https://example.com/api/admin/attendance/list?from=2026-04-10",
      "to",
    ],
    [
      "empty name",
      "https://example.com/api/admin/attendance/list?from=2026-04-10&to=2026-04-13&name=",
      "name",
    ],
  ])(
    "returns the shared validation envelope for %s and does not log",
    async (_label, url, paramName) => {
      const GET = await loadListRoute();
      const response = await GET(new Request(url));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("validation_error");
      expect(body.error.message).toContain(paramName);
      expect(mocks.createRequestLoggerMock).not.toHaveBeenCalled();
      expect(mocks.requestLogger.info).not.toHaveBeenCalled();
    },
  );
});
