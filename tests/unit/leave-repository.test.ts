import { describe, expect, it } from "vitest";

import { leaveRequestResponseSchema } from "@/lib/contracts/leave";
import { errorResponseSchema } from "@/lib/contracts/shared";
import {
  buildLeaveRequestResource,
  createLeaveRequest,
  getEmployeeLeaveOverview,
  LeaveRequestConflictError,
  LeaveRequestValidationError,
  updateLeaveRequest,
} from "@/lib/repositories/leave";
import { leaveRequestEntitySchema } from "@/lib/seed/entities";
import {
  buildFixedSeoulDateTime,
  fixedSeoulBaselineDate,
} from "@/lib/seed/seoul-clock";
import { type CanonicalSeedWorld, canonicalSeedWorld } from "@/lib/seed/world";

function createWorld() {
  return structuredClone(canonicalSeedWorld) as CanonicalSeedWorld;
}

function createRejectedLeaveWorldWithoutActiveFollowUp() {
  const world = createWorld();

  world.leaveRequests = world.leaveRequests.filter(
    (request) => request.id !== "leave_request_emp_010_2026-04-20_resubmission",
  );

  return world;
}

function createApprovedLeaveWorldWithoutActiveFollowUp() {
  const world = createWorld();

  world.leaveRequests = world.leaveRequests.filter(
    (request) => request.id !== "leave_request_emp_004_2026-04-16_change",
  );

  return world;
}

function createApprovedLeaveWorldForCancel() {
  const world = createWorld();

  world.leaveRequests.push({
    id: "leave_request_emp_001_2026-04-14_root",
    employeeId: "emp_001",
    requestType: "leave",
    leaveType: "annual",
    date: "2026-04-14",
    startAt: null,
    endAt: null,
    reason: "Approved leave that may later be canceled.",
    requestedAt: "2026-04-13T09:10:00+09:00",
    status: "approved",
    reviewedAt: "2026-04-13T11:00:00+09:00",
    reviewComment: null,
    rootRequestId: "leave_request_emp_001_2026-04-14_root",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
  });

  return world;
}

function createPatchOverlapWorld() {
  const world = createWorld();

  world.leaveRequests.push(
    {
      id: "leave_request_emp_001_2026-04-14_root",
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "hourly",
      date: "2026-04-14",
      startAt: "2026-04-14T13:00:00+09:00",
      endAt: "2026-04-14T15:00:00+09:00",
      reason: "Pending hourly leave that will be edited.",
      requestedAt: "2026-04-13T09:15:00+09:00",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: "leave_request_emp_001_2026-04-14_root",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: "leave_request_emp_001_2026-04-15_root",
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-15",
      startAt: null,
      endAt: null,
      reason: "Another chain already governs the later date.",
      requestedAt: "2026-04-13T09:30:00+09:00",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: "leave_request_emp_001_2026-04-15_root",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
  );

  return world;
}

function createPendingAnnualPatchWorld() {
  const world = createWorld();

  world.leaveRequests.push({
    id: "leave_request_emp_001_2026-04-14_root",
    employeeId: "emp_001",
    requestType: "leave",
    leaveType: "annual",
    date: "2026-04-14",
    startAt: null,
    endAt: null,
    reason: "Pending annual leave that should reject stray hourly fields.",
    requestedAt: "2026-04-13T09:15:00+09:00",
    status: "pending",
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: "leave_request_emp_001_2026-04-14_root",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
  });

  return world;
}

describe("leave repository helpers", () => {
  it("creates a root leave request and rejects overlapping root chains regardless of leave type", () => {
    const world = createWorld();
    const created = createLeaveRequest(
      world,
      "emp_001",
      {
        leaveType: "annual",
        date: "2026-04-14",
        reason: "Planned personal leave.",
      },
      buildFixedSeoulDateTime("2026-04-13", "12:00:00"),
    );

    expect(leaveRequestEntitySchema.parse(created)).toMatchObject({
      id: "leave_request_emp_001_2026-04-14_root",
      rootRequestId: "leave_request_emp_001_2026-04-14_root",
      parentRequestId: null,
      followUpKind: null,
      status: "pending",
      requestedAt: "2026-04-13T12:00:00+09:00",
    });

    expect(() =>
      createLeaveRequest(
        world,
        "emp_001",
        {
          leaveType: "hourly",
          date: "2026-04-14",
          startAt: "2026-04-14T14:00:00+09:00",
          endAt: "2026-04-14T16:00:00+09:00",
          reason:
            "A second root chain must still conflict by interval overlap.",
        },
        buildFixedSeoulDateTime("2026-04-13", "12:05:00"),
      ),
    ).toThrowError(LeaveRequestConflictError);
  });

  it("creates a resubmission from a rejected parent and rejects a second active follow-up with its id", () => {
    const resubmissionWorld = createRejectedLeaveWorldWithoutActiveFollowUp();
    const resubmission = createLeaveRequest(
      resubmissionWorld,
      "emp_010",
      {
        leaveType: "annual",
        date: "2026-04-20",
        reason: "Resubmitting the leave request with a clarified note.",
        parentRequestId: "leave_request_emp_010_2026-04-20_root",
        followUpKind: "resubmission",
      },
      buildFixedSeoulDateTime("2026-04-13", "12:00:00"),
    );

    expect(leaveRequestEntitySchema.parse(resubmission)).toMatchObject({
      id: "leave_request_emp_010_2026-04-20_resubmission",
      rootRequestId: "leave_request_emp_010_2026-04-20_root",
      parentRequestId: "leave_request_emp_010_2026-04-20_root",
      followUpKind: "resubmission",
      status: "pending",
    });

    expect(() =>
      createLeaveRequest(
        createWorld(),
        "emp_004",
        {
          leaveType: "hourly",
          date: "2026-04-16",
          startAt: "2026-04-16T14:00:00+09:00",
          endAt: "2026-04-16T17:00:00+09:00",
          reason:
            "A second change follow-up must point at the existing active one.",
          parentRequestId: "leave_request_emp_004_2026-04-16_root",
          followUpKind: "change",
        },
        buildFixedSeoulDateTime("2026-04-13", "12:00:00"),
      ),
    ).toThrowError(
      expect.objectContaining({
        activeRequestId: "leave_request_emp_004_2026-04-16_change",
      }),
    );
  });

  it("creates approved-state change and cancel follow-ups only from approved unsuperseded parents", () => {
    const changeWorld = createApprovedLeaveWorldWithoutActiveFollowUp();
    const change = createLeaveRequest(
      changeWorld,
      "emp_004",
      {
        leaveType: "hourly",
        date: "2026-04-16",
        startAt: "2026-04-16T14:00:00+09:00",
        endAt: "2026-04-16T17:00:00+09:00",
        reason: "Adjusting the approved leave window.",
        parentRequestId: "leave_request_emp_004_2026-04-16_root",
        followUpKind: "change",
      },
      buildFixedSeoulDateTime("2026-04-13", "12:00:00"),
    );
    const cancel = createLeaveRequest(
      createApprovedLeaveWorldForCancel(),
      "emp_001",
      {
        leaveType: "annual",
        date: "2026-04-14",
        reason: "Canceling the approved leave after plans changed.",
        parentRequestId: "leave_request_emp_001_2026-04-14_root",
        followUpKind: "cancel",
      },
      buildFixedSeoulDateTime("2026-04-13", "12:00:00"),
    );

    expect(leaveRequestEntitySchema.parse(change)).toMatchObject({
      id: "leave_request_emp_004_2026-04-16_change",
      followUpKind: "change",
      status: "pending",
    });
    expect(leaveRequestEntitySchema.parse(cancel)).toMatchObject({
      id: "leave_request_emp_001_2026-04-14_cancel",
      followUpKind: "cancel",
      status: "pending",
    });

    expect(() =>
      createLeaveRequest(
        createWorld(),
        "emp_010",
        {
          leaveType: "annual",
          date: "2026-04-20",
          reason: "Rejected requests cannot accept a change follow-up.",
          parentRequestId: "leave_request_emp_010_2026-04-20_root",
          followUpKind: "change",
        },
        buildFixedSeoulDateTime("2026-04-13", "12:00:00"),
      ),
    ).toThrowError(LeaveRequestConflictError);
  });

  it("rejects pending parents as lifecycle conflicts instead of duplicate active follow-up conflicts", () => {
    try {
      createLeaveRequest(
        createWorld(),
        "emp_006",
        {
          leaveType: "annual",
          date: "2026-04-17",
          reason: "A pending root request cannot accept a follow-up yet.",
          parentRequestId: "leave_request_emp_006_2026-04-17_root",
          followUpKind: "change",
        },
        buildFixedSeoulDateTime("2026-04-13", "12:00:00"),
      );
      throw new Error("Expected pending-parent follow-up to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(LeaveRequestConflictError);
      expect(error).toMatchObject({
        activeRequestId: undefined,
      });
      expect((error as Error).message).toContain(
        'cannot accept a "change" follow-up',
      );
    }
  });

  it("rejects past dates and non-workdays for leave writes", () => {
    expect(() =>
      createLeaveRequest(
        createWorld(),
        "emp_001",
        {
          leaveType: "annual",
          date: "2026-04-12",
          reason: "Past dates must be rejected.",
        },
        buildFixedSeoulDateTime("2026-04-13", "12:00:00"),
      ),
    ).toThrowError(LeaveRequestValidationError);

    expect(() =>
      createLeaveRequest(
        createWorld(),
        "emp_001",
        {
          leaveType: "annual",
          date: "2026-04-19",
          reason: "Future non-workdays must still be rejected.",
        },
        buildFixedSeoulDateTime("2026-04-13", "12:00:00"),
      ),
    ).toThrowError(LeaveRequestValidationError);
  });

  it("patches a pending leave request in place, preserves requestedAt, and withdraws without reopening it", () => {
    const editWorld = createPatchOverlapWorld();
    const edited = updateLeaveRequest(
      editWorld,
      "emp_001",
      "leave_request_emp_001_2026-04-14_root",
      {
        startAt: "2026-04-14T12:00:00+09:00",
        endAt: "2026-04-14T16:00:00+09:00",
        reason: "The appointment window expanded.",
      },
    );
    const withdrawWorld = createPatchOverlapWorld();
    const withdrawn = updateLeaveRequest(
      withdrawWorld,
      "emp_001",
      "leave_request_emp_001_2026-04-14_root",
      {
        status: "withdrawn",
      },
    );

    expect(leaveRequestEntitySchema.parse(edited)).toMatchObject({
      id: "leave_request_emp_001_2026-04-14_root",
      startAt: "2026-04-14T12:00:00+09:00",
      endAt: "2026-04-14T16:00:00+09:00",
      reason: "The appointment window expanded.",
      requestedAt: "2026-04-13T09:15:00+09:00",
      status: "pending",
    });
    expect(leaveRequestEntitySchema.parse(withdrawn)).toMatchObject({
      id: "leave_request_emp_001_2026-04-14_root",
      status: "withdrawn",
      requestedAt: "2026-04-13T09:15:00+09:00",
      reviewedAt: null,
      reviewComment: null,
    });

    const withdrawnResource = buildLeaveRequestResource(
      withdrawWorld,
      "emp_001",
      "leave_request_emp_001_2026-04-14_root",
    );

    expect(leaveRequestResponseSchema.parse(withdrawnResource)).toMatchObject({
      id: "leave_request_emp_001_2026-04-14_root",
      status: "withdrawn",
      activeRequestId: null,
      activeStatus: null,
      effectiveRequestId: "leave_request_emp_001_2026-04-14_root",
      effectiveStatus: "withdrawn",
      nextAction: "none",
    });
  });

  it("falls back to the governing reviewed or approved request when a pending follow-up is withdrawn", () => {
    const resubmissionWorld = createWorld();
    const withdrawnResubmission = updateLeaveRequest(
      resubmissionWorld,
      "emp_010",
      "leave_request_emp_010_2026-04-20_resubmission",
      {
        status: "withdrawn",
      },
    );
    const withdrawnResubmissionResource = buildLeaveRequestResource(
      resubmissionWorld,
      "emp_010",
      "leave_request_emp_010_2026-04-20_resubmission",
    );

    expect(leaveRequestEntitySchema.parse(withdrawnResubmission)).toMatchObject(
      {
        id: "leave_request_emp_010_2026-04-20_resubmission",
        status: "withdrawn",
      },
    );
    expect(
      leaveRequestResponseSchema.parse(withdrawnResubmissionResource),
    ).toMatchObject({
      id: "leave_request_emp_010_2026-04-20_resubmission",
      status: "withdrawn",
      activeRequestId: null,
      activeStatus: null,
      effectiveRequestId: "leave_request_emp_010_2026-04-20_root",
      effectiveStatus: "rejected",
      governingReviewComment: "운영 인력 계획을 조정한 뒤 다시 제출해 주세요.",
      nextAction: "none",
    });

    const changeWorld = createWorld();
    const withdrawnChange = updateLeaveRequest(
      changeWorld,
      "emp_004",
      "leave_request_emp_004_2026-04-16_change",
      {
        status: "withdrawn",
      },
    );
    const withdrawnChangeResource = buildLeaveRequestResource(
      changeWorld,
      "emp_004",
      "leave_request_emp_004_2026-04-16_change",
    );
    const overview = getEmployeeLeaveOverview(changeWorld, {
      employeeId: "emp_004",
      date: "2026-04-16",
    });

    expect(leaveRequestEntitySchema.parse(withdrawnChange)).toMatchObject({
      id: "leave_request_emp_004_2026-04-16_change",
      status: "withdrawn",
    });
    expect(
      leaveRequestResponseSchema.parse(withdrawnChangeResource),
    ).toMatchObject({
      id: "leave_request_emp_004_2026-04-16_change",
      status: "withdrawn",
      activeRequestId: null,
      activeStatus: null,
      effectiveRequestId: "leave_request_emp_004_2026-04-16_root",
      effectiveStatus: "approved",
      governingReviewComment: null,
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
  });

  it("rejects invalid hourly intervals, cross-date hourly timestamps, reviewed-request patches, stray hourly fields, and overlap-causing edits", () => {
    expect(() =>
      createLeaveRequest(
        createWorld(),
        "emp_001",
        {
          leaveType: "hourly",
          date: fixedSeoulBaselineDate,
          startAt: "2026-04-13T15:00:00+09:00",
          endAt: "2026-04-13T13:00:00+09:00",
          reason: "Inverted hourly intervals must fail.",
        },
        buildFixedSeoulDateTime("2026-04-13", "12:00:00"),
      ),
    ).toThrowError(LeaveRequestValidationError);

    expect(() =>
      createLeaveRequest(
        createWorld(),
        "emp_001",
        {
          leaveType: "hourly",
          date: fixedSeoulBaselineDate,
          startAt: "2026-04-14T09:00:00+09:00",
          endAt: "2026-04-14T11:00:00+09:00",
          reason: "Hourly leave timestamps must stay on the target date.",
        },
        buildFixedSeoulDateTime("2026-04-13", "12:00:00"),
      ),
    ).toThrowError(LeaveRequestValidationError);

    expect(() =>
      updateLeaveRequest(
        createWorld(),
        "emp_005",
        "leave_request_emp_005_2026-04-18_root",
        {
          reason: "Approved leave is immutable through PATCH.",
        },
      ),
    ).toThrowError(LeaveRequestConflictError);

    expect(() =>
      updateLeaveRequest(
        createPendingAnnualPatchWorld(),
        "emp_001",
        "leave_request_emp_001_2026-04-14_root",
        {
          startAt: "2026-04-14T13:00:00+09:00",
          endAt: "2026-04-14T15:00:00+09:00",
        },
      ),
    ).toThrowError(LeaveRequestValidationError);

    expect(() =>
      updateLeaveRequest(
        createPatchOverlapWorld(),
        "emp_001",
        "leave_request_emp_001_2026-04-14_root",
        {
          startAt: "2026-04-15T13:00:00+09:00",
          endAt: "2026-04-15T15:00:00+09:00",
        },
      ),
    ).toThrowError(LeaveRequestValidationError);

    expect(() =>
      updateLeaveRequest(
        createPatchOverlapWorld(),
        "emp_001",
        "leave_request_emp_001_2026-04-14_root",
        {
          date: "2026-04-15",
          leaveType: "annual",
          reason: "Moving onto another governed interval must conflict.",
        },
      ),
    ).toThrowError(LeaveRequestConflictError);
  });

  it("exposes the duplicate active follow-up id in the documented conflict envelope shape", () => {
    try {
      createLeaveRequest(
        createWorld(),
        "emp_004",
        {
          leaveType: "hourly",
          date: "2026-04-16",
          startAt: "2026-04-16T14:00:00+09:00",
          endAt: "2026-04-16T17:00:00+09:00",
          reason: "Second follow-up should expose the active request id.",
          parentRequestId: "leave_request_emp_004_2026-04-16_root",
          followUpKind: "change",
        },
        buildFixedSeoulDateTime("2026-04-13", "12:00:00"),
      );
      throw new Error("Expected duplicate active follow-up to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(LeaveRequestConflictError);
      expect(
        errorResponseSchema.parse({
          error: {
            code: "conflict",
            message: (error as Error).message,
            activeRequestId: (error as LeaveRequestConflictError)
              .activeRequestId,
          },
        }),
      ).toEqual({
        error: {
          code: "conflict",
          message:
            'Leave request chain "leave_request_emp_004_2026-04-16_root" already has an active follow-up request',
          activeRequestId: "leave_request_emp_004_2026-04-16_change",
        },
      });
    }
  });
});
