import type { LeaveConflict } from "@/lib/contracts/shared";
import type { CanonicalSeedWorld } from "@/lib/seed/world";

type SeedLeaveRequest = CanonicalSeedWorld["leaveRequests"][number];

export type BuildLeaveConflictProjectionInput = Readonly<{
  employeeId: string;
  date: string;
  excludePendingRequestId?: string;
}>;

function toLeaveConflictContextItem(request: SeedLeaveRequest) {
  return {
    requestId: request.id,
    date: request.date,
    status: request.status,
    leaveType: request.leaveType,
    startAt: request.startAt,
    endAt: request.endAt,
  };
}

function getRequestTimestamp(request: SeedLeaveRequest) {
  return new Date(request.requestedAt).getTime();
}

export function resolveEffectiveApprovedLeaveRequests(
  requests: SeedLeaveRequest[],
) {
  const requestsByRoot = new Map<string, SeedLeaveRequest[]>();

  for (const request of requests) {
    const group = requestsByRoot.get(request.rootRequestId) ?? [];
    group.push(request);
    requestsByRoot.set(request.rootRequestId, group);
  }

  const effectiveApprovedRequests: SeedLeaveRequest[] = [];

  for (const chainRequests of requestsByRoot.values()) {
    const sortedRequests = chainRequests
      .slice()
      .sort(
        (left, right) => getRequestTimestamp(left) - getRequestTimestamp(right),
      );
    const activeRequest =
      sortedRequests.filter((request) => request.status === "pending").at(-1) ??
      null;

    if (activeRequest !== null && activeRequest.parentRequestId !== null) {
      const parentRequest =
        sortedRequests.find(
          (request) => request.id === activeRequest.parentRequestId,
        ) ?? null;

      if (
        parentRequest?.status === "approved" &&
        parentRequest.followUpKind !== "cancel"
      ) {
        effectiveApprovedRequests.push(parentRequest);
        continue;
      }
    }

    const latestRequest = sortedRequests.at(-1) ?? null;

    if (
      latestRequest?.status === "withdrawn" &&
      latestRequest.parentRequestId !== null
    ) {
      const parentRequest =
        sortedRequests.find(
          (request) => request.id === latestRequest.parentRequestId,
        ) ?? null;

      if (
        parentRequest?.status === "approved" &&
        parentRequest.followUpKind !== "cancel"
      ) {
        effectiveApprovedRequests.push(parentRequest);
        continue;
      }
    }

    if (
      latestRequest !== null &&
      latestRequest.parentRequestId !== null &&
      (latestRequest.status === "rejected" ||
        latestRequest.status === "revision_requested") &&
      (latestRequest.followUpKind === "change" ||
        latestRequest.followUpKind === "cancel")
    ) {
      const parentRequest =
        sortedRequests.find(
          (request) => request.id === latestRequest.parentRequestId,
        ) ?? null;

      if (
        parentRequest?.status === "approved" &&
        parentRequest.followUpKind !== "cancel"
      ) {
        effectiveApprovedRequests.push(parentRequest);
        continue;
      }
    }

    if (
      latestRequest?.status === "approved" &&
      latestRequest.followUpKind !== "cancel"
    ) {
      effectiveApprovedRequests.push(latestRequest);
    }
  }

  return effectiveApprovedRequests;
}

export function buildLeaveConflictProjection(
  world: CanonicalSeedWorld,
  input: BuildLeaveConflictProjectionInput,
): LeaveConflict {
  const companyEventContext = world.companyEvents.filter(
    (companyEvent) => companyEvent.date === input.date,
  );
  const sameEmployeeRequests = world.leaveRequests.filter(
    (request) =>
      request.employeeId === input.employeeId && request.date === input.date,
  );

  const effectiveApprovedLeaveContext = resolveEffectiveApprovedLeaveRequests(
    sameEmployeeRequests,
  ).map(toLeaveConflictContextItem);
  const pendingLeaveContext = sameEmployeeRequests
    .filter(
      (request) =>
        request.status === "pending" &&
        request.id !== input.excludePendingRequestId,
    )
    .map(toLeaveConflictContextItem);

  const staffingRisk =
    companyEventContext.length > 0 ||
    effectiveApprovedLeaveContext.length > 0 ||
    pendingLeaveContext.length > 0
      ? "warning"
      : "none";

  return {
    companyEventContext,
    effectiveApprovedLeaveContext,
    pendingLeaveContext,
    staffingRisk,
    requiresApprovalConfirmation: staffingRisk === "warning",
  };
}

export function shouldIncludeLeaveConflict(leaveConflict: LeaveConflict) {
  return (
    leaveConflict.companyEventContext.length > 0 ||
    leaveConflict.effectiveApprovedLeaveContext.length > 0 ||
    leaveConflict.pendingLeaveContext.length > 0 ||
    leaveConflict.requiresApprovalConfirmation
  );
}
