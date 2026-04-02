import type { LeaveOverviewResponse } from "@/lib/contracts/leave";
import type { ExpectedWorkday } from "@/lib/contracts/shared";
import {
  buildLeaveConflictProjection,
  resolveEffectiveApprovedLeaveRequests,
  shouldIncludeLeaveConflict,
} from "@/lib/repositories/leave-conflicts";
import {
  buildLeaveInterval,
  getLeaveDurationHours,
  leaveIntervalsOverlap,
} from "@/lib/repositories/leave-intervals";
import { buildRequestChainProjection } from "@/lib/repositories/requests";
import { buildFixedSeoulDateTime } from "@/lib/seed/seoul-clock";
import type { CanonicalSeedWorld } from "@/lib/seed/world";

type SeedLeaveRequest = CanonicalSeedWorld["leaveRequests"][number];
type LeaveRequestBody = import("@/lib/contracts/leave").LeaveRequestBody;
type LeaveRequestPatchBody =
  import("@/lib/contracts/leave").LeaveRequestPatchBody;

export type GetEmployeeLeaveOverviewInput = Readonly<{
  employeeId: string;
  date?: string;
  annualLeaveAllowanceDays?: number;
  suppressionRequestIdsByEmployeeId?: Readonly<
    Record<string, readonly string[]>
  >;
}>;

export class LeaveRequestConflictError extends Error {
  constructor(
    message: string,
    readonly activeRequestId?: string,
  ) {
    super(message);
  }
}

export class LeaveRequestNotFoundError extends Error {}
export class LeaveRequestValidationError extends Error {}

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

function getLeaveRequestById(
  world: CanonicalSeedWorld,
  employeeId: string,
  requestId: string,
) {
  return world.leaveRequests.find(
    (request) => request.employeeId === employeeId && request.id === requestId,
  );
}

function getChainRequests(world: CanonicalSeedWorld, rootRequestId: string) {
  return world.leaveRequests
    .filter((request) => request.rootRequestId === rootRequestId)
    .sort(
      (left, right) =>
        getLeaveRequestTimestamp(left) - getLeaveRequestTimestamp(right),
    );
}

function isWeekend(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();

  return day === 0 || day === 6;
}

function buildFallbackExpectedWorkday(date: string): ExpectedWorkday {
  const isWorkday = !isWeekend(date);

  return {
    isWorkday,
    expectedClockInAt: isWorkday
      ? buildFixedSeoulDateTime(date, "09:00:00")
      : null,
    expectedClockOutAt: isWorkday
      ? buildFixedSeoulDateTime(date, "18:00:00")
      : null,
    adjustedClockInAt: isWorkday
      ? buildFixedSeoulDateTime(date, "09:00:00")
      : null,
    adjustedClockOutAt: isWorkday
      ? buildFixedSeoulDateTime(date, "18:00:00")
      : null,
    countsTowardAdminSummary: isWorkday,
    leaveCoverage: null,
  };
}

function resolveExpectedWorkday(
  world: CanonicalSeedWorld,
  employeeId: string,
  date: string,
) {
  return (
    world.expectedWorkdays.find(
      (workday) => workday.employeeId === employeeId && workday.date === date,
    ) ?? buildFallbackExpectedWorkday(date)
  );
}

function validateRequestableDate(
  world: CanonicalSeedWorld,
  employeeId: string,
  date: string,
) {
  if (date < world.baselineDate) {
    throw new LeaveRequestValidationError(
      `Leave requests must target today or a future workday on or after "${world.baselineDate}"`,
    );
  }

  if (!resolveExpectedWorkday(world, employeeId, date).isWorkday) {
    throw new LeaveRequestValidationError(
      `Leave requests must target a workday on date "${date}"`,
    );
  }
}

function validateLeaveTiming(
  date: string,
  leaveType: SeedLeaveRequest["leaveType"],
  startAt: string | null,
  endAt: string | null,
) {
  if (leaveType !== "hourly") {
    return;
  }

  if (startAt === null || endAt === null) {
    throw new LeaveRequestValidationError(
      'Hourly leave requests require both "startAt" and "endAt"',
    );
  }

  if (Date.parse(endAt) <= Date.parse(startAt)) {
    throw new LeaveRequestValidationError(
      'Hourly leave requests require "endAt" to be later than "startAt"',
    );
  }

  if (startAt.slice(0, 10) !== date || endAt.slice(0, 10) !== date) {
    throw new LeaveRequestValidationError(
      `Hourly leave request timestamps must fall on target date "${date}"`,
    );
  }
}

function resolvePatchedLeaveTiming(
  request: SeedLeaveRequest,
  input: LeaveRequestPatchBody,
) {
  const leaveType = input.leaveType ?? request.leaveType;

  return {
    leaveType,
    startAt: leaveType === "hourly" ? (input.startAt ?? request.startAt) : null,
    endAt: leaveType === "hourly" ? (input.endAt ?? request.endAt) : null,
  };
}

function validatePatchedTimingFields(
  request: SeedLeaveRequest,
  input: LeaveRequestPatchBody,
) {
  const nextLeaveType = input.leaveType ?? request.leaveType;

  if (nextLeaveType === "hourly") {
    return;
  }

  const providedTimingFields = [
    input.startAt !== undefined ? "startAt" : null,
    input.endAt !== undefined ? "endAt" : null,
  ].filter((fieldName): fieldName is "startAt" | "endAt" => fieldName !== null);

  if (providedTimingFields.length === 0) {
    return;
  }

  if (providedTimingFields.length === 2) {
    throw new LeaveRequestValidationError(
      'Leave request timing fields "startAt" and "endAt" require an hourly leave request',
    );
  }

  throw new LeaveRequestValidationError(
    `Leave request timing field "${providedTimingFields[0]}" requires an hourly leave request`,
  );
}

function getBlockingRequestForRootChain(
  world: CanonicalSeedWorld,
  rootRequestId: string,
) {
  const chainRequests = getChainRequests(world, rootRequestId);
  const chainRoot = chainRequests[0];

  if (chainRoot === undefined) {
    return null;
  }

  const projection = buildRequestChainProjection(world, chainRoot.id);

  if (projection === null) {
    return null;
  }

  const effectiveRequest =
    chainRequests.find(
      (request) => request.id === projection.effectiveRequestId,
    ) ?? null;

  if (effectiveRequest === null) {
    return null;
  }

  if (effectiveRequest.status === "withdrawn") {
    return null;
  }

  if (
    effectiveRequest.status === "approved" &&
    effectiveRequest.followUpKind === "cancel"
  ) {
    return null;
  }

  return effectiveRequest;
}

function ensureNoOverlappingRootChain(
  world: CanonicalSeedWorld,
  employeeId: string,
  candidateRequest: Pick<
    SeedLeaveRequest,
    "date" | "leaveType" | "startAt" | "endAt"
  >,
  ignoredRootRequestId?: string,
) {
  const candidateWorkday = resolveExpectedWorkday(
    world,
    employeeId,
    candidateRequest.date,
  );
  const candidateInterval = buildLeaveInterval(
    candidateRequest,
    candidateWorkday,
  );

  const conflictingRequest = world.leaveRequests.find((request) => {
    if (
      request.employeeId !== employeeId ||
      request.rootRequestId === ignoredRootRequestId
    ) {
      return false;
    }

    const blockingRequest = getBlockingRequestForRootChain(
      world,
      request.rootRequestId,
    );

    if (blockingRequest === null) {
      return false;
    }

    const blockingWorkday = resolveExpectedWorkday(
      world,
      employeeId,
      blockingRequest.date,
    );
    const blockingInterval = buildLeaveInterval(
      blockingRequest,
      blockingWorkday,
    );

    return leaveIntervalsOverlap(candidateInterval, blockingInterval);
  });

  if (conflictingRequest !== undefined) {
    throw new LeaveRequestConflictError(
      `A governing leave request chain already exists for employee "${employeeId}" on date "${conflictingRequest.date}"`,
    );
  }
}

function buildNextLeaveRequestId(
  world: CanonicalSeedWorld,
  employeeId: string,
  date: string,
  suffix: "root" | "change" | "cancel" | "resubmission",
) {
  const baseId = `leave_request_${employeeId}_${date}_${suffix}`;

  if (world.leaveRequests.every((request) => request.id !== baseId)) {
    return baseId;
  }

  let index = 2;

  while (
    world.leaveRequests.some((request) => request.id === `${baseId}_${index}`)
  ) {
    index += 1;
  }

  return `${baseId}_${index}`;
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
      usedDays += (getLeaveDurationHours(approvedRequest) ?? 0) / 8;
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

function shouldProjectLeaveConflict(
  request: SeedLeaveRequest,
  projection: NonNullable<ReturnType<typeof buildRequestChainProjection>>,
) {
  return (
    request.status === "pending" ||
    (projection.activeRequestId !== null &&
      projection.effectiveStatus === "approved" &&
      projection.effectiveRequestId === request.id)
  );
}

function toLeaveRequestResource(
  world: CanonicalSeedWorld,
  request: SeedLeaveRequest,
) {
  const projection = buildRequestChainProjection(world, request.id);

  if (projection === null) {
    throw new Error(`Unable to project request chain for ${request.id}`);
  }

  const leaveConflict = !shouldProjectLeaveConflict(request, projection)
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
    hours: getLeaveDurationHours(request),
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
  };

  if (leaveConflict !== null && shouldIncludeLeaveConflict(leaveConflict)) {
    return {
      ...item,
      leaveConflict,
    };
  }

  return item;
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

  return {
    ...toLeaveRequestResource(world, request),
    isTopSurfaceSuppressed:
      projection.activeRequestId === null &&
      (request.status === "rejected" ||
        request.status === "revision_requested") &&
      suppressionRequestIds.has(request.id),
  };
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

export function buildLeaveRequestResource(
  world: CanonicalSeedWorld,
  employeeId: string,
  requestId: string,
) {
  const request = getLeaveRequestById(world, employeeId, requestId);

  if (request === undefined) {
    throw new LeaveRequestNotFoundError(
      `Leave request "${requestId}" was not found`,
    );
  }

  return toLeaveRequestResource(world, request);
}

export function createLeaveRequest(
  world: CanonicalSeedWorld,
  employeeId: string,
  input: LeaveRequestBody,
  requestedAt: string,
) {
  validateRequestableDate(world, employeeId, input.date);
  validateLeaveTiming(
    input.date,
    input.leaveType,
    input.leaveType === "hourly" ? input.startAt : null,
    input.leaveType === "hourly" ? input.endAt : null,
  );

  if (input.parentRequestId === undefined) {
    ensureNoOverlappingRootChain(world, employeeId, {
      date: input.date,
      leaveType: input.leaveType,
      startAt: input.leaveType === "hourly" ? input.startAt : null,
      endAt: input.leaveType === "hourly" ? input.endAt : null,
    });

    const nextRequest = {
      id: buildNextLeaveRequestId(world, employeeId, input.date, "root"),
      employeeId,
      requestType: "leave" as const,
      leaveType: input.leaveType,
      date: input.date,
      startAt: input.leaveType === "hourly" ? input.startAt : null,
      endAt: input.leaveType === "hourly" ? input.endAt : null,
      reason: input.reason,
      requestedAt,
      status: "pending" as const,
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: "",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    };

    nextRequest.rootRequestId = nextRequest.id;
    world.leaveRequests.push(nextRequest);

    return nextRequest;
  }

  const parentRequest = getLeaveRequestById(
    world,
    employeeId,
    input.parentRequestId,
  );

  if (parentRequest === undefined) {
    throw new LeaveRequestNotFoundError(
      `Leave request "${input.parentRequestId}" was not found`,
    );
  }

  if (input.followUpKind === undefined) {
    throw new LeaveRequestValidationError(
      'Leave follow-up requests require "followUpKind"',
    );
  }

  const chainProjection = buildRequestChainProjection(world, parentRequest.id);
  const activeRequestId = chainProjection?.activeRequestId ?? null;

  if (activeRequestId !== null && activeRequestId !== parentRequest.id) {
    throw new LeaveRequestConflictError(
      `Leave request chain "${parentRequest.rootRequestId}" already has an active follow-up request`,
      activeRequestId,
    );
  }

  if (input.followUpKind === "resubmission") {
    if (
      parentRequest.status !== "rejected" &&
      parentRequest.status !== "revision_requested"
    ) {
      throw new LeaveRequestConflictError(
        `Leave request "${parentRequest.id}" cannot accept a resubmission in status "${parentRequest.status}"`,
      );
    }
  } else {
    if (
      parentRequest.status !== "approved" ||
      parentRequest.supersededByRequestId !== null
    ) {
      throw new LeaveRequestConflictError(
        `Leave request "${parentRequest.id}" cannot accept a "${input.followUpKind}" follow-up in its current lifecycle state`,
      );
    }
  }

  ensureNoOverlappingRootChain(
    world,
    employeeId,
    {
      date: input.date,
      leaveType: input.leaveType,
      startAt: input.leaveType === "hourly" ? input.startAt : null,
      endAt: input.leaveType === "hourly" ? input.endAt : null,
    },
    parentRequest.rootRequestId,
  );

  const nextRequest = {
    id: buildNextLeaveRequestId(
      world,
      employeeId,
      input.date,
      input.followUpKind,
    ),
    employeeId,
    requestType: "leave" as const,
    leaveType: input.leaveType,
    date: input.date,
    startAt: input.leaveType === "hourly" ? input.startAt : null,
    endAt: input.leaveType === "hourly" ? input.endAt : null,
    reason: input.reason,
    requestedAt,
    status: "pending" as const,
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: parentRequest.rootRequestId,
    parentRequestId: parentRequest.id,
    followUpKind: input.followUpKind,
    supersededByRequestId: null,
  };

  world.leaveRequests.push(nextRequest);

  return nextRequest;
}

export function updateLeaveRequest(
  world: CanonicalSeedWorld,
  employeeId: string,
  requestId: string,
  input: LeaveRequestPatchBody,
) {
  const request = getLeaveRequestById(world, employeeId, requestId);

  if (request === undefined) {
    throw new LeaveRequestNotFoundError(
      `Leave request "${requestId}" was not found`,
    );
  }

  if (request.status !== "pending") {
    throw new LeaveRequestConflictError(
      `Leave request "${requestId}" is no longer pending`,
    );
  }

  if (input.status === "withdrawn") {
    request.status = "withdrawn";
    return request;
  }

  validatePatchedTimingFields(request, input);

  const nextDate = input.date ?? request.date;
  const nextTiming = resolvePatchedLeaveTiming(request, input);

  validateRequestableDate(world, employeeId, nextDate);
  validateLeaveTiming(
    nextDate,
    nextTiming.leaveType,
    nextTiming.startAt,
    nextTiming.endAt,
  );
  ensureNoOverlappingRootChain(
    world,
    employeeId,
    {
      date: nextDate,
      leaveType: nextTiming.leaveType,
      startAt: nextTiming.startAt,
      endAt: nextTiming.endAt,
    },
    request.rootRequestId,
  );

  request.date = nextDate;
  request.leaveType = nextTiming.leaveType;
  request.startAt = nextTiming.startAt;
  request.endAt = nextTiming.endAt;
  request.reason = input.reason ?? request.reason;

  return request;
}

export { buildLeaveConflictProjection } from "@/lib/repositories/leave-conflicts";
