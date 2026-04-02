import type { LeaveOverviewResponse } from "@/lib/contracts/leave";
import {
  buildLeaveConflictProjection,
  resolveEffectiveApprovedLeaveRequests,
  shouldIncludeLeaveConflict,
} from "@/lib/repositories/leave-conflicts";
import { buildRequestChainProjection } from "@/lib/repositories/requests";
import type { CanonicalSeedWorld } from "@/lib/seed/world";

type SeedLeaveRequest = CanonicalSeedWorld["leaveRequests"][number];

export type GetEmployeeLeaveOverviewInput = Readonly<{
  employeeId: string;
  date?: string;
  annualLeaveAllowanceDays?: number;
  suppressionRequestIdsByEmployeeId?: Readonly<
    Record<string, readonly string[]>
  >;
}>;

function getLeaveRequestsForEmployee(
  world: CanonicalSeedWorld,
  employeeId: string,
) {
  return world.leaveRequests.filter(
    (request) => request.employeeId === employeeId,
  );
}

function getLeaveRequestTimestamp(request: SeedLeaveRequest) {
  return new Date(request.requestedAt).getTime();
}

function getLeaveRequestDurationHours(request: SeedLeaveRequest) {
  if (
    request.leaveType !== "hourly" ||
    request.startAt === null ||
    request.endAt === null
  ) {
    return null;
  }

  return (
    Math.round(
      ((new Date(request.endAt).getTime() -
        new Date(request.startAt).getTime()) /
        3_600_000) *
        100,
    ) / 100
  );
}

function getSuppressedRequestIds(
  suppressionRequestIdsByEmployeeId:
    | Readonly<Record<string, readonly string[]>>
    | undefined,
  employeeId: string,
) {
  return new Set(suppressionRequestIdsByEmployeeId?.[employeeId] ?? []);
}

function getApprovedUsageDays(requests: SeedLeaveRequest[]) {
  let usedDays = 0;

  for (const approvedRequest of resolveEffectiveApprovedLeaveRequests(
    requests,
  )) {
    if (approvedRequest.leaveType === "hourly") {
      usedDays +=
        (approvedRequest.endAt !== null && approvedRequest.startAt !== null
          ? Math.round(
              ((new Date(approvedRequest.endAt).getTime() -
                new Date(approvedRequest.startAt).getTime()) /
                3_600_000) *
                100,
            ) / 100
          : 0) / 8;
      continue;
    }

    if (
      approvedRequest.leaveType === "half_am" ||
      approvedRequest.leaveType === "half_pm"
    ) {
      usedDays += 0.5;
      continue;
    }

    usedDays += 1;
  }

  return Math.round(usedDays * 100) / 100;
}

function toLeaveOverviewRequestItem(
  world: CanonicalSeedWorld,
  request: SeedLeaveRequest,
  suppressionRequestIds: Set<string>,
) {
  const projection = buildRequestChainProjection(world, request.id);

  if (projection === null) {
    throw new Error(`Unable to project request chain for ${request.id}`);
  }

  const shouldProjectLeaveConflict =
    request.status === "pending" ||
    (projection.activeRequestId !== null &&
      projection.effectiveStatus === "approved" &&
      projection.effectiveRequestId === request.id);
  const leaveConflict = !shouldProjectLeaveConflict
    ? null
    : buildLeaveConflictProjection(world, {
        employeeId: request.employeeId,
        date: request.date,
        excludePendingRequestId:
          request.status === "pending" ? request.id : undefined,
      });

  const item = {
    id: request.id,
    requestType: request.requestType,
    leaveType: request.leaveType,
    date: request.date,
    startAt: request.startAt,
    endAt: request.endAt,
    hours: getLeaveRequestDurationHours(request),
    reason: request.reason,
    status: request.status,
    requestedAt: request.requestedAt,
    reviewedAt: request.reviewedAt,
    reviewComment: request.reviewComment,
    governingReviewComment: projection.governingReviewComment,
    rootRequestId: request.rootRequestId,
    parentRequestId: request.parentRequestId,
    followUpKind: request.followUpKind,
    supersededByRequestId: request.supersededByRequestId,
    activeRequestId: projection.activeRequestId,
    activeStatus: projection.activeStatus,
    effectiveRequestId: projection.effectiveRequestId,
    effectiveStatus: projection.effectiveStatus,
    hasActiveFollowUp: projection.hasActiveFollowUp,
    nextAction: projection.nextAction,
    isTopSurfaceSuppressed:
      projection.activeRequestId === null &&
      (request.status === "rejected" ||
        request.status === "revision_requested") &&
      suppressionRequestIds.has(request.id),
  };

  if (leaveConflict !== null && shouldIncludeLeaveConflict(leaveConflict)) {
    return {
      ...item,
      leaveConflict,
    };
  }

  return item;
}

export function getEmployeeLeaveOverview(
  world: CanonicalSeedWorld,
  input: GetEmployeeLeaveOverviewInput,
): LeaveOverviewResponse {
  const employeeRequests = getLeaveRequestsForEmployee(world, input.employeeId)
    .slice()
    .sort(
      (left, right) =>
        getLeaveRequestTimestamp(right) - getLeaveRequestTimestamp(left),
    );
  const suppressionRequestIds = getSuppressedRequestIds(
    input.suppressionRequestIdsByEmployeeId,
    input.employeeId,
  );
  const annualLeaveAllowanceDays = input.annualLeaveAllowanceDays ?? 15;
  const usedDays = getApprovedUsageDays(employeeRequests);
  const balance = {
    totalDays: annualLeaveAllowanceDays,
    usedDays,
    remainingDays:
      Math.round((annualLeaveAllowanceDays - usedDays) * 100) / 100,
  };

  const requests = employeeRequests.map((request) =>
    toLeaveOverviewRequestItem(world, request, suppressionRequestIds),
  );

  const selectedDateContext =
    input.date === undefined
      ? undefined
      : {
          date: input.date,
          leaveConflict: buildLeaveConflictProjection(world, {
            employeeId: input.employeeId,
            date: input.date,
          }),
        };

  return {
    balance,
    ...(selectedDateContext === undefined ? {} : { selectedDateContext }),
    requests,
  };
}

export { buildLeaveConflictProjection } from "@/lib/repositories/leave-conflicts";
