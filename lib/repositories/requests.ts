import type {
  AdminRequestDecisionBody,
  AdminRequestDecisionResponse,
  AdminRequestsResponse,
} from "@/lib/contracts/requests";
import type {
  RequestChainProjection,
  RequestQueueView,
  RequestType,
} from "@/lib/contracts/shared";
import {
  buildLeaveConflictProjection,
  shouldIncludeLeaveConflict,
} from "@/lib/repositories/leave-conflicts";
import type { CanonicalSeedWorld } from "@/lib/seed/world";

type SeedLeaveRequest = CanonicalSeedWorld["leaveRequests"][number];
type SeedManualRequest = CanonicalSeedWorld["manualAttendanceRequests"][number];
type SeedRequest = SeedLeaveRequest | SeedManualRequest;
type SeedAttendanceRecord = CanonicalSeedWorld["attendanceRecords"][number];

export class AdminRequestNotFoundError extends Error {}
export class AdminRequestConflictError extends Error {}

export type RequestChainLookup = Readonly<{
  rootRequestId: string;
  requestType: RequestType;
  requestIds: string[];
  activeRequestId: string | null;
  effectiveRequestId: string;
  projection: RequestChainProjection;
}>;

function getAllRequests(world: CanonicalSeedWorld): SeedRequest[] {
  return [...world.leaveRequests, ...world.manualAttendanceRequests];
}

function getRequestTimestamp(request: SeedRequest) {
  return new Date(
    request.requestType === "leave" ? request.requestedAt : request.submittedAt,
  ).getTime();
}

function getRequestById(
  world: CanonicalSeedWorld,
  requestId: string,
): SeedRequest | undefined {
  return getAllRequests(world).find((request) => request.id === requestId);
}

function getAttendanceRecordId(employeeId: string, date: string) {
  return `attendance_record_${employeeId}_${date}`;
}

function getChainRequests(
  world: CanonicalSeedWorld,
  rootRequestId: string,
): SeedRequest[] {
  return getAllRequests(world)
    .filter((request) => request.rootRequestId === rootRequestId)
    .sort(
      (left, right) => getRequestTimestamp(left) - getRequestTimestamp(right),
    );
}

function getRequestReviewTime(request: SeedRequest) {
  return request.reviewedAt === null
    ? 0
    : new Date(request.reviewedAt).getTime();
}

function shouldProjectAdminLeaveConflict(
  request: SeedLeaveRequest,
  projection: RequestChainProjection,
) {
  return (
    request.id === projection.activeRequestId ||
    (projection.activeRequestId !== null &&
      projection.effectiveStatus === "approved" &&
      projection.effectiveRequestId === request.id)
  );
}

function ensureRequestIsWritable(world: CanonicalSeedWorld, requestId: string) {
  const request = getRequestById(world, requestId);

  if (request === undefined) {
    throw new AdminRequestNotFoundError(`Request "${requestId}" was not found`);
  }

  if (request.supersededByRequestId !== null) {
    throw new AdminRequestConflictError(
      `Request "${requestId}" has been superseded and is no longer writable`,
    );
  }

  const chain = findRequestChainByRequestId(world, requestId);

  if (chain === null) {
    throw new AdminRequestNotFoundError(`Request "${requestId}" was not found`);
  }

  if (chain.activeRequestId !== requestId) {
    if (chain.activeRequestId !== null) {
      throw new AdminRequestConflictError(
        `Request "${requestId}" is not the current active request in its chain`,
      );
    }

    if (
      request.status === "rejected" ||
      request.status === "revision_requested"
    ) {
      throw new AdminRequestConflictError(
        `Request "${requestId}" is locked after review; submit a linked follow-up instead of reopening the same record`,
      );
    }
  }

  if (request.status !== "pending") {
    throw new AdminRequestConflictError(
      `Request "${requestId}" is not writable because its status is "${request.status}"`,
    );
  }

  return request;
}

function appendReviewEvent(
  world: CanonicalSeedWorld,
  request: SeedRequest,
  input: {
    decision: AdminRequestDecisionBody["decision"];
    reviewComment: string | null;
    reviewedAt: string;
    reviewerId: string;
  },
) {
  world.requestReviewEvents.push({
    id: `request_review_${request.id}`,
    requestId: request.id,
    decision: input.decision,
    reviewComment: input.reviewComment,
    reviewedAt: input.reviewedAt,
    reviewerId: input.reviewerId,
  });
}

function calculateWorkMinutes(
  clockInAt: string | null,
  clockOutAt: string | null,
) {
  if (clockInAt === null || clockOutAt === null) {
    return null;
  }

  return Math.round(
    (new Date(clockOutAt).getTime() - new Date(clockInAt).getTime()) / 60000,
  );
}

function findAttendanceRecord(
  world: CanonicalSeedWorld,
  employeeId: string,
  date: string,
) {
  return (
    world.attendanceRecords.find(
      (record) => record.employeeId === employeeId && record.date === date,
    ) ?? null
  );
}

function getOrCreateAttendanceRecord(
  world: CanonicalSeedWorld,
  employeeId: string,
  date: string,
) {
  const existingRecord = findAttendanceRecord(world, employeeId, date);

  if (existingRecord !== null) {
    return existingRecord;
  }

  const record: SeedAttendanceRecord = {
    id: getAttendanceRecordId(employeeId, date),
    employeeId,
    date,
    clockInAt: null,
    clockInSource: null,
    clockOutAt: null,
    clockOutSource: null,
    workMinutes: null,
    manualRequestId: null,
  };

  world.attendanceRecords.push(record);

  return record;
}

function applyApprovedManualAttendanceWriteback(
  world: CanonicalSeedWorld,
  request: SeedManualRequest,
) {
  const record = getOrCreateAttendanceRecord(
    world,
    request.employeeId,
    request.date,
  );

  if (request.action === "clock_in" || request.action === "both") {
    record.clockInAt = request.requestedClockInAt;
    record.clockInSource = "manual";
  }

  if (request.action === "clock_out" || request.action === "both") {
    record.clockOutAt = request.requestedClockOutAt;
    record.clockOutSource = "manual";
  }

  record.workMinutes = calculateWorkMinutes(
    record.clockInAt,
    record.clockOutAt,
  );
  record.manualRequestId = request.id;
}

function toAdminRequestDecisionResponse(
  world: CanonicalSeedWorld,
  request: SeedRequest,
  status: AdminRequestDecisionResponse["status"],
): AdminRequestDecisionResponse {
  const projection = buildRequestChainProjection(world, request.id);

  if (projection === null) {
    throw new Error(`Unable to project request chain for ${request.id}`);
  }

  return {
    id: request.id,
    requestType: request.requestType,
    status,
    reviewedAt: request.reviewedAt,
    reviewComment: request.reviewComment,
    governingReviewComment: projection.governingReviewComment,
    activeRequestId: projection.activeRequestId,
    activeStatus: projection.activeStatus,
    effectiveRequestId: projection.effectiveRequestId,
    effectiveStatus: projection.effectiveStatus,
    hasActiveFollowUp: projection.hasActiveFollowUp,
    nextAction: projection.nextAction,
  };
}

export function findRequestChainByRequestId(
  world: CanonicalSeedWorld,
  requestId: string,
): RequestChainLookup | null {
  const request = getRequestById(world, requestId);

  if (request === undefined) {
    return null;
  }

  const chainRequests = getChainRequests(world, request.rootRequestId);
  const projection = buildRequestChainProjection(world, requestId);

  if (projection === null) {
    return null;
  }

  return {
    rootRequestId: request.rootRequestId,
    requestType: chainRequests[0]?.requestType ?? request.requestType,
    requestIds: chainRequests.map((chainRequest) => chainRequest.id),
    activeRequestId: projection.activeRequestId,
    effectiveRequestId: projection.effectiveRequestId,
    projection,
  };
}

export function buildRequestChainProjection(
  world: CanonicalSeedWorld,
  requestId: string,
): RequestChainProjection | null {
  const request = getRequestById(world, requestId);

  if (request === undefined) {
    return null;
  }

  const chainRequests = getChainRequests(world, request.rootRequestId);
  const activeRequests = chainRequests.filter(
    (chainRequest) => chainRequest.status === "pending",
  );
  const activeRequest = activeRequests.at(-1) ?? null;

  if (activeRequest !== null) {
    const parentRequest =
      activeRequest.parentRequestId === null
        ? null
        : (getRequestById(world, activeRequest.parentRequestId) ?? null);
    const effectiveRequest =
      parentRequest?.status === "approved" ? parentRequest : activeRequest;

    return {
      activeRequestId: activeRequest.id,
      activeStatus: "pending",
      effectiveRequestId: effectiveRequest.id,
      effectiveStatus: effectiveRequest.status,
      governingReviewComment: null,
      hasActiveFollowUp: activeRequest.parentRequestId !== null,
      nextAction: "admin_review",
    };
  }

  const latestRequest = chainRequests.at(-1) ?? request;
  const latestParentRequest =
    latestRequest.parentRequestId === null
      ? null
      : (getRequestById(world, latestRequest.parentRequestId) ?? null);
  const fallsBackToParentRequest =
    latestRequest.status === "withdrawn" && latestParentRequest !== null;
  const keepsApprovedParentEffective =
    latestParentRequest?.status === "approved" &&
    latestRequest.requestType === "leave" &&
    (latestRequest.followUpKind === "change" ||
      latestRequest.followUpKind === "cancel") &&
    (latestRequest.status === "rejected" ||
      latestRequest.status === "revision_requested");
  const fallbackEffectiveRequest =
    fallsBackToParentRequest || keepsApprovedParentEffective
      ? latestParentRequest
      : latestRequest;
  const governingReviewComment =
    keepsApprovedParentEffective &&
    (latestRequest.status === "rejected" ||
      latestRequest.status === "revision_requested")
      ? latestRequest.reviewComment
      : fallbackEffectiveRequest.status === "rejected" ||
          fallbackEffectiveRequest.status === "revision_requested"
        ? fallbackEffectiveRequest.reviewComment
        : null;

  return {
    activeRequestId: null,
    activeStatus: null,
    effectiveRequestId: fallbackEffectiveRequest.id,
    effectiveStatus: fallbackEffectiveRequest.status,
    governingReviewComment,
    hasActiveFollowUp: false,
    nextAction: "none",
  };
}

function getRequestSubmissionTime(request: SeedRequest) {
  return request.requestType === "leave"
    ? request.requestedAt
    : request.submittedAt;
}

function getQueueItemEmployee(world: CanonicalSeedWorld, employeeId: string) {
  const employee = world.employees.find(
    (candidate) => candidate.id === employeeId,
  );

  if (employee === undefined) {
    throw new Error(`Unknown employee id: ${employeeId}`);
  }

  return {
    id: employee.id,
    name: employee.name,
    department: employee.department,
  };
}

function toManualAttendanceFollowUpKind(
  followUpKind: SeedManualRequest["followUpKind"],
) {
  return followUpKind === "resubmission" ? followUpKind : null;
}

function toQueueItem(
  world: CanonicalSeedWorld,
  request: SeedRequest,
  projection: RequestChainProjection,
) {
  if (request.requestType === "manual_attendance") {
    return {
      id: request.id,
      employee: getQueueItemEmployee(world, request.employeeId),
      requestType: "manual_attendance" as const,
      subtype: request.action,
      targetDate: request.date,
      reason: request.reason,
      status: request.status,
      reviewedAt: request.reviewedAt,
      reviewComment: request.reviewComment,
      governingReviewComment: projection.governingReviewComment,
      rootRequestId: request.rootRequestId,
      parentRequestId: request.parentRequestId,
      followUpKind: toManualAttendanceFollowUpKind(request.followUpKind),
      supersededByRequestId: request.supersededByRequestId,
      activeRequestId: projection.activeRequestId,
      activeStatus: projection.activeStatus,
      effectiveRequestId: projection.effectiveRequestId,
      effectiveStatus: projection.effectiveStatus,
      hasActiveFollowUp: projection.hasActiveFollowUp,
      nextAction: projection.nextAction,
      submittedAt: request.submittedAt,
    };
  }

  const commonFields = {
    id: request.id,
    employee: getQueueItemEmployee(world, request.employeeId),
    requestType: "leave" as const,
    subtype: request.leaveType,
    targetDate: request.date,
    reason: request.reason,
    status: request.status,
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

  const leaveItem = {
    ...commonFields,
    requestedAt: request.requestedAt,
  };

  if (!shouldProjectAdminLeaveConflict(request, projection)) {
    return leaveItem;
  }

  const leaveConflict = buildLeaveConflictProjection(world, {
    employeeId: request.employeeId,
    date: request.date,
    excludePendingRequestId: request.id,
  });

  if (shouldIncludeLeaveConflict(leaveConflict)) {
    return {
      ...leaveItem,
      leaveConflict,
    };
  }

  return leaveItem;
}

function getCompletedQueueRequest(
  chainRequests: SeedRequest[],
  projection: RequestChainProjection,
) {
  const effectiveRequest =
    chainRequests.find(
      (request) => request.id === projection.effectiveRequestId,
    ) ?? null;
  const latestRequest = chainRequests.at(-1) ?? null;

  if (
    latestRequest?.requestType === "leave" &&
    (latestRequest.status === "rejected" ||
      latestRequest.status === "revision_requested") &&
    (latestRequest.followUpKind === "change" ||
      latestRequest.followUpKind === "cancel") &&
    projection.effectiveStatus === "approved" &&
    projection.effectiveRequestId !== latestRequest.id
  ) {
    return latestRequest;
  }

  return effectiveRequest;
}

export function getAdminRequests(
  world: CanonicalSeedWorld,
  input: { view?: RequestQueueView } = {},
): AdminRequestsResponse {
  const viewFilter = input.view ?? "needs_review";
  const chains = new Map<string, SeedRequest[]>();

  for (const request of getAllRequests(world)) {
    const group = chains.get(request.rootRequestId) ?? [];
    group.push(request);
    chains.set(request.rootRequestId, group);
  }

  const queueEntries = Array.from(chains.values()).map((chainRequests) => {
    const chainRoot = chainRequests
      .slice()
      .sort(
        (left, right) => getRequestTimestamp(left) - getRequestTimestamp(right),
      )[0];
    const projection = buildRequestChainProjection(world, chainRoot.id);

    if (projection === null) {
      return null;
    }

    const activeRequest =
      projection.activeRequestId === null
        ? null
        : (chainRequests.find(
            (request) => request.id === projection.activeRequestId,
          ) ?? null);
    const completedRequest = getCompletedQueueRequest(
      chainRequests,
      projection,
    );

    if (activeRequest !== null) {
      return {
        kind: "needs_review" as const,
        item: toQueueItem(world, activeRequest, projection),
        sortTime: getRequestSubmissionTime(activeRequest),
      };
    }

    if (completedRequest === null) {
      return null;
    }

    return {
      kind: "completed" as const,
      item: toQueueItem(world, completedRequest, projection),
      sortTime:
        completedRequest.status === "withdrawn"
          ? getRequestSubmissionTime(completedRequest)
          : getRequestReviewTime(completedRequest),
      status: completedRequest.status,
    };
  });

  const needsReviewItems = queueEntries
    .filter(
      (entry): entry is Extract<typeof entry, { kind: "needs_review" }> =>
        entry !== null && entry.kind === "needs_review",
    )
    .sort(
      (left, right) =>
        getRequestTimestampForSort(right.sortTime) -
        getRequestTimestampForSort(left.sortTime),
    )
    .map((entry) => entry.item);

  const completedEntries = queueEntries.filter(
    (entry): entry is Extract<typeof entry, { kind: "completed" }> =>
      entry !== null && entry.kind === "completed",
  );

  const approvedItems = completedEntries
    .filter((entry) => entry.status === "approved")
    .sort(
      (left, right) =>
        getRequestTimestampForSort(right.sortTime) -
        getRequestTimestampForSort(left.sortTime),
    )
    .map((entry) => entry.item);

  const withdrawnItems = completedEntries
    .filter((entry) => entry.status === "withdrawn")
    .sort(
      (left, right) =>
        getRequestTimestampForSort(right.sortTime) -
        getRequestTimestampForSort(left.sortTime),
    )
    .map((entry) => entry.item);

  const reviewedItems = completedEntries
    .filter(
      (entry) =>
        entry.status === "rejected" || entry.status === "revision_requested",
    )
    .sort(
      (left, right) =>
        getRequestTimestampForSort(right.sortTime) -
        getRequestTimestampForSort(left.sortTime),
    )
    .map((entry) => entry.item);

  const completedItems = [
    ...approvedItems,
    ...withdrawnItems,
    ...reviewedItems,
  ];

  return {
    viewFilter,
    items:
      viewFilter === "needs_review"
        ? needsReviewItems
        : viewFilter === "completed"
          ? completedItems
          : [...needsReviewItems, ...completedItems],
  };
}

export function reviewAdminRequest(
  world: CanonicalSeedWorld,
  requestId: string,
  decision: AdminRequestDecisionBody,
  input: {
    reviewedAt: string;
    reviewerId: string;
  },
): AdminRequestDecisionResponse {
  const request = ensureRequestIsWritable(world, requestId);
  const nextStatus: AdminRequestDecisionResponse["status"] =
    decision.decision === "approve"
      ? "approved"
      : decision.decision === "reject"
        ? "rejected"
        : "revision_requested";
  const reviewComment =
    decision.decision === "approve" ? null : decision.reviewComment;

  request.status = nextStatus;
  request.reviewedAt = input.reviewedAt;
  request.reviewComment = reviewComment;

  appendReviewEvent(world, request, {
    decision: decision.decision,
    reviewComment,
    reviewedAt: input.reviewedAt,
    reviewerId: input.reviewerId,
  });

  if (
    request.requestType === "leave" &&
    nextStatus === "approved" &&
    request.parentRequestId !== null &&
    (request.followUpKind === "change" || request.followUpKind === "cancel")
  ) {
    const parentRequest = getRequestById(world, request.parentRequestId);

    if (parentRequest?.requestType === "leave") {
      parentRequest.supersededByRequestId = request.id;
    }
  }

  if (
    request.requestType === "manual_attendance" &&
    nextStatus === "approved"
  ) {
    applyApprovedManualAttendanceWriteback(world, request);
  }

  return toAdminRequestDecisionResponse(world, request, nextStatus);
}

function getRequestTimestampForSort(timestamp: string | number) {
  return typeof timestamp === "number"
    ? timestamp
    : new Date(timestamp).getTime();
}
