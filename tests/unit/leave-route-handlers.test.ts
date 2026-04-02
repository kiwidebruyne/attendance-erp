import { afterEach, describe, expect, it } from "vitest";

import { GET as getLeaveMe } from "@/app/api/leave/me/route";
import { PATCH as patchLeaveRequest } from "@/app/api/leave/request/[id]/route";
import { POST as createLeaveRequestRoute } from "@/app/api/leave/request/route";
import {
  leaveOverviewResponseSchema,
  leaveRequestResponseSchema,
} from "@/lib/contracts/leave";
import { type CanonicalSeedWorld, canonicalSeedWorld } from "@/lib/seed/world";
import {
  resetMockSeedWorldForTests,
  setMockLeaveSuppressionStateForTests,
  setMockSeedWorldForTests,
} from "@/lib/server/mock-state";

function createWorld() {
  return structuredClone(canonicalSeedWorld) as CanonicalSeedWorld;
}

function addPendingAnnualLeaveRequest(world: CanonicalSeedWorld) {
  world.leaveRequests.push({
    id: "leave_request_emp_001_2026-04-14_root",
    employeeId: "emp_001",
    requestType: "leave",
    leaveType: "annual",
    date: "2026-04-14",
    startAt: null,
    endAt: null,
    reason: "Pending annual leave request for PATCH validation coverage.",
    requestedAt: "2026-04-13T09:15:00+09:00",
    status: "pending",
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: "leave_request_emp_001_2026-04-14_root",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
  });
}

afterEach(() => {
  resetMockSeedWorldForTests();
});

describe("leave route handlers", () => {
  it("returns the employee leave overview and selected-date leave conflict context", async () => {
    const response = await getLeaveMe(
      new Request("https://example.com/api/leave/me?date=2026-04-16"),
    );

    expect(response.status).toBe(200);
    expect(
      leaveOverviewResponseSchema.parse(await response.json()),
    ).toMatchObject({
      balance: {
        totalDays: 15,
        usedDays: 0,
        remainingDays: 15,
      },
      selectedDateContext: {
        date: "2026-04-16",
        leaveConflict: {
          companyEventContext: [
            expect.objectContaining({
              id: "company_event_2026-04-16_spring-launch",
            }),
          ],
          staffingRisk: "warning",
          requiresApprovalConfirmation: true,
        },
      },
      requests: [],
    });
  });

  it("keeps employee-only suppression visibility on GET /api/leave/me", async () => {
    const world = createWorld();

    world.leaveRequests.push({
      id: "leave_request_emp_001_2026-04-14_rejected",
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-14",
      startAt: null,
      endAt: null,
      reason:
        "Reviewed leave request that may be suppressed from the top surface.",
      requestedAt: "2026-04-13T09:15:00+09:00",
      status: "rejected",
      reviewedAt: "2026-04-13T10:00:00+09:00",
      reviewComment: "Please resubmit after adjusting the staffing plan.",
      rootRequestId: "leave_request_emp_001_2026-04-14_rejected",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    });
    setMockSeedWorldForTests(world);
    setMockLeaveSuppressionStateForTests({
      emp_001: ["leave_request_emp_001_2026-04-14_rejected"],
    });

    const response = await getLeaveMe(
      new Request("https://example.com/api/leave/me"),
    );
    const body = leaveOverviewResponseSchema.parse(await response.json());

    expect(
      body.requests.find(
        (request) => request.id === "leave_request_emp_001_2026-04-14_rejected",
      ),
    ).toMatchObject({
      isTopSurfaceSuppressed: true,
      reviewComment: "Please resubmit after adjusting the staffing plan.",
    });
  });

  it("creates a leave request and returns the full leave resource", async () => {
    const response = await createLeaveRequestRoute(
      new Request("https://example.com/api/leave/request", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          leaveType: "annual",
          date: "2026-04-14",
          reason: "Planned personal leave.",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(
      leaveRequestResponseSchema.parse(await response.json()),
    ).toMatchObject({
      requestType: "leave",
      date: "2026-04-14",
      status: "pending",
      activeStatus: "pending",
      effectiveStatus: "pending",
      nextAction: "admin_review",
    });
  });

  it("returns the documented duplicate active follow-up conflict payload for leave POST", async () => {
    const world = createWorld();

    world.leaveRequests.push({
      id: "leave_request_emp_001_2026-04-14_root",
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-14",
      startAt: null,
      endAt: null,
      reason: "Approved leave before a pending change follow-up exists.",
      requestedAt: "2026-04-13T09:10:00+09:00",
      status: "approved",
      reviewedAt: "2026-04-13T10:00:00+09:00",
      reviewComment: null,
      rootRequestId: "leave_request_emp_001_2026-04-14_root",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    });
    world.leaveRequests.push({
      id: "leave_request_emp_001_2026-04-14_change",
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "hourly",
      date: "2026-04-14",
      startAt: "2026-04-14T14:00:00+09:00",
      endAt: "2026-04-14T17:00:00+09:00",
      reason: "Pending change follow-up already exists.",
      requestedAt: "2026-04-13T11:00:00+09:00",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: "leave_request_emp_001_2026-04-14_root",
      parentRequestId: "leave_request_emp_001_2026-04-14_root",
      followUpKind: "change",
      supersededByRequestId: null,
    });
    setMockSeedWorldForTests(world);

    const response = await createLeaveRequestRoute(
      new Request("https://example.com/api/leave/request", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          leaveType: "hourly",
          date: "2026-04-14",
          startAt: "2026-04-14T15:00:00+09:00",
          endAt: "2026-04-14T18:00:00+09:00",
          reason: "A second follow-up should conflict.",
          parentRequestId: "leave_request_emp_001_2026-04-14_root",
          followUpKind: "change",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "conflict",
        message:
          'Leave request chain "leave_request_emp_001_2026-04-14_root" already has an active follow-up request',
        activeRequestId: "leave_request_emp_001_2026-04-14_change",
      },
    });
  });

  it("edits and withdraws a pending leave request, and rejects reviewed leave PATCH targets", async () => {
    const world = createWorld();

    world.leaveRequests.push({
      id: "leave_request_emp_001_2026-04-14_root",
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "hourly",
      date: "2026-04-14",
      startAt: "2026-04-14T13:00:00+09:00",
      endAt: "2026-04-14T15:00:00+09:00",
      reason: "Pending hourly leave to edit and withdraw.",
      requestedAt: "2026-04-13T09:15:00+09:00",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: "leave_request_emp_001_2026-04-14_root",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    });
    world.leaveRequests.push({
      id: "leave_request_emp_001_2026-04-15_reviewed",
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-15",
      startAt: null,
      endAt: null,
      reason: "Reviewed leave request that may not be patched anymore.",
      requestedAt: "2026-04-13T09:40:00+09:00",
      status: "rejected",
      reviewedAt: "2026-04-13T10:20:00+09:00",
      reviewComment: "Please adjust the staffing impact.",
      rootRequestId: "leave_request_emp_001_2026-04-15_reviewed",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    });
    setMockSeedWorldForTests(world);

    const editResponse = await patchLeaveRequest(
      new Request(
        "https://example.com/api/leave/request/leave_request_emp_001_2026-04-14_root",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            startAt: "2026-04-14T12:00:00+09:00",
            endAt: "2026-04-14T16:00:00+09:00",
            reason: "The appointment window expanded.",
          }),
        },
      ),
      {
        params: Promise.resolve({
          id: "leave_request_emp_001_2026-04-14_root",
        }),
      },
    );

    expect(editResponse.status).toBe(200);
    expect(
      leaveRequestResponseSchema.parse(await editResponse.json()),
    ).toMatchObject({
      startAt: "2026-04-14T12:00:00+09:00",
      endAt: "2026-04-14T16:00:00+09:00",
      reason: "The appointment window expanded.",
    });

    const withdrawResponse = await patchLeaveRequest(
      new Request(
        "https://example.com/api/leave/request/leave_request_emp_001_2026-04-14_root",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            status: "withdrawn",
          }),
        },
      ),
      {
        params: Promise.resolve({
          id: "leave_request_emp_001_2026-04-14_root",
        }),
      },
    );

    expect(withdrawResponse.status).toBe(200);
    expect(
      leaveRequestResponseSchema.parse(await withdrawResponse.json()),
    ).toMatchObject({
      status: "withdrawn",
      activeRequestId: null,
      activeStatus: null,
      effectiveStatus: "withdrawn",
    });

    const reviewedResponse = await patchLeaveRequest(
      new Request(
        "https://example.com/api/leave/request/leave_request_emp_001_2026-04-15_reviewed",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            reason: "Trying to edit a reviewed leave request.",
          }),
        },
      ),
      {
        params: Promise.resolve({
          id: "leave_request_emp_001_2026-04-15_reviewed",
        }),
      },
    );

    expect(reviewedResponse.status).toBe(409);
    await expect(reviewedResponse.json()).resolves.toEqual({
      error: {
        code: "conflict",
        message:
          'Leave request "leave_request_emp_001_2026-04-15_reviewed" is no longer pending',
      },
    });
  });

  it("returns the governing approval after withdrawing a pending leave follow-up", async () => {
    const world = createWorld();

    world.leaveRequests.push({
      id: "leave_request_emp_001_2026-04-14_root",
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-14",
      startAt: null,
      endAt: null,
      reason: "Approved leave before a pending change follow-up exists.",
      requestedAt: "2026-04-13T09:10:00+09:00",
      status: "approved",
      reviewedAt: "2026-04-13T10:00:00+09:00",
      reviewComment: null,
      rootRequestId: "leave_request_emp_001_2026-04-14_root",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    });
    world.leaveRequests.push({
      id: "leave_request_emp_001_2026-04-14_change",
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "hourly",
      date: "2026-04-14",
      startAt: "2026-04-14T14:00:00+09:00",
      endAt: "2026-04-14T17:00:00+09:00",
      reason: "Pending change follow-up that will be withdrawn.",
      requestedAt: "2026-04-13T11:00:00+09:00",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: "leave_request_emp_001_2026-04-14_root",
      parentRequestId: "leave_request_emp_001_2026-04-14_root",
      followUpKind: "change",
      supersededByRequestId: null,
    });
    setMockSeedWorldForTests(world);

    const response = await patchLeaveRequest(
      new Request(
        "https://example.com/api/leave/request/leave_request_emp_001_2026-04-14_change",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            status: "withdrawn",
          }),
        },
      ),
      {
        params: Promise.resolve({
          id: "leave_request_emp_001_2026-04-14_change",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(
      leaveRequestResponseSchema.parse(await response.json()),
    ).toMatchObject({
      id: "leave_request_emp_001_2026-04-14_change",
      status: "withdrawn",
      activeRequestId: null,
      activeStatus: null,
      effectiveRequestId: "leave_request_emp_001_2026-04-14_root",
      effectiveStatus: "approved",
      nextAction: "none",
    });
  });

  it("rejects hourly timing PATCH fields on non-hourly leave requests", async () => {
    const world = createWorld();

    addPendingAnnualLeaveRequest(world);
    setMockSeedWorldForTests(world);

    const response = await patchLeaveRequest(
      new Request(
        "https://example.com/api/leave/request/leave_request_emp_001_2026-04-14_root",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            startAt: "2026-04-14T13:00:00+09:00",
            endAt: "2026-04-14T15:00:00+09:00",
          }),
        },
      ),
      {
        params: Promise.resolve({
          id: "leave_request_emp_001_2026-04-14_root",
        }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "validation_error",
        message:
          'Leave request timing fields "startAt" and "endAt" require an hourly leave request',
      },
    });
  });
});
