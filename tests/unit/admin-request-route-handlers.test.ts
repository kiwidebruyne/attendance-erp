import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  adminRequestDecisionResponseSchema,
  adminRequestsResponseSchema,
} from "@/lib/contracts/requests";
import { createSeedRepository } from "@/lib/repositories";
import {
  createLeaveRequest,
  LeaveRequestConflictError,
} from "@/lib/repositories/leave";
import { buildFixedSeoulDateTime } from "@/lib/seed/seoul-clock";
import { type CanonicalSeedWorld, canonicalSeedWorld } from "@/lib/seed/world";
import {
  getMockSeedWorld,
  resetMockSeedWorldForTests,
  setMockSeedWorldForTests,
} from "@/lib/server/mock-state";

const getRouteModulePath = "@/app/api/admin/requests/route";
const patchRouteModulePath = "@/app/api/admin/requests/[id]/route";

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

function createWorld() {
  return structuredClone(canonicalSeedWorld) as CanonicalSeedWorld;
}

async function loadGetRoute() {
  const { GET } = await import(getRouteModulePath);

  return GET;
}

async function loadPatchRoute() {
  const { PATCH } = await import(patchRouteModulePath);

  return PATCH;
}

async function getAdminRequestsRoute(url: string) {
  const GET = await loadGetRoute();
  return GET(new Request(url));
}

async function patchAdminRequestRoute(id: string, body: object) {
  const PATCH = await loadPatchRoute();
  return PATCH(
    new Request(`https://example.com/api/admin/requests/${id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    {
      params: Promise.resolve({ id }),
    },
  );
}

beforeEach(() => {
  resetMockSeedWorldForTests();
  mocks.requestLogger.info.mockClear();
  mocks.requestLogger.warn.mockClear();
  mocks.createRequestLoggerMock.mockClear();
});

afterEach(() => {
  resetMockSeedWorldForTests();
});

describe("admin request route handlers", () => {
  it("defaults GET /api/admin/requests to the needs_review queue and logs the fetch", async () => {
    const response = await getAdminRequestsRoute(
      "https://example.com/api/admin/requests",
    );
    const body = adminRequestsResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.viewFilter).toBe("needs_review");
    expect(mocks.createRequestLoggerMock).toHaveBeenCalledWith(
      expect.any(Request),
      {
        bindings: {
          view: "needs_review",
        },
      },
    );
    expect(mocks.requestLogger.info).toHaveBeenCalledWith(
      {
        event: "admin.requests.fetch",
        view: "needs_review",
        itemCount: body.items.length,
      },
      "Fetched admin requests",
    );
  });

  it("returns validation_error for legacy admin request filters and logs the failure", async () => {
    const response = await getAdminRequestsRoute(
      "https://example.com/api/admin/requests?view=waiting_for_employee",
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "validation_error",
        message:
          'Invalid query parameter "view": Invalid option: expected one of "needs_review"|"completed"|"all"',
      },
    });
    expect(mocks.requestLogger.warn).toHaveBeenCalledWith(
      {
        event: "admin.requests.validation_failed",
        view: "waiting_for_employee",
      },
      "Rejected invalid admin request query",
    );
  });

  it("keeps reviewed non-approved leave history in completed results without leaveConflict or suppression metadata", async () => {
    const world = createWorld();

    world.leaveRequests.push({
      id: "leave_request_emp_001_2026-04-16_rejected",
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-16",
      startAt: null,
      endAt: null,
      reason: "Rejected history on a company-event date should stay read-only.",
      requestedAt: "2026-04-15T09:00:00+09:00",
      status: "rejected",
      reviewedAt: "2026-04-15T11:00:00+09:00",
      reviewComment: "Please resubmit after adjusting the staffing plan.",
      rootRequestId: "leave_request_emp_001_2026-04-16_rejected",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    });
    setMockSeedWorldForTests(world);

    const response = await getAdminRequestsRoute(
      "https://example.com/api/admin/requests?view=completed",
    );
    const body = adminRequestsResponseSchema.parse(await response.json());
    const item = body.items.find(
      (candidate) =>
        candidate.id === "leave_request_emp_001_2026-04-16_rejected",
    );

    expect(response.status).toBe(200);
    expect(item).toMatchObject({
      id: "leave_request_emp_001_2026-04-16_rejected",
      status: "rejected",
      activeRequestId: null,
      activeStatus: null,
      effectiveRequestId: "leave_request_emp_001_2026-04-16_rejected",
      effectiveStatus: "rejected",
      nextAction: "none",
    });
    expect(item).not.toHaveProperty("leaveConflict");
    expect(item).not.toHaveProperty("isTopSurfaceSuppressed");
  });

  it("approves the current pending manual request, appends a review event, and writes the manual attendance record back", async () => {
    const response = await patchAdminRequestRoute(
      "manual_request_emp_010_2026-04-09_root",
      {
        decision: "approve",
      },
    );
    const body = adminRequestDecisionResponseSchema.parse(
      await response.json(),
    );
    const world = getMockSeedWorld();
    const approvedRecord = world.attendanceRecords.find(
      (record) =>
        record.employeeId === "emp_010" && record.date === "2026-04-09",
    );
    const reviewEvent = world.requestReviewEvents.find(
      (event) => event.requestId === "manual_request_emp_010_2026-04-09_root",
    );
    const queue = createSeedRepository({ world }).getAdminRequests({
      view: "needs_review",
    });

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: "manual_request_emp_010_2026-04-09_root",
      requestType: "manual_attendance",
      status: "approved",
      reviewComment: null,
      governingReviewComment: null,
      activeRequestId: null,
      activeStatus: null,
      effectiveRequestId: "manual_request_emp_010_2026-04-09_root",
      effectiveStatus: "approved",
      hasActiveFollowUp: false,
      nextAction: "none",
      reviewedAt: buildFixedSeoulDateTime(
        canonicalSeedWorld.baselineDate,
        "12:00:00",
      ),
    });
    expect(reviewEvent).toMatchObject({
      requestId: "manual_request_emp_010_2026-04-09_root",
      decision: "approve",
      reviewerId: "emp_012",
      reviewComment: null,
      reviewedAt: buildFixedSeoulDateTime(
        canonicalSeedWorld.baselineDate,
        "12:00:00",
      ),
    });
    expect(approvedRecord).toMatchObject({
      employeeId: "emp_010",
      date: "2026-04-09",
      clockInAt: "2026-04-09T09:07:00+09:00",
      clockInSource: "manual",
      clockOutAt: null,
      clockOutSource: null,
      workMinutes: null,
      manualRequestId: "manual_request_emp_010_2026-04-09_root",
    });
    expect(
      queue.items.some(
        (item) => item.id === "manual_request_emp_010_2026-04-09_root",
      ),
    ).toBe(false);
  });

  it("supports reject and request_revision decisions for current pending requests", async () => {
    const rejectResponse = await patchAdminRequestRoute(
      "leave_request_emp_006_2026-04-17_root",
      {
        decision: "reject",
        reviewComment: "Coverage is too thin for this date.",
      },
    );
    const rejectBody = adminRequestDecisionResponseSchema.parse(
      await rejectResponse.json(),
    );

    expect(rejectResponse.status).toBe(200);
    expect(rejectBody).toMatchObject({
      id: "leave_request_emp_006_2026-04-17_root",
      requestType: "leave",
      status: "rejected",
      reviewComment: "Coverage is too thin for this date.",
      governingReviewComment: "Coverage is too thin for this date.",
      activeRequestId: null,
      activeStatus: null,
      effectiveRequestId: "leave_request_emp_006_2026-04-17_root",
      effectiveStatus: "rejected",
      nextAction: "none",
    });

    const revisionResponse = await patchAdminRequestRoute(
      "manual_request_emp_009_2026-04-08_resubmission",
      {
        decision: "request_revision",
        reviewComment: "Please add the missing arrival detail.",
      },
    );
    const revisionBody = adminRequestDecisionResponseSchema.parse(
      await revisionResponse.json(),
    );

    expect(revisionResponse.status).toBe(200);
    expect(revisionBody).toMatchObject({
      id: "manual_request_emp_009_2026-04-08_resubmission",
      requestType: "manual_attendance",
      status: "revision_requested",
      reviewComment: "Please add the missing arrival detail.",
      governingReviewComment: "Please add the missing arrival detail.",
      activeRequestId: null,
      activeStatus: null,
      effectiveRequestId: "manual_request_emp_009_2026-04-08_resubmission",
      effectiveStatus: "revision_requested",
      nextAction: "none",
    });
  });

  it("supersedes the previously approved leave request after approving a follow-up change", async () => {
    const response = await patchAdminRequestRoute(
      "leave_request_emp_004_2026-04-16_change",
      {
        decision: "approve",
      },
    );
    const body = adminRequestDecisionResponseSchema.parse(
      await response.json(),
    );
    const world = getMockSeedWorld();
    const parentRequest = world.leaveRequests.find(
      (request) => request.id === "leave_request_emp_004_2026-04-16_root",
    );

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: "leave_request_emp_004_2026-04-16_change",
      status: "approved",
      activeRequestId: null,
      activeStatus: null,
      effectiveRequestId: "leave_request_emp_004_2026-04-16_change",
      effectiveStatus: "approved",
      nextAction: "none",
    });
    expect(parentRequest?.supersededByRequestId).toBe(
      "leave_request_emp_004_2026-04-16_change",
    );
    expect(() =>
      createLeaveRequest(
        world,
        "emp_004",
        {
          leaveType: "annual",
          date: "2026-04-16",
          reason: "A superseded approval must not accept another follow-up.",
          parentRequestId: "leave_request_emp_004_2026-04-16_root",
          followUpKind: "cancel",
        },
        buildFixedSeoulDateTime("2026-04-15", "13:00:00"),
      ),
    ).toThrowError(LeaveRequestConflictError);
  });

  it("preserves the prior approved leave as effective when a follow-up change is rejected", async () => {
    const response = await patchAdminRequestRoute(
      "leave_request_emp_004_2026-04-16_change",
      {
        decision: "reject",
        reviewComment: "The approved leave should stay unchanged.",
      },
    );
    const body = adminRequestDecisionResponseSchema.parse(
      await response.json(),
    );
    const world = getMockSeedWorld();
    const repository = createSeedRepository({ world });
    const overview = repository.getEmployeeLeaveOverview({
      employeeId: "emp_004",
      date: "2026-04-16",
    });
    const completedItem = repository
      .getAdminRequests({ view: "completed" })
      .items.find(
        (item) =>
          item.rootRequestId === "leave_request_emp_004_2026-04-16_root",
      );

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: "leave_request_emp_004_2026-04-16_change",
      status: "rejected",
      reviewComment: "The approved leave should stay unchanged.",
      governingReviewComment: "The approved leave should stay unchanged.",
      activeRequestId: null,
      activeStatus: null,
      effectiveRequestId: "leave_request_emp_004_2026-04-16_root",
      effectiveStatus: "approved",
      nextAction: "none",
    });
    expect(overview.balance).toMatchObject({
      totalDays: 15,
      usedDays: 1,
      remainingDays: 14,
    });
    expect(overview.selectedDateContext).toMatchObject({
      date: "2026-04-16",
      leaveConflict: {
        effectiveApprovedLeaveContext: [
          expect.objectContaining({
            requestId: "leave_request_emp_004_2026-04-16_root",
          }),
        ],
      },
    });
    expect(completedItem).toMatchObject({
      id: "leave_request_emp_004_2026-04-16_change",
      status: "rejected",
      reviewComment: "The approved leave should stay unchanged.",
      governingReviewComment: "The approved leave should stay unchanged.",
      effectiveRequestId: "leave_request_emp_004_2026-04-16_root",
      effectiveStatus: "approved",
    });
  });

  it("returns 404 for missing admin review targets", async () => {
    const response = await patchAdminRequestRoute("req_missing", {
      decision: "approve",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "not_found",
        message: 'Request "req_missing" was not found',
      },
    });
  });

  it("returns 409 conflicts for locked, inactive, withdrawn, approved, and superseded admin review targets", async () => {
    const world = createWorld();

    world.leaveRequests.push({
      id: "leave_request_emp_001_2026-04-21_withdrawn",
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-21",
      startAt: null,
      endAt: null,
      reason: "Withdrawn before review.",
      requestedAt: "2026-04-20T09:00:00+09:00",
      status: "withdrawn",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: "leave_request_emp_001_2026-04-21_withdrawn",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    });
    world.leaveRequests.push(
      {
        id: "leave_request_emp_002_2026-04-22_root",
        employeeId: "emp_002",
        requestType: "leave",
        leaveType: "annual",
        date: "2026-04-22",
        startAt: null,
        endAt: null,
        reason: "Original approved request before a superseding cancel.",
        requestedAt: "2026-04-20T10:00:00+09:00",
        status: "approved",
        reviewedAt: "2026-04-20T11:00:00+09:00",
        reviewComment: null,
        rootRequestId: "leave_request_emp_002_2026-04-22_root",
        parentRequestId: null,
        followUpKind: null,
        supersededByRequestId: "leave_request_emp_002_2026-04-22_cancel",
      },
      {
        id: "leave_request_emp_002_2026-04-22_cancel",
        employeeId: "emp_002",
        requestType: "leave",
        leaveType: "annual",
        date: "2026-04-22",
        startAt: null,
        endAt: null,
        reason: "Approved cancel request.",
        requestedAt: "2026-04-20T12:00:00+09:00",
        status: "approved",
        reviewedAt: "2026-04-20T13:00:00+09:00",
        reviewComment: null,
        rootRequestId: "leave_request_emp_002_2026-04-22_root",
        parentRequestId: "leave_request_emp_002_2026-04-22_root",
        followUpKind: "cancel",
        supersededByRequestId: null,
      },
    );
    world.manualAttendanceRequests.push({
      id: "manual_request_emp_001_2026-04-22_reviewed",
      employeeId: "emp_001",
      requestType: "manual_attendance",
      action: "clock_in",
      date: "2026-04-22",
      submittedAt: "2026-04-22T09:05:00+09:00",
      requestedClockInAt: "2026-04-22T09:02:00+09:00",
      requestedClockOutAt: null,
      reason: "Reviewed request with no active follow-up should stay locked.",
      status: "rejected",
      reviewedAt: "2026-04-22T11:00:00+09:00",
      reviewComment: "Please submit a linked follow-up instead.",
      rootRequestId: "manual_request_emp_001_2026-04-22_reviewed",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    });
    setMockSeedWorldForTests(world);

    const reviewedResponse = await patchAdminRequestRoute(
      "manual_request_emp_001_2026-04-22_reviewed",
      {
        decision: "approve",
      },
    );
    const inactiveResponse = await patchAdminRequestRoute(
      "manual_request_emp_010_2026-04-13_root",
      {
        decision: "approve",
      },
    );
    const withdrawnResponse = await patchAdminRequestRoute(
      "leave_request_emp_001_2026-04-21_withdrawn",
      {
        decision: "approve",
      },
    );
    const approvedResponse = await patchAdminRequestRoute(
      "leave_request_emp_005_2026-04-18_root",
      {
        decision: "approve",
      },
    );
    const supersededResponse = await patchAdminRequestRoute(
      "leave_request_emp_002_2026-04-22_root",
      {
        decision: "approve",
      },
    );

    expect(reviewedResponse.status).toBe(409);
    await expect(reviewedResponse.json()).resolves.toMatchObject({
      error: {
        code: "conflict",
        message: expect.stringContaining("linked follow-up"),
      },
    });

    expect(inactiveResponse.status).toBe(409);
    await expect(inactiveResponse.json()).resolves.toMatchObject({
      error: {
        code: "conflict",
        message: expect.stringContaining("current active request"),
      },
    });

    expect(withdrawnResponse.status).toBe(409);
    await expect(withdrawnResponse.json()).resolves.toMatchObject({
      error: {
        code: "conflict",
        message: expect.stringContaining('"withdrawn"'),
      },
    });

    expect(approvedResponse.status).toBe(409);
    await expect(approvedResponse.json()).resolves.toMatchObject({
      error: {
        code: "conflict",
        message: expect.stringContaining('"approved"'),
      },
    });

    expect(supersededResponse.status).toBe(409);
    await expect(supersededResponse.json()).resolves.toMatchObject({
      error: {
        code: "conflict",
        message: expect.stringContaining("superseded"),
      },
    });
  });
});
