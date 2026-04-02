import { describe, expect, it } from "vitest";

import { leaveOverviewResponseSchema } from "@/lib/contracts/leave";
import { adminRequestsResponseSchema } from "@/lib/contracts/requests";
import {
  buildLeaveConflictProjection,
  getEmployeeLeaveOverview,
} from "@/lib/repositories/leave";
import {
  buildRequestChainProjection,
  getAdminRequests,
} from "@/lib/repositories/requests";
import { canonicalSeedWorld } from "@/lib/seed/world";

function createSuppressionWorld() {
  const world = structuredClone(canonicalSeedWorld);

  world.leaveRequests.push({
    id: "leave_request_emp_001_2026-04-12_rejected",
    employeeId: "emp_001",
    requestType: "leave",
    leaveType: "annual",
    date: "2026-04-12",
    startAt: null,
    endAt: null,
    reason: "Reviewed leave request that can be suppressed from the top card.",
    requestedAt: "2026-04-12T08:00:00+09:00",
    status: "rejected",
    reviewedAt: "2026-04-12T10:00:00+09:00",
    reviewComment: "Please resubmit after adjusting the leave window.",
    rootRequestId: "leave_request_emp_001_2026-04-12_rejected",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
  });

  return world;
}

function createCanceledLeaveWorld() {
  const world = structuredClone(canonicalSeedWorld);

  world.leaveRequests.push(
    {
      id: "leave_request_emp_002_2026-04-14_root",
      employeeId: "emp_002",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-14",
      startAt: null,
      endAt: null,
      reason: "Original approved leave before cancellation.",
      requestedAt: "2026-04-12T09:00:00+09:00",
      status: "approved",
      reviewedAt: "2026-04-12T11:00:00+09:00",
      reviewComment: null,
      rootRequestId: "leave_request_emp_002_2026-04-14_root",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: "leave_request_emp_002_2026-04-14_cancel",
    },
    {
      id: "leave_request_emp_002_2026-04-14_cancel",
      employeeId: "emp_002",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-14",
      startAt: null,
      endAt: null,
      reason:
        "Approved cancel follow-up should clear leave balance and conflict state.",
      requestedAt: "2026-04-13T09:00:00+09:00",
      status: "approved",
      reviewedAt: "2026-04-13T10:00:00+09:00",
      reviewComment: null,
      rootRequestId: "leave_request_emp_002_2026-04-14_root",
      parentRequestId: "leave_request_emp_002_2026-04-14_root",
      followUpKind: "cancel",
      supersededByRequestId: null,
    },
  );

  return world;
}

function createReviewedHistoryWithWarningContextWorld() {
  const world = structuredClone(canonicalSeedWorld);

  world.leaveRequests.push({
    id: "leave_request_emp_001_2026-04-16_rejected",
    employeeId: "emp_001",
    requestType: "leave",
    leaveType: "annual",
    date: "2026-04-16",
    startAt: null,
    endAt: null,
    reason: "Rejected leave history on a company-event date.",
    requestedAt: "2026-04-15T09:00:00+09:00",
    status: "rejected",
    reviewedAt: "2026-04-15T11:00:00+09:00",
    reviewComment: "Please resubmit after adjusting the staffing plan.",
    rootRequestId: "leave_request_emp_001_2026-04-16_rejected",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
  });

  return world;
}

describe("request-chain and leave repository helpers", () => {
  it("projects approved leave follow-ups against the governing root approval", () => {
    const projection = buildRequestChainProjection(
      canonicalSeedWorld,
      "leave_request_emp_004_2026-04-16_change",
    );

    expect(projection).toMatchObject({
      activeRequestId: "leave_request_emp_004_2026-04-16_change",
      activeStatus: "pending",
      effectiveRequestId: "leave_request_emp_004_2026-04-16_root",
      effectiveStatus: "approved",
      governingReviewComment: null,
      hasActiveFollowUp: true,
      nextAction: "admin_review",
    });
  });

  it("projects rejected leave resubmissions as the new active and effective work", () => {
    const projection = buildRequestChainProjection(
      canonicalSeedWorld,
      "leave_request_emp_010_2026-04-20_resubmission",
    );

    expect(projection).toMatchObject({
      activeRequestId: "leave_request_emp_010_2026-04-20_resubmission",
      activeStatus: "pending",
      effectiveRequestId: "leave_request_emp_010_2026-04-20_resubmission",
      effectiveStatus: "pending",
      governingReviewComment: null,
      hasActiveFollowUp: true,
      nextAction: "admin_review",
    });
  });

  it("keeps top-surface suppression false by default and true only when overlaid", () => {
    const world = createSuppressionWorld();
    const requestId = "leave_request_emp_001_2026-04-12_rejected";

    const unsuppressed = leaveOverviewResponseSchema.parse(
      getEmployeeLeaveOverview(world, {
        employeeId: "emp_001",
      }),
    );
    const suppressed = leaveOverviewResponseSchema.parse(
      getEmployeeLeaveOverview(world, {
        employeeId: "emp_001",
        suppressionRequestIdsByEmployeeId: {
          emp_001: [requestId],
        },
      }),
    );

    expect(
      unsuppressed.requests.find((request) => request.id === requestId),
    ).toMatchObject({
      isTopSurfaceSuppressed: false,
    });
    expect(
      suppressed.requests.find((request) => request.id === requestId),
    ).toMatchObject({
      isTopSurfaceSuppressed: true,
    });
  });

  it("stops counting leave usage and effective approved context after an approved cancel follow-up", () => {
    const world = createCanceledLeaveWorld();
    const overview = leaveOverviewResponseSchema.parse(
      getEmployeeLeaveOverview(world, {
        employeeId: "emp_002",
      }),
    );
    const leaveConflict = buildLeaveConflictProjection(world, {
      employeeId: "emp_002",
      date: "2026-04-14",
    });

    expect(overview.balance).toMatchObject({
      totalDays: 15,
      usedDays: 0,
      remainingDays: 15,
    });
    expect(leaveConflict).toMatchObject({
      effectiveApprovedLeaveContext: [],
    });
  });

  it("projects leave conflict context into selected-date employee overview state", () => {
    const emp004Overview = leaveOverviewResponseSchema.parse(
      getEmployeeLeaveOverview(canonicalSeedWorld, {
        employeeId: "emp_004",
        date: "2026-04-16",
      }),
    );
    const emp006Conflict = buildLeaveConflictProjection(canonicalSeedWorld, {
      employeeId: "emp_006",
      date: "2026-04-17",
    });

    expect(
      emp004Overview.requests.find(
        (request) => request.id === "leave_request_emp_004_2026-04-16_change",
      ),
    ).toMatchObject({
      leaveConflict: expect.objectContaining({
        companyEventContext: [
          expect.objectContaining({
            id: "company_event_2026-04-16_spring-launch",
          }),
        ],
        effectiveApprovedLeaveContext: [
          expect.objectContaining({
            requestId: "leave_request_emp_004_2026-04-16_root",
          }),
        ],
        staffingRisk: "warning",
        requiresApprovalConfirmation: true,
      }),
    });
    expect(
      emp004Overview.requests.find(
        (request) => request.id === "leave_request_emp_004_2026-04-16_root",
      ),
    ).toMatchObject({
      leaveConflict: expect.objectContaining({
        companyEventContext: [
          expect.objectContaining({
            id: "company_event_2026-04-16_spring-launch",
          }),
        ],
        pendingLeaveContext: [
          expect.objectContaining({
            requestId: "leave_request_emp_004_2026-04-16_change",
          }),
        ],
      }),
    });

    expect(emp004Overview.selectedDateContext).toMatchObject({
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
    });
    expect(emp006Conflict).toMatchObject({
      staffingRisk: "warning",
      requiresApprovalConfirmation: true,
    });
  });

  it("orders admin request queues by view contract", () => {
    const needsReview = adminRequestsResponseSchema.parse(
      getAdminRequests(canonicalSeedWorld, { view: "needs_review" }),
    );
    const completed = adminRequestsResponseSchema.parse(
      getAdminRequests(canonicalSeedWorld, { view: "completed" }),
    );
    const all = adminRequestsResponseSchema.parse(
      getAdminRequests(canonicalSeedWorld, { view: "all" }),
    );
    const emp004QueueItem = needsReview.items.find(
      (item) => item.id === "leave_request_emp_004_2026-04-16_change",
    );
    const emp006QueueItem = needsReview.items.find(
      (item) => item.id === "leave_request_emp_006_2026-04-17_root",
    );

    expect(needsReview.viewFilter).toBe("needs_review");
    expect(needsReview.items.map((item) => item.id)).toEqual([
      "leave_request_emp_010_2026-04-20_resubmission",
      "leave_request_emp_004_2026-04-16_change",
      "manual_request_emp_011_2026-04-20_root",
      "manual_request_emp_010_2026-04-17_root",
      "leave_request_emp_006_2026-04-17_root",
      "manual_request_emp_010_2026-04-13_resubmission",
    ]);

    expect(completed.viewFilter).toBe("completed");
    expect(completed.items.map((item) => item.id)).toEqual([
      "leave_request_emp_005_2026-04-18_root",
      "leave_request_emp_005_2026-04-13_root",
      "manual_request_emp_007_2026-04-03_root",
    ]);

    expect(all.viewFilter).toBe("all");
    expect(all.items.map((item) => item.id)).toEqual([
      "leave_request_emp_010_2026-04-20_resubmission",
      "leave_request_emp_004_2026-04-16_change",
      "manual_request_emp_011_2026-04-20_root",
      "manual_request_emp_010_2026-04-17_root",
      "leave_request_emp_006_2026-04-17_root",
      "manual_request_emp_010_2026-04-13_resubmission",
      "leave_request_emp_005_2026-04-18_root",
      "leave_request_emp_005_2026-04-13_root",
      "manual_request_emp_007_2026-04-03_root",
    ]);
    expect(emp004QueueItem).toMatchObject({
      requestType: "leave",
      leaveConflict: expect.objectContaining({
        companyEventContext: [
          expect.objectContaining({
            id: "company_event_2026-04-16_spring-launch",
          }),
        ],
        effectiveApprovedLeaveContext: [
          expect.objectContaining({
            requestId: "leave_request_emp_004_2026-04-16_root",
          }),
        ],
      }),
    });
    expect(emp006QueueItem).toMatchObject({
      requestType: "leave",
      leaveConflict: expect.objectContaining({
        companyEventContext: [
          expect.objectContaining({
            id: "company_event_2026-04-17_inventory-audit",
          }),
        ],
        staffingRisk: "warning",
        requiresApprovalConfirmation: true,
      }),
    });
  });

  it("keeps reviewed non-approved leave history free of leave conflict projection in admin completed views", () => {
    const world = createReviewedHistoryWithWarningContextWorld();
    const completed = adminRequestsResponseSchema.parse(
      getAdminRequests(world, { view: "completed" }),
    );
    const item = completed.items.find(
      (candidate) =>
        candidate.id === "leave_request_emp_001_2026-04-16_rejected",
    );

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
  });
});
