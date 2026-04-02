import type {
  AdminRequestsResponse,
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

  const effectiveRequest = chainRequests.at(-1) ?? request;

  return {
    activeRequestId: null,
    activeStatus: null,
    effectiveRequestId: effectiveRequest.id,
    effectiveStatus: effectiveRequest.status,
    governingReviewComment:
      effectiveRequest.status === "rejected" ||
      effectiveRequest.status === "revision_requested"
        ? effectiveRequest.reviewComment
        : null,
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

function toQueueItem(
  world: CanonicalSeedWorld,
  request: SeedRequest,
  projection: RequestChainProjection,
) {
  const commonFields = {
    id: request.id,
    employee: getQueueItemEmployee(world, request.employeeId),
    requestType: request.requestType,
    subtype:
      request.requestType === "leave" ? request.leaveType : request.action,
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

  if (request.requestType === "manual_attendance") {
    return {
      ...commonFields,
      submittedAt: request.submittedAt,
    };
  }

  const leaveConflict = buildLeaveConflictProjection(world, {
    employeeId: request.employeeId,
    date: request.date,
    excludePendingRequestId: request.id,
  });

  const leaveItem = {
    ...commonFields,
    requestedAt: request.requestedAt,
  };

  if (shouldIncludeLeaveConflict(leaveConflict)) {
    return {
      ...leaveItem,
      leaveConflict,
    };
  }

  return leaveItem;
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
    const effectiveRequest =
      chainRequests.find(
        (request) => request.id === projection.effectiveRequestId,
      ) ?? null;

    if (activeRequest !== null) {
      return {
        kind: "needs_review" as const,
        item: toQueueItem(world, activeRequest, projection),
        sortTime: getRequestSubmissionTime(activeRequest),
      };
    }

    if (effectiveRequest === null) {
      return null;
    }

    return {
      kind: "completed" as const,
      item: toQueueItem(world, effectiveRequest, projection),
      sortTime:
        effectiveRequest.status === "withdrawn"
          ? getRequestSubmissionTime(effectiveRequest)
          : getRequestReviewTime(effectiveRequest),
      status: effectiveRequest.status,
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
    .sort((left, right) => right.sortTime - left.sortTime)
    .map((entry) => entry.item);

  const withdrawnItems = completedEntries
    .filter((entry) => entry.status === "withdrawn")
    .sort((left, right) => right.sortTime - left.sortTime)
    .map((entry) => entry.item);

  const reviewedItems = completedEntries
    .filter(
      (entry) =>
        entry.status === "rejected" || entry.status === "revision_requested",
    )
    .sort((left, right) => right.sortTime - left.sortTime)
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

function getRequestTimestampForSort(timestamp: string) {
  return new Date(timestamp).getTime();
}
