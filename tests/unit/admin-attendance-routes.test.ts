import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  adminAttendanceListResponseSchema,
  adminAttendanceTodayResponseSchema,
} from "@/lib/contracts/admin-attendance";
import { createSeedRepository } from "@/lib/repositories";
import { canonicalSeedWorld } from "@/lib/seed/world";
import { resetMockSeedWorldForTests } from "@/lib/server/mock-state";

const repositoryModulePath = "@/app/api/admin/attendance/_lib/repository";
const todayRouteModulePath = "@/app/api/admin/attendance/today/route";
const listRouteModulePath = "@/app/api/admin/attendance/list/route";

const mocks = vi.hoisted(() => {
  const requestLogger = {
    info: vi.fn(),
    warn: vi.fn(),
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
      getAdminAttendanceBaselineDate: () => world.baselineDate,
      createAdminAttendanceRepository: () =>
        createSeedRepository({
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
      getAdminAttendanceBaselineDate: () => world.baselineDate,
      createAdminAttendanceRepository: () =>
        createSeedRepository({
          world,
        }),
    }));
  }

  const { GET } = await import(listRouteModulePath);

  return GET;
}

beforeEach(() => {
  resetMockSeedWorldForTests();
  mocks.requestLogger.info.mockClear();
  mocks.requestLogger.warn.mockClear();
  mocks.createRequestLoggerMock.mockClear();
});

afterEach(() => {
  resetMockSeedWorldForTests();
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

  it("keeps same-day manual request dates on the matching today row", async () => {
    const seededManualRequestRow = seededRepository
      .getAdminAttendanceToday({
        date: baselineDate,
      })
      .items.find((item) => item.employee.id === "emp_010");

    expect(seededManualRequestRow).toBeDefined();
    expect(seededManualRequestRow?.manualRequest?.date).toBe("2026-04-13");

    const modifiedWorld = structuredClone(canonicalSeedWorld);

    modifiedWorld.manualAttendanceRequests.push({
      id: "manual_request_emp_001_2026-04-13_root",
      employeeId: "emp_001",
      requestType: "manual_attendance",
      action: "clock_in",
      date: "2026-04-13",
      submittedAt: "2026-04-13T12:30:00+09:00",
      requestedClockInAt: "2026-04-13T09:04:00+09:00",
      requestedClockOutAt: null,
      reason: "Same-day manual request should stay on the same row.",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: "manual_request_emp_001_2026-04-13_root",
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

    const updatedManualRequestRow = body.items.find(
      (item) => item.employee.id === "emp_001",
    );

    expect(updatedManualRequestRow).toBeDefined();
    expect(updatedManualRequestRow?.manualRequest?.date).toBe("2026-04-13");
    expect(updatedManualRequestRow?.manualRequest?.status).toBe("pending");
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
  });

  it.each([
    [
      "missing from",
      "https://example.com/api/admin/attendance/list?to=2026-04-13",
      {
        from: undefined,
        to: "2026-04-13",
        name: undefined,
      },
      "from",
    ],
    [
      "missing to",
      "https://example.com/api/admin/attendance/list?from=2026-04-10",
      {
        from: "2026-04-10",
        to: undefined,
        name: undefined,
      },
      "to",
    ],
    [
      "empty name",
      "https://example.com/api/admin/attendance/list?from=2026-04-10&to=2026-04-13&name=",
      {
        from: "2026-04-10",
        to: "2026-04-13",
        name: "",
      },
      "name",
    ],
    [
      "whitespace-only name",
      "https://example.com/api/admin/attendance/list?from=2026-04-10&to=2026-04-13&name=%20%20%20",
      {
        from: "2026-04-10",
        to: "2026-04-13",
        name: "",
      },
      "name",
    ],
    [
      "duplicate name with blank last value",
      "https://example.com/api/admin/attendance/list?from=2026-04-10&to=2026-04-13&name=alex&name=%20%20%20",
      {
        from: "2026-04-10",
        to: "2026-04-13",
        name: "",
      },
      "name",
    ],
  ])(
    "returns the shared validation envelope for %s and logs the invalid query",
    async (_label, url, expectedBindings, paramName) => {
      const GET = await loadListRoute();
      const response = await GET(new Request(url));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("validation_error");
      expect(body.error.message).toContain(paramName);
      expect(mocks.createRequestLoggerMock).toHaveBeenCalledTimes(1);
      expect(mocks.createRequestLoggerMock).toHaveBeenCalledWith(
        expect.any(Request),
        {
          bindings: expectedBindings,
        },
      );
      expect(mocks.requestLogger.info).not.toHaveBeenCalled();
      expect(mocks.requestLogger.warn).toHaveBeenCalledTimes(1);
      expect(mocks.requestLogger.warn).toHaveBeenCalledWith(
        {
          event: "admin.attendance.list.validation_failed",
        },
        "Rejected invalid admin attendance list query",
      );
    },
  );
});
