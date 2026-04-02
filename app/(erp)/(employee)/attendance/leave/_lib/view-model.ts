import type { LeavePageData } from "@/app/(erp)/(employee)/attendance/leave/_lib/page-data";
import {
  formatLeaveRequestSummary,
  formatLeaveStatusDescription,
  formatLeaveStatusLabel,
  formatLeaveTypeLabel,
} from "@/app/(erp)/(employee)/attendance/leave/_lib/format";
import type { LeaveType } from "@/lib/contracts/shared";

type LeaveRequestItem = LeavePageData["overview"]["requests"][number];

export type LeaveComposerMode =
  | "new"
  | "edit"
  | "resubmit"
  | "change"
  | "cancel";

export type LeaveComposerDraft = Readonly<{
  date: string;
  endTime: string;
  followUpKind: LeaveRequestItem["followUpKind"];
  leaveType: LeaveType;
  mode: LeaveComposerMode;
  parentRequestId: string | null;
  reason: string;
  requestId: string | null;
  startTime: string;
}>;

export type LeaveChainAction = Readonly<{
  kind: "edit" | "withdraw" | "resubmit" | "change" | "cancel";
  label: string;
  requestId: string;
}>;

export type LeaveChainModel = Readonly<{
  activeRequest: LeaveRequestItem | null;
  correctionHeadline: string | null;
  currentSummary: string;
  effectiveRequest: LeaveRequestItem;
  latestActivityAt: string;
  latestActivityLabel: string;
  latestRequest: LeaveRequestItem;
  primaryAction: LeaveChainAction | null;
  reasonSummary: string;
  requests: readonly LeaveRequestItem[];
  reviewComment: string | null;
  rootRequestId: string;
  secondaryAction: LeaveChainAction | null;
  selectedDateSummary: string;
  statusDescription: string;
  statusLabel: string;
  statusTone: "approved" | "attention" | "neutral" | "pending";
  topCorrectionEligible: boolean;
}>;

export type LeavePageViewModel = Readonly<{
  attentionCount: number;
  correctionCandidates: readonly LeaveChainModel[];
  monthPlannedCount: number;
  pendingCount: number;
  selectedDateChains: readonly LeaveChainModel[];
  totalChains: number;
  upcomingApprovedCount: number;
  visibleChains: readonly LeaveChainModel[];
}>;

function getRequestTimestamp(request: LeaveRequestItem) {
  return new Date(request.requestedAt).getTime();
}

function getReviewTimestamp(request: LeaveRequestItem) {
  return request.reviewedAt === null ? 0 : new Date(request.reviewedAt).getTime();
}

function toStatusTone(
  request: LeaveRequestItem,
  activeRequest: LeaveRequestItem | null,
) {
  if (activeRequest !== null) {
    return "pending" as const;
  }

  if (request.status === "approved") {
    return "approved" as const;
  }

  if (
    request.status === "rejected" ||
    request.status === "revision_requested"
  ) {
    return "attention" as const;
  }

  return "neutral" as const;
}

function buildCorrectionHeadline(request: LeaveRequestItem) {
  if (request.status === "revision_requested") {
    return "보완이 필요해요";
  }

  if (request.status === "rejected") {
    return "조정이 필요해요";
  }

  return null;
}

function buildLatestActivityLabel(
  latestRequest: LeaveRequestItem,
  activeRequest: LeaveRequestItem | null,
) {
  if (activeRequest !== null) {
    if (activeRequest.followUpKind === "change") {
      return "변경 요청을 검토 중이에요";
    }

    if (activeRequest.followUpKind === "cancel") {
      return "취소 요청을 검토 중이에요";
    }

    if (activeRequest.followUpKind === "resubmission") {
      return "다시 제출한 요청을 검토 중이에요";
    }

    return "휴가 요청을 검토 중이에요";
  }

  if (latestRequest.status === "approved") {
    return "승인된 계획이에요";
  }

  if (latestRequest.status === "withdrawn") {
    return "검토 전에 철회한 기록이에요";
  }

  if (latestRequest.status === "revision_requested") {
    return "사유를 확인하고 다시 제출할 수 있어요";
  }

  if (latestRequest.status === "rejected") {
    return "검토 결과를 확인하고 다시 제출할 수 있어요";
  }

  return "현재 상태를 확인할 수 있어요";
}

function buildCurrentSummary(
  effectiveRequest: LeaveRequestItem,
  activeRequest: LeaveRequestItem | null,
) {
  if (activeRequest === null) {
    return formatLeaveRequestSummary(effectiveRequest);
  }

  if (
    activeRequest.followUpKind === "change" ||
    activeRequest.followUpKind === "cancel"
  ) {
    return `${formatLeaveRequestSummary(effectiveRequest)} 기준으로 ${activeRequest.followUpKind === "change" ? "변경" : "취소"} 요청을 검토 중이에요`;
  }

  return formatLeaveRequestSummary(activeRequest);
}

function buildSelectedDateSummary(
  effectiveRequest: LeaveRequestItem,
  activeRequest: LeaveRequestItem | null,
) {
  if (activeRequest === null) {
    return formatLeaveStatusDescription(effectiveRequest.status);
  }

  if (activeRequest.followUpKind === "change") {
    return "현재 승인된 휴가를 유지한 채 변경 요청을 함께 보고 있어요";
  }

  if (activeRequest.followUpKind === "cancel") {
    return "현재 승인된 휴가를 유지한 채 취소 요청을 함께 보고 있어요";
  }

  if (activeRequest.followUpKind === "resubmission") {
    return "이전 검토 결과를 반영해 다시 제출한 요청이에요";
  }

  return "검토가 끝나면 이 요청이 현재 계획으로 반영돼요";
}

function buildPrimaryAction(
  effectiveRequest: LeaveRequestItem,
  activeRequest: LeaveRequestItem | null,
): LeaveChainAction | null {
  if (activeRequest !== null) {
    return {
      kind: "edit",
      label: "수정하기",
      requestId: activeRequest.id,
    };
  }

  if (effectiveRequest.status === "approved") {
    return {
      kind: "change",
      label: "변경하기",
      requestId: effectiveRequest.id,
    };
  }

  if (
    effectiveRequest.status === "rejected" ||
    effectiveRequest.status === "revision_requested"
  ) {
    return {
      kind: "resubmit",
      label: "다시 제출",
      requestId: effectiveRequest.id,
    };
  }

  return null;
}

function buildSecondaryAction(
  effectiveRequest: LeaveRequestItem,
  activeRequest: LeaveRequestItem | null,
): LeaveChainAction | null {
  if (activeRequest !== null) {
    return {
      kind: "withdraw",
      label: "철회하기",
      requestId: activeRequest.id,
    };
  }

  if (effectiveRequest.status === "approved") {
    return {
      kind: "cancel",
      label: "취소 요청",
      requestId: effectiveRequest.id,
    };
  }

  return null;
}

function toChainModel(requests: readonly LeaveRequestItem[]): LeaveChainModel {
  const orderedRequests = [...requests].sort(
    (left, right) => getRequestTimestamp(left) - getRequestTimestamp(right),
  );
  const latestRequest = orderedRequests.at(-1) ?? requests[0];

  if (latestRequest === undefined) {
    throw new Error("Leave chain cannot be empty");
  }

  const activeRequest =
    orderedRequests.find(
      (request) => request.id === latestRequest.activeRequestId,
    ) ?? null;
  const effectiveRequest =
    orderedRequests.find(
      (request) => request.id === latestRequest.effectiveRequestId,
    ) ?? latestRequest;
  const topCorrectionEligible =
    activeRequest === null &&
    (latestRequest.status === "rejected" ||
      latestRequest.status === "revision_requested") &&
    !latestRequest.isTopSurfaceSuppressed;
  const reviewComment =
    latestRequest.reviewComment ?? latestRequest.governingReviewComment ?? null;

  return {
    activeRequest,
    correctionHeadline: buildCorrectionHeadline(latestRequest),
    currentSummary: buildCurrentSummary(effectiveRequest, activeRequest),
    effectiveRequest,
    latestActivityAt:
      latestRequest.reviewedAt ?? latestRequest.requestedAt,
    latestActivityLabel: buildLatestActivityLabel(latestRequest, activeRequest),
    latestRequest,
    primaryAction: buildPrimaryAction(effectiveRequest, activeRequest),
    reasonSummary:
      activeRequest?.reason ??
      latestRequest.reason ??
      effectiveRequest.reason,
    requests: orderedRequests,
    reviewComment,
    rootRequestId: latestRequest.rootRequestId,
    secondaryAction: buildSecondaryAction(effectiveRequest, activeRequest),
    selectedDateSummary: buildSelectedDateSummary(
      effectiveRequest,
      activeRequest,
    ),
    statusDescription: buildLatestActivityLabel(latestRequest, activeRequest),
    statusLabel:
      activeRequest !== null
        ? formatLeaveStatusLabel(activeRequest.status)
        : formatLeaveStatusLabel(effectiveRequest.status),
    statusTone: toStatusTone(effectiveRequest, activeRequest),
    topCorrectionEligible,
  };
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

export function buildLeavePageViewModel(data: LeavePageData): LeavePageViewModel {
  const requestsByRootId = new Map<string, LeaveRequestItem[]>();

  for (const request of data.overview.requests) {
    const chain = requestsByRootId.get(request.rootRequestId) ?? [];
    chain.push(request);
    requestsByRootId.set(request.rootRequestId, chain);
  }

  const visibleChains = Array.from(requestsByRootId.values())
    .map((requests) => toChainModel(requests))
    .sort(
      (left, right) =>
        new Date(right.latestActivityAt).getTime() -
        new Date(left.latestActivityAt).getTime(),
    );
  const selectedDateChains = visibleChains.filter((chain) =>
    chain.requests.some((request) => request.date === data.selectedDate),
  );
  const correctionCandidates = visibleChains
    .filter((chain) => chain.topCorrectionEligible)
    .sort(
      (left, right) =>
        getReviewTimestamp(right.latestRequest) - getReviewTimestamp(left.latestRequest),
    );
  const monthKey = getMonthKey(data.selectedDate);
  const monthPlannedCount = visibleChains.filter((chain) =>
    chain.requests.some((request) => getMonthKey(request.date) === monthKey),
  ).length;
  const pendingCount = visibleChains.filter(
    (chain) => chain.activeRequest !== null,
  ).length;
  const upcomingApprovedCount = visibleChains.filter(
    (chain) =>
      chain.activeRequest === null && chain.effectiveRequest.status === "approved",
  ).length;

  return {
    attentionCount: correctionCandidates.length,
    correctionCandidates,
    monthPlannedCount,
    pendingCount,
    selectedDateChains,
    totalChains: visibleChains.length,
    upcomingApprovedCount,
    visibleChains,
  };
}

function toBaseDraft(input: {
  date: string;
  leaveType: LeaveType;
  mode: LeaveComposerMode;
  reason: string;
  requestId?: string | null;
  parentRequestId?: string | null;
  followUpKind?: LeaveRequestItem["followUpKind"];
  startTime?: string;
  endTime?: string;
}): LeaveComposerDraft {
  return {
    date: input.date,
    endTime: input.endTime ?? "",
    followUpKind: input.followUpKind ?? null,
    leaveType: input.leaveType,
    mode: input.mode,
    parentRequestId: input.parentRequestId ?? null,
    reason: input.reason,
    requestId: input.requestId ?? null,
    startTime: input.startTime ?? "",
  };
}

export function createNewComposerDraft(selectedDate: string): LeaveComposerDraft {
  return toBaseDraft({
    date: selectedDate,
    leaveType: "annual",
    mode: "new",
    reason: "",
  });
}

export function createEditComposerDraft(
  request: LeaveRequestItem,
  input: {
    startTime: string;
    endTime: string;
  },
): LeaveComposerDraft {
  return toBaseDraft({
    date: request.date,
    endTime: input.endTime,
    leaveType: request.leaveType,
    mode: "edit",
    reason: request.reason,
    requestId: request.id,
    startTime: input.startTime,
  });
}

export function createResubmitComposerDraft(
  request: LeaveRequestItem,
  input: {
    startTime: string;
    endTime: string;
  },
): LeaveComposerDraft {
  return toBaseDraft({
    date: request.date,
    endTime: input.endTime,
    followUpKind: "resubmission",
    leaveType: request.leaveType,
    mode: "resubmit",
    parentRequestId: request.id,
    reason: request.reason,
    startTime: input.startTime,
  });
}

export function createChangeComposerDraft(
  request: LeaveRequestItem,
  input: {
    startTime: string;
    endTime: string;
  },
): LeaveComposerDraft {
  return toBaseDraft({
    date: request.date,
    endTime: input.endTime,
    followUpKind: "change",
    leaveType: request.leaveType,
    mode: "change",
    parentRequestId: request.id,
    reason: request.reason,
    startTime: input.startTime,
  });
}

export function createCancelComposerDraft(
  request: LeaveRequestItem,
  input: {
    startTime: string;
    endTime: string;
  },
): LeaveComposerDraft {
  return toBaseDraft({
    date: request.date,
    endTime: input.endTime,
    followUpKind: "cancel",
    leaveType: request.leaveType,
    mode: "cancel",
    parentRequestId: request.id,
    reason: "",
    startTime: input.startTime,
  });
}

export function findChainByAction(
  chains: readonly LeaveChainModel[],
  action: LeaveChainAction,
) {
  return (
    chains.find(
      (chain) =>
        chain.primaryAction?.requestId === action.requestId ||
        chain.secondaryAction?.requestId === action.requestId,
    ) ?? null
  );
}

export function formatChainMenuLabel(chain: LeaveChainModel) {
  return `${formatLeaveTypeLabel(chain.latestRequest.leaveType)} · ${formatLeaveRequestSummary(chain.latestRequest)}`;
}
