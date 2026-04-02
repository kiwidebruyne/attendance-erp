import type {
  ManualAttendanceRequestBody,
  ManualAttendanceRequestPatchBody,
} from "@/lib/contracts/attendance";
import type {
  AttendanceSurfaceManualRequestResource,
  ManualAttendanceRequestResource,
  RequestStatus,
} from "@/lib/contracts/shared";
import type { CanonicalSeedWorld } from "@/lib/seed/world";

type SeedManualAttendanceRequest =
  CanonicalSeedWorld["manualAttendanceRequests"][number];

type ManualAttendanceProjection = Readonly<{
  activeRequest: SeedManualAttendanceRequest | null;
  effectiveRequest: SeedManualAttendanceRequest;
  governingReviewComment: string | null;
  hasActiveFollowUp: boolean;
}>;

export class ManualAttendanceConflictError extends Error {}
export class ManualAttendanceNotFoundError extends Error {}
export class ManualAttendanceValidationError extends Error {}

function compareRequestTimes(
  left: SeedManualAttendanceRequest,
  right: SeedManualAttendanceRequest,
) {
  return (
    new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime()
  );
}

function getManualAttendanceRequestById(
  world: CanonicalSeedWorld,
  employeeId: string,
  requestId: string,
) {
  return world.manualAttendanceRequests.find(
    (request) => request.employeeId === employeeId && request.id === requestId,
  );
}

function getChainRequests(world: CanonicalSeedWorld, rootRequestId: string) {
  return world.manualAttendanceRequests
    .filter((request) => request.rootRequestId === rootRequestId)
    .sort(compareRequestTimes);
}

function getLatestReviewedNonApprovedRequest(
  chainRequests: SeedManualAttendanceRequest[],
) {
  return (
    chainRequests
      .filter(
        (request) =>
          request.status === "rejected" ||
          request.status === "revision_requested",
      )
      .sort((left, right) => {
        const leftTime = new Date(
          left.reviewedAt ?? left.submittedAt,
        ).getTime();
        const rightTime = new Date(
          right.reviewedAt ?? right.submittedAt,
        ).getTime();

        return leftTime - rightTime;
      })
      .at(-1) ?? null
  );
}

function buildManualAttendanceProjection(
  chainRequests: SeedManualAttendanceRequest[],
): ManualAttendanceProjection {
  const latestReviewedNonApprovedRequest =
    getLatestReviewedNonApprovedRequest(chainRequests);
  const activeRequest =
    chainRequests.filter((request) => request.status === "pending").at(-1) ??
    null;

  if (activeRequest !== null) {
    return {
      activeRequest,
      effectiveRequest: activeRequest,
      governingReviewComment:
        latestReviewedNonApprovedRequest?.reviewComment ?? null,
      hasActiveFollowUp: activeRequest.parentRequestId !== null,
    };
  }

  const latestRequest = chainRequests.at(-1) ?? chainRequests[0]!;

  return {
    activeRequest: null,
    effectiveRequest:
      latestRequest.status === "withdrawn" &&
      latestReviewedNonApprovedRequest !== null
        ? latestReviewedNonApprovedRequest
        : latestRequest,
    governingReviewComment:
      latestReviewedNonApprovedRequest?.reviewComment ?? null,
    hasActiveFollowUp: false,
  };
}

function toManualAttendanceFollowUpKind(
  followUpKind: SeedManualAttendanceRequest["followUpKind"],
) {
  return followUpKind === "resubmission" ? followUpKind : null;
}

function toFullManualAttendanceResource(
  request: SeedManualAttendanceRequest,
  projection: ManualAttendanceProjection,
): ManualAttendanceRequestResource {
  return {
    id: request.id,
    requestType: request.requestType,
    action: request.action,
    date: request.date,
    submittedAt: request.submittedAt,
    requestedClockInAt: request.requestedClockInAt,
    requestedClockOutAt: request.requestedClockOutAt,
    reason: request.reason,
    status: request.status,
    reviewedAt: request.reviewedAt,
    reviewComment: request.reviewComment,
    governingReviewComment: projection.governingReviewComment,
    rootRequestId: request.rootRequestId,
    parentRequestId: request.parentRequestId,
    followUpKind: toManualAttendanceFollowUpKind(request.followUpKind),
    supersededByRequestId: request.supersededByRequestId,
    activeRequestId: projection.activeRequest?.id ?? null,
    activeStatus: projection.activeRequest?.status ?? null,
    effectiveRequestId: projection.effectiveRequest.id,
    effectiveStatus: projection.effectiveRequest.status,
    hasActiveFollowUp: projection.hasActiveFollowUp,
    nextAction: projection.activeRequest === null ? "none" : "admin_review",
  };
}

function toAttendanceSurfaceStatus(status: RequestStatus) {
  if (
    status === "pending" ||
    status === "rejected" ||
    status === "revision_requested"
  ) {
    return status;
  }

  return null;
}

function toAttendanceSurfaceResource(
  request: SeedManualAttendanceRequest,
  projection: ManualAttendanceProjection,
): AttendanceSurfaceManualRequestResource | null {
  const status = toAttendanceSurfaceStatus(request.status);
  const effectiveStatus = toAttendanceSurfaceStatus(
    projection.effectiveRequest.status,
  );

  if (status === null || effectiveStatus === null) {
    return null;
  }

  return {
    ...toFullManualAttendanceResource(request, projection),
    status,
    activeStatus: projection.activeRequest === null ? null : "pending",
    effectiveStatus,
  };
}

function hasOpenAttendanceRecord(
  world: CanonicalSeedWorld,
  employeeId: string,
  date: string,
) {
  return world.attendanceRecords.some(
    (record) =>
      record.employeeId === employeeId &&
      record.date === date &&
      record.clockInAt !== null &&
      record.clockOutAt === null,
  );
}

function validateManualAttendanceFields(
  action: SeedManualAttendanceRequest["action"],
  requestedClockInAt: string | null,
  requestedClockOutAt: string | null,
) {
  if (action === "clock_in") {
    if (requestedClockInAt === null || requestedClockOutAt !== null) {
      throw new ManualAttendanceValidationError(
        'Manual attendance "clock_in" requires only "requestedClockInAt"',
      );
    }
  }

  if (action === "clock_out") {
    if (requestedClockOutAt === null || requestedClockInAt !== null) {
      throw new ManualAttendanceValidationError(
        'Manual attendance "clock_out" requires only "requestedClockOutAt"',
      );
    }
  }

  if (action === "both") {
    if (requestedClockInAt === null || requestedClockOutAt === null) {
      throw new ManualAttendanceValidationError(
        'Manual attendance "both" requires both requested clock fields',
      );
    }
  }
}

function resolvePatchedClockFields(
  request: SeedManualAttendanceRequest,
  input: ManualAttendanceRequestPatchBody,
  nextAction: SeedManualAttendanceRequest["action"],
) {
  if (nextAction === "clock_in") {
    return {
      requestedClockInAt:
        input.requestedClockInAt ?? request.requestedClockInAt,
      requestedClockOutAt: null,
    };
  }

  if (nextAction === "clock_out") {
    return {
      requestedClockInAt: null,
      requestedClockOutAt:
        input.requestedClockOutAt ?? request.requestedClockOutAt,
    };
  }

  return {
    requestedClockInAt: input.requestedClockInAt ?? request.requestedClockInAt,
    requestedClockOutAt:
      input.requestedClockOutAt ?? request.requestedClockOutAt,
  };
}

function validateClockOutOpenRecordRule(
  world: CanonicalSeedWorld,
  employeeId: string,
  date: string,
  action: SeedManualAttendanceRequest["action"],
) {
  if (
    action === "clock_out" &&
    !hasOpenAttendanceRecord(world, employeeId, date)
  ) {
    throw new ManualAttendanceConflictError(
      `Manual attendance action "clock_out" requires an open attendance record on date "${date}"`,
    );
  }
}

function validateFollowUpTargetDate(
  parentRequest: SeedManualAttendanceRequest,
  date: string,
) {
  if (date !== parentRequest.date) {
    throw new ManualAttendanceConflictError(
      `Manual attendance follow-up requests must keep target date "${parentRequest.date}" from parent request "${parentRequest.id}"`,
    );
  }
}

function ensureNoGoverningChainConflict(
  world: CanonicalSeedWorld,
  employeeId: string,
  date: string,
  ignoredRootRequestId?: string,
) {
  const conflictingRequest = world.manualAttendanceRequests.find(
    (request) =>
      request.employeeId === employeeId &&
      request.date === date &&
      request.rootRequestId !== ignoredRootRequestId,
  );

  if (conflictingRequest !== undefined) {
    throw new ManualAttendanceConflictError(
      `A governing manual attendance chain already exists for employee "${employeeId}" on date "${date}"`,
    );
  }
}

function buildNextManualAttendanceRequestId(
  world: CanonicalSeedWorld,
  employeeId: string,
  date: string,
  suffix: "root" | "resubmission",
) {
  const baseId = `manual_request_${employeeId}_${date}_${suffix}`;

  if (
    world.manualAttendanceRequests.every((request) => request.id !== baseId)
  ) {
    return baseId;
  }

  let index = 2;

  while (
    world.manualAttendanceRequests.some(
      (request) => request.id === `${baseId}_${index}`,
    )
  ) {
    index += 1;
  }

  return `${baseId}_${index}`;
}

export function buildManualAttendanceRequestResource(
  world: CanonicalSeedWorld,
  employeeId: string,
  requestId: string,
) {
  const request = getManualAttendanceRequestById(world, employeeId, requestId);

  if (request === undefined) {
    throw new ManualAttendanceNotFoundError(
      `Manual attendance request "${requestId}" was not found`,
    );
  }

  return toFullManualAttendanceResource(
    request,
    buildManualAttendanceProjection(
      getChainRequests(world, request.rootRequestId),
    ),
  );
}

export function resolveAttendanceSurfaceManualRequest(
  world: CanonicalSeedWorld,
  employeeId: string,
  date: string,
  previousDayOpenRecord: { date: string } | null,
) {
  const buildSurfaceResourceForDate = (targetDate: string) => {
    const chainRequests = world.manualAttendanceRequests.filter(
      (request) =>
        request.employeeId === employeeId && request.date === targetDate,
    );

    if (chainRequests.length === 0) {
      return null;
    }

    const projection = buildManualAttendanceProjection(chainRequests);
    const surfacedRequest =
      projection.activeRequest ??
      (projection.effectiveRequest.status === "rejected" ||
      projection.effectiveRequest.status === "revision_requested"
        ? projection.effectiveRequest
        : null);

    if (surfacedRequest === null) {
      return null;
    }

    return toAttendanceSurfaceResource(surfacedRequest, projection);
  };

  if (previousDayOpenRecord !== null) {
    const carryOverResource = buildSurfaceResourceForDate(
      previousDayOpenRecord.date,
    );

    if (carryOverResource !== null) {
      return carryOverResource;
    }
  }

  return buildSurfaceResourceForDate(date);
}

export function createManualAttendanceRequest(
  world: CanonicalSeedWorld,
  employeeId: string,
  input: ManualAttendanceRequestBody,
  submittedAt: string,
) {
  validateManualAttendanceFields(
    input.action,
    input.requestedClockInAt ?? null,
    input.requestedClockOutAt ?? null,
  );

  if (input.parentRequestId === undefined) {
    validateClockOutOpenRecordRule(world, employeeId, input.date, input.action);
    ensureNoGoverningChainConflict(world, employeeId, input.date);

    const nextRequest = {
      id: buildNextManualAttendanceRequestId(
        world,
        employeeId,
        input.date,
        "root",
      ),
      employeeId,
      requestType: "manual_attendance" as const,
      action: input.action,
      date: input.date,
      submittedAt,
      requestedClockInAt: input.requestedClockInAt ?? null,
      requestedClockOutAt: input.requestedClockOutAt ?? null,
      reason: input.reason,
      status: "pending" as const,
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: "",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    };

    nextRequest.rootRequestId = nextRequest.id;
    world.manualAttendanceRequests.push(nextRequest);

    return nextRequest;
  }

  const parentRequest = getManualAttendanceRequestById(
    world,
    employeeId,
    input.parentRequestId,
  );

  if (parentRequest === undefined) {
    throw new ManualAttendanceNotFoundError(
      `Manual attendance request "${input.parentRequestId}" was not found`,
    );
  }

  if (
    parentRequest.status !== "rejected" &&
    parentRequest.status !== "revision_requested"
  ) {
    throw new ManualAttendanceConflictError(
      `Manual attendance request "${parentRequest.id}" cannot accept a resubmission in status "${parentRequest.status}"`,
    );
  }

  validateFollowUpTargetDate(parentRequest, input.date);
  validateClockOutOpenRecordRule(world, employeeId, input.date, input.action);

  const chainRequests = getChainRequests(world, parentRequest.rootRequestId);
  const projection = buildManualAttendanceProjection(chainRequests);

  if (projection.activeRequest !== null) {
    throw new ManualAttendanceConflictError(
      `Manual attendance chain "${parentRequest.rootRequestId}" already has an active follow-up request`,
    );
  }

  const nextRequest = {
    id: buildNextManualAttendanceRequestId(
      world,
      employeeId,
      input.date,
      "resubmission",
    ),
    employeeId,
    requestType: "manual_attendance" as const,
    action: input.action,
    date: input.date,
    submittedAt,
    requestedClockInAt: input.requestedClockInAt ?? null,
    requestedClockOutAt: input.requestedClockOutAt ?? null,
    reason: input.reason,
    status: "pending" as const,
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: parentRequest.rootRequestId,
    parentRequestId: parentRequest.id,
    followUpKind: "resubmission" as const,
    supersededByRequestId: null,
  };

  world.manualAttendanceRequests.push(nextRequest);

  return nextRequest;
}

export function updateManualAttendanceRequest(
  world: CanonicalSeedWorld,
  employeeId: string,
  requestId: string,
  input: ManualAttendanceRequestPatchBody,
) {
  const request = getManualAttendanceRequestById(world, employeeId, requestId);

  if (request === undefined) {
    throw new ManualAttendanceNotFoundError(
      `Manual attendance request "${requestId}" was not found`,
    );
  }

  if (request.status !== "pending") {
    throw new ManualAttendanceConflictError(
      `Manual attendance request "${requestId}" is no longer pending`,
    );
  }

  if (input.status === "withdrawn") {
    request.status = "withdrawn";
    return request;
  }

  const nextDate = input.date ?? request.date;
  const nextAction = input.action ?? request.action;
  const nextClockFields = resolvePatchedClockFields(request, input, nextAction);
  const parentRequest =
    request.parentRequestId === null
      ? null
      : getManualAttendanceRequestById(
          world,
          employeeId,
          request.parentRequestId,
        );

  if (request.parentRequestId !== null && parentRequest === undefined) {
    throw new ManualAttendanceNotFoundError(
      `Manual attendance request "${request.parentRequestId}" was not found`,
    );
  }

  if (parentRequest !== null && parentRequest !== undefined) {
    validateFollowUpTargetDate(parentRequest, nextDate);
  }

  validateManualAttendanceFields(
    nextAction,
    nextClockFields.requestedClockInAt,
    nextClockFields.requestedClockOutAt,
  );
  validateClockOutOpenRecordRule(world, employeeId, nextDate, nextAction);

  if (nextDate !== request.date) {
    ensureNoGoverningChainConflict(
      world,
      employeeId,
      nextDate,
      request.rootRequestId,
    );
  }

  request.date = nextDate;
  request.action = nextAction;
  request.requestedClockInAt = nextClockFields.requestedClockInAt;
  request.requestedClockOutAt = nextClockFields.requestedClockOutAt;
  request.reason = input.reason ?? request.reason;

  return request;
}
