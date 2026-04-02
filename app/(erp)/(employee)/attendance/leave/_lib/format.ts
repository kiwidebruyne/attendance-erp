import type {
  LeaveConflict,
  LeaveType,
  RequestStatus,
} from "@/lib/contracts/shared";

const shortDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

const shortDateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

export function formatLeaveDayCount(value: number) {
  return `${formatNumber(value)}일`;
}

export function formatLeaveDateLabel(date: string) {
  return shortDateFormatter.format(new Date(`${date}T00:00:00+09:00`));
}

export function formatLeaveDateTimeLabel(value: string | null) {
  if (value === null) {
    return "-";
  }

  return shortDateTimeFormatter.format(new Date(value));
}

export function formatLeaveTimeLabel(value: string | null) {
  if (value === null) {
    return "-";
  }

  return timeFormatter.format(new Date(value));
}

export function formatLeaveTypeLabel(leaveType: LeaveType) {
  switch (leaveType) {
    case "annual":
      return "연차";
    case "half_am":
      return "오전 반차";
    case "half_pm":
      return "오후 반차";
    case "hourly":
      return "시간차";
  }
}

export function formatLeaveStatusLabel(status: RequestStatus) {
  switch (status) {
    case "pending":
      return "검토 중";
    case "revision_requested":
      return "보완 요청";
    case "withdrawn":
      return "철회됨";
    case "approved":
      return "승인됨";
    case "rejected":
      return "반려";
  }
}

export function formatLeaveStatusDescription(status: RequestStatus) {
  switch (status) {
    case "pending":
      return "관리자 검토를 기다리고 있어요";
    case "revision_requested":
      return "사유를 확인하고 수정해서 다시 제출할 수 있어요";
    case "withdrawn":
      return "직원이 검토 전에 요청을 철회했어요";
    case "approved":
      return "현재 승인된 휴가 계획이에요";
    case "rejected":
      return "검토 결과를 확인하고 다시 제출할 수 있어요";
  }
}

export function formatLeaveRequestSummary(input: {
  date: string;
  leaveType: LeaveType;
  startAt: string | null;
  endAt: string | null;
}) {
  const dateLabel = formatLeaveDateLabel(input.date);
  const leaveTypeLabel = formatLeaveTypeLabel(input.leaveType);

  if (input.leaveType !== "hourly") {
    return `${dateLabel} · ${leaveTypeLabel}`;
  }

  return `${dateLabel} · ${leaveTypeLabel} ${formatLeaveTimeLabel(input.startAt)} ~ ${formatLeaveTimeLabel(input.endAt)}`;
}

export function formatHourlyDurationHours(hours: number | null) {
  if (hours === null) {
    return "-";
  }

  return `${formatNumber(hours)}시간`;
}

export function buildDateTimeFromDateAndTime(date: string, time: string) {
  if (time.length === 0) {
    return null;
  }

  return `${date}T${time}:00+09:00`;
}

export function formatTimeInputValue(value: string | null) {
  if (value === null) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));

  const valueByType = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${valueByType.hour ?? "00"}:${valueByType.minute ?? "00"}`;
}

export function getLeaveConflictMessages(leaveConflict: LeaveConflict) {
  const messages: string[] = [];

  if (leaveConflict.companyEventContext.length > 0) {
    messages.push("운영 일정이 있는 날이라 더 신중한 검토가 필요해요");
  }

  if (leaveConflict.requiresApprovalConfirmation) {
    messages.push("인력 여유가 많지 않아 승인 전에 한 번 더 확인할 수 있어요");
  }

  if (
    leaveConflict.pendingLeaveContext.length > 0 &&
    leaveConflict.companyEventContext.length === 0
  ) {
    messages.push("같은 날짜에 함께 검토 중인 휴가가 있어요");
  }

  return messages;
}

export function hasMeaningfulLeaveConflict(leaveConflict: LeaveConflict | null) {
  if (leaveConflict === null) {
    return false;
  }

  return (
    leaveConflict.companyEventContext.length > 0 ||
    leaveConflict.effectiveApprovedLeaveContext.length > 0 ||
    leaveConflict.pendingLeaveContext.length > 0 ||
    leaveConflict.requiresApprovalConfirmation
  );
}
