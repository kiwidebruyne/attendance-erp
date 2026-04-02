import type {
  AttendanceDisplay,
  AttendanceSurfaceManualRequestResource,
} from "@/lib/contracts/shared";

const seoulDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

const seoulTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

function formatDatePart(value: string) {
  return seoulDateFormatter.format(new Date(value));
}

export function formatDateLabel(value: string) {
  return value;
}

export function formatDateTimeLabel(value: string | null) {
  if (value === null) {
    return "기록 없음";
  }

  return `${formatDatePart(value)} ${seoulTimeFormatter.format(new Date(value))}`;
}

export function formatTimeLabel(value: string | null) {
  if (value === null) {
    return "기록 없음";
  }

  return seoulTimeFormatter.format(new Date(value));
}

export function formatMinutesLabel(value: number | null) {
  if (value === null) {
    return "계산 전";
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  if (hours === 0) {
    return `${minutes}분`;
  }

  if (minutes === 0) {
    return `${hours}시간`;
  }

  return `${hours}시간 ${minutes}분`;
}

export function getDisplaySummary(display: AttendanceDisplay) {
  if (display.activeExceptions.includes("not_checked_in")) {
    return "오늘 출근 기록이 아직 없어요.";
  }

  if (display.activeExceptions.includes("leave_work_conflict")) {
    return "휴가 일정과 실제 출결이 같이 보여요.";
  }

  if (display.flags.includes("late")) {
    return "오늘 지각으로 기록됐어요.";
  }

  if (display.phase === "working") {
    return "오늘 근무를 시작했어요.";
  }

  if (display.phase === "checked_out") {
    return "오늘 근무를 마쳤어요.";
  }

  return "오늘 확인이 필요한 근태예요.";
}

export function getHistoryDisplayStatusLabel(display: AttendanceDisplay) {
  if (display.activeExceptions.includes("previous_day_checkout_missing")) {
    return "전날 미퇴근";
  }

  if (display.activeExceptions.includes("attempt_failed")) {
    return "시도 실패";
  }

  if (display.activeExceptions.includes("manual_request_pending")) {
    return "정정 요청 검토 중";
  }

  if (display.activeExceptions.includes("manual_request_rejected")) {
    return "정정 요청 반려";
  }

  if (display.activeExceptions.includes("absent")) {
    return "결근";
  }

  if (display.activeExceptions.includes("leave_work_conflict")) {
    return "휴가·출결 충돌";
  }

  if (display.activeExceptions.includes("not_checked_in")) {
    return "출근 기록 없음";
  }

  if (display.flags.includes("late") && display.flags.includes("early_leave")) {
    return "지각 · 조퇴";
  }

  if (display.flags.includes("late")) {
    return "지각";
  }

  if (display.flags.includes("early_leave")) {
    return "조퇴";
  }

  if (display.phase === "checked_out") {
    return "근무 완료";
  }

  if (display.phase === "working") {
    return "근무 중";
  }

  if (display.phase === "non_workday") {
    return "비근무일";
  }

  return "출근 전";
}

export function getManualRequestStatusLabel(
  manualRequest: AttendanceSurfaceManualRequestResource,
) {
  if (manualRequest.status === "pending") {
    return "정정 요청을 검토 중이에요.";
  }

  if (manualRequest.status === "revision_requested") {
    return "보완이 필요한 정정 요청이에요.";
  }

  return "반려된 정정 요청 이력이 있어요.";
}

export function getManualRequestActionLabel(
  action: AttendanceSurfaceManualRequestResource["action"],
) {
  if (action === "clock_in") {
    return "출근 정정";
  }

  if (action === "clock_out") {
    return "퇴근 정정";
  }

  return "출근·퇴근 정정";
}
