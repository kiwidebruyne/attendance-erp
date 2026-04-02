import type { AdminRequestsResponse } from "@/lib/contracts/requests";
import type { RequestStatus } from "@/lib/contracts/shared";

export type AdminRequestsView = AdminRequestsResponse["viewFilter"];
export type AdminRequestItem = AdminRequestsResponse["items"][number];
export type ManualAdminRequestItem = Extract<
  AdminRequestItem,
  { requestType: "manual_attendance" }
>;
export type LeaveAdminRequestItem = Extract<
  AdminRequestItem,
  { requestType: "leave" }
>;

export type AdminRequestChipTone =
  | "default"
  | "outline"
  | "info"
  | "success"
  | "warning"
  | "danger";

export type AdminRequestChip = {
  label: string;
  tone: AdminRequestChipTone;
};

export type AdminRequestsSummaryMetric = {
  label: string;
  value: string;
  tone?: "default" | "info" | "success" | "warning" | "danger";
};

export type AdminRequestsSummaryModel = {
  eyebrow: string;
  title: string;
  description: string;
  accentLabel: string;
  accentValue: string;
  accentCaption: string;
  metrics: AdminRequestsSummaryMetric[];
};

export type AdminRequestQueueSection = {
  group: "actionable" | "history";
  groupLabel: string | null;
  key: string;
  title: string;
  description: string;
  items: AdminRequestItem[];
};

export type AdminRequestRowPresentation = {
  chips: AdminRequestChip[];
  employeeDepartment: string;
  employeeName: string;
  isSelected: boolean;
  reason: string;
  stateCue: string;
  subtypeLabel: string;
  targetDateLabel: string;
  typeLabel: string;
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Seoul",
  weekday: "short",
});

const shortDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Seoul",
});

const numberFormatter = new Intl.NumberFormat("ko-KR");

function formatDateValue(value: string, formatter: Intl.DateTimeFormat) {
  return formatter.format(new Date(`${value}T00:00:00+09:00`));
}

function formatDateTimeValue(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatCount(value: number) {
  return `${numberFormatter.format(value)}건`;
}

function getManualSubtypeLabel(subtype: "clock_in" | "clock_out" | "both") {
  switch (subtype) {
    case "clock_in":
      return "출근 정정";
    case "clock_out":
      return "퇴근 정정";
    case "both":
      return "출근·퇴근 정정";
  }
}

function getLeaveSubtypeLabel(
  subtype: "annual" | "half_am" | "half_pm" | "hourly",
) {
  switch (subtype) {
    case "annual":
      return "연차";
    case "half_am":
      return "반차(오전)";
    case "half_pm":
      return "반차(오후)";
    case "hourly":
      return "시간차";
  }
}

function getViewLabel(view: AdminRequestsView) {
  switch (view) {
    case "needs_review":
      return "검토 필요";
    case "completed":
      return "완료된 검토 기록";
    case "all":
      return "전체 요청";
  }
}

function getSummaryDescription(view: AdminRequestsView) {
  switch (view) {
    case "needs_review":
      return "현재 바로 판단해야 할 요청과 그 맥락을 먼저 확인해요.";
    case "completed":
      return "승인, 철회, 반려, 보완 요청이 끝난 기록을 구분해서 살펴봐요.";
    case "all":
      return "검토가 필요한 요청과 완료된 이력을 같은 큐에서 이어서 볼 수 있어요.";
  }
}

function getSummaryAccentCaption(view: AdminRequestsView) {
  switch (view) {
    case "needs_review":
      return "지금 검토가 필요한 요청";
    case "completed":
      return "완료된 검토 흐름";
    case "all":
      return "전체 요청 합계";
  }
}

export function formatRequestTypeLabel(item: AdminRequestItem) {
  return item.requestType === "manual_attendance" ? "정정 요청" : "휴가 신청";
}

export function isManualRequestItem(
  item: AdminRequestItem,
): item is ManualAdminRequestItem {
  return item.requestType === "manual_attendance";
}

export function isLeaveRequestItem(
  item: AdminRequestItem,
): item is LeaveAdminRequestItem {
  return item.requestType === "leave";
}

export function formatRequestSubtypeLabel(item: AdminRequestItem) {
  if (item.requestType === "manual_attendance") {
    return getManualSubtypeLabel(item.subtype);
  }

  return getLeaveSubtypeLabel(item.subtype);
}

export function formatStatusLabel(status: RequestStatus) {
  switch (status) {
    case "pending":
      return "검토 필요";
    case "approved":
      return "승인 완료";
    case "withdrawn":
      return "철회 완료";
    case "revision_requested":
      return "보완 요청";
    case "rejected":
      return "반려";
  }
}

export function formatStateCue(
  item: AdminRequestItem,
  view: AdminRequestsView,
) {
  if (item.status === "pending") {
    if (
      item.activeStatus !== null &&
      item.activeStatus !== item.effectiveStatus
    ) {
      return "검토 중 · 원안 유지";
    }

    return view === "needs_review" ? "검토 필요" : "대기 중";
  }

  if (item.status === "approved") {
    return "승인 완료";
  }

  if (item.status === "withdrawn") {
    return "철회 완료";
  }

  if (item.status === "revision_requested") {
    return "보완 요청";
  }

  return "반려";
}

export function formatDateLabel(value: string) {
  return formatDateValue(value, dateFormatter);
}

export function formatDateShortLabel(value: string) {
  return formatDateValue(value, shortDateFormatter);
}

export function formatDateTimeLabel(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return formatDateTimeValue(value);
}

export function formatRequestTimestamp(value: string) {
  return `${formatDateValue(value.slice(0, 10), shortDateFormatter)} ${formatDateTimeValue(value)}`;
}

export function formatFollowUpKindLabel(item: AdminRequestItem) {
  switch (item.followUpKind) {
    case "resubmission":
      return "재제출";
    case "change":
      return "변경 요청";
    case "cancel":
      return "취소 요청";
    default:
      return null;
  }
}

export function buildChainContextLabel(item: AdminRequestItem) {
  if (item.followUpKind === "resubmission") {
    return "이전 검토 뒤 다시 제출된 요청이에요";
  }

  if (item.followUpKind === "change") {
    return "기존 승인 상태를 유지한 채 변경 요청을 검토하고 있어요";
  }

  if (item.followUpKind === "cancel") {
    return "기존 승인 상태를 유지한 채 취소 요청을 검토하고 있어요";
  }

  if (item.status === "pending") {
    return "현재 이 요청이 검토 대상이에요";
  }

  return "같은 요청 흐름에서 검토가 끝난 기록이에요";
}

export function buildLeaveConflictLines(item: AdminRequestItem) {
  if (item.requestType !== "leave" || item.leaveConflict === undefined) {
    return [];
  }

  const lines: string[] = [];

  if (item.leaveConflict.companyEventContext.length > 0) {
    lines.push(
      `회사 일정 ${item.leaveConflict.companyEventContext
        .map((event) => event.title)
        .join(", ")}을 함께 보고 판단해요`,
    );
  }

  if (item.leaveConflict.effectiveApprovedLeaveContext.length > 0) {
    lines.push(
      `현재 승인 상태로 반영 중인 휴가 맥락 ${item.leaveConflict.effectiveApprovedLeaveContext.length}건이 있어요`,
    );
  }

  if (item.leaveConflict.pendingLeaveContext.length > 0) {
    lines.push(
      `같은 날짜에 함께 검토 중인 휴가 요청 ${item.leaveConflict.pendingLeaveContext.length}건이 있어요`,
    );
  }

  if (item.leaveConflict.staffingRisk === "warning") {
    lines.push("인력 여유를 다시 확인한 뒤 승인해야 해요");
  }

  return lines;
}

export function hasLeaveOperationalWarning(item: LeaveAdminRequestItem) {
  return buildLeaveConflictLines(item).length > 0;
}

export function formatLeaveOperationalWarningLabel(
  item: LeaveAdminRequestItem,
) {
  return hasLeaveOperationalWarning(item) ? "경고 있음" : "경고 없음";
}

export function getCompletedFooting(item: AdminRequestItem) {
  switch (item.status) {
    case "approved":
      return "승인 후 현재 반영 상태를 유지하고 있어요";
    case "withdrawn":
      return "직원이 검토 전에 요청을 철회해 같은 기록에서 더 볼 액션은 없어요";
    case "revision_requested":
      return "보완 요청 사유를 남겼어요. 이 요청은 검토 완료 이력으로 남아요";
    case "rejected":
      return "반려 사유를 확인할 수 있어요. 이 요청은 검토 완료 이력이에요";
    default:
      return "현재 요청 상태를 확인할 수 있어요";
  }
}

function getRequestRowChips(item: AdminRequestItem): AdminRequestChip[] {
  const chips: AdminRequestChip[] = [];
  const hasMismatch =
    item.activeStatus !== null && item.activeStatus !== item.effectiveStatus;

  if (hasMismatch) {
    chips.push({
      label: "진행 상태가 원안과 달라요",
      tone: "info",
    });
  }

  if (item.requestType === "manual_attendance") {
    if (item.governingReviewComment !== null) {
      chips.push({
        label: "이전 사유가 아직 남아 있어요",
        tone: "warning",
      });
    } else if (chips.length < 2) {
      chips.push({
        label: getManualSubtypeLabel(item.subtype),
        tone: "outline",
      });
    }

    if (chips.length < 2 && item.followUpKind === "resubmission") {
      chips.push({
        label: "재제출",
        tone: "info",
      });
    }

    return chips.slice(0, 2);
  }

  if (item.leaveConflict?.staffingRisk === "warning" && chips.length < 2) {
    chips.push({
      label: "인력 여유 경고",
      tone: "warning",
    });
  }

  if (
    (item.leaveConflict?.companyEventContext?.length ?? 0) > 0 &&
    chips.length < 2
  ) {
    chips.push({
      label: "회사 일정 영향",
      tone: "info",
    });
  }

  if (
    (item.leaveConflict?.pendingLeaveContext?.length ?? 0) > 0 &&
    chips.length < 2
  ) {
    chips.push({
      label: "같은 날짜 대기 요청",
      tone: "outline",
    });
  }

  if (chips.length < 2) {
    chips.push({
      label: getLeaveSubtypeLabel(item.subtype),
      tone: "outline",
    });
  }

  return chips.slice(0, 2);
}

export function buildAdminRequestsSummaryModel({
  items,
  selectedRequestId,
  view,
}: {
  items: AdminRequestItem[];
  selectedRequestId: string | null;
  view: AdminRequestsView;
}): AdminRequestsSummaryModel {
  const actionableCount = items.filter(
    (item) => item.status === "pending",
  ).length;
  const completedCount = items.length - actionableCount;
  const reviewedCount = items.filter(
    (item) =>
      item.status === "rejected" || item.status === "revision_requested",
  ).length;
  const selectedCount =
    selectedRequestId === null
      ? 0
      : items.some((item) => item.id === selectedRequestId)
        ? 1
        : 0;

  return {
    eyebrow: "관리자 요청 큐",
    title: "검토 흐름을 한 화면에서 정리해요.",
    description: getSummaryDescription(view),
    accentLabel: getViewLabel(view),
    accentValue: formatCount(items.length),
    accentCaption: getSummaryAccentCaption(view),
    metrics: [
      {
        label: "검토 필요",
        value: formatCount(actionableCount),
        tone: "warning",
      },
      {
        label: "완료 이력",
        value: formatCount(completedCount),
        tone: "success",
      },
      {
        label: "반려·보완",
        value: formatCount(reviewedCount),
        tone: "info",
      },
      {
        label: "선택 항목",
        value: formatCount(selectedCount),
      },
    ],
  };
}

export function buildAdminRequestQueueSections({
  items,
  view,
}: {
  items: AdminRequestItem[];
  view: AdminRequestsView;
}): AdminRequestQueueSection[] {
  const actionableItems = items.filter((item) => item.status === "pending");
  const approvedOrWithdrawnItems = items.filter(
    (item) => item.status === "approved" || item.status === "withdrawn",
  );
  const reviewedItems = items.filter(
    (item) =>
      item.status === "rejected" || item.status === "revision_requested",
  );

  const sections: AdminRequestQueueSection[] = [];

  if (view === "needs_review") {
    sections.push({
      group: "actionable",
      groupLabel: "검토 필요",
      key: "needs_review",
      title: "현재 검토할 요청",
      description: "검토가 끝나지 않은 요청을 먼저 열어봐요.",
      items: actionableItems,
    });
    return sections;
  }

  if (view === "all") {
    sections.push({
      group: "actionable",
      groupLabel: "검토 필요",
      key: "all-actionable",
      title: "현재 검토할 요청",
      description: "지금 관리자가 바로 판단해야 하는 요청이에요.",
      items: actionableItems,
    });
  }

  sections.push({
    group: "history",
    groupLabel: view === "all" ? "완료된 검토 기록" : "완료된 검토 기록",
    key: "approved-withdrawn",
    title: "승인/철회 완료",
    description: "검토가 끝났고 승인되거나 철회된 흐름이에요.",
    items: approvedOrWithdrawnItems,
  });

  sections.push({
    group: "history",
    groupLabel: null,
    key: "reviewed-history",
    title: "반려·보완 요청 기록",
    description: "같은 요청 기록에서 완료된 반려나 보완 요청이에요.",
    items: reviewedItems,
  });

  return sections;
}

export function buildAdminRequestRowPresentation(
  item: AdminRequestItem,
  selectedRequestId: string | null,
  view: AdminRequestsView,
): AdminRequestRowPresentation {
  return {
    chips: getRequestRowChips(item),
    employeeDepartment: item.employee.department,
    employeeName: item.employee.name,
    isSelected: selectedRequestId === item.id,
    reason: item.reason,
    stateCue: formatStateCue(item, view),
    subtypeLabel: formatRequestSubtypeLabel(item),
    targetDateLabel: formatDateValue(item.targetDate, dateFormatter),
    typeLabel: formatRequestTypeLabel(item),
  };
}

export function getAdminRequestGroupDescription(view: AdminRequestsView) {
  switch (view) {
    case "needs_review":
      return "지금 바로 열어야 할 요청만 보여요.";
    case "completed":
      return "완료된 검토 흐름을 승인/철회와 반려·보완으로 나눠요.";
    case "all":
      return "검토가 필요한 요청과 완료된 이력을 같은 화면에서 봐요.";
  }
}
