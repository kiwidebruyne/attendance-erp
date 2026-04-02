import type {
  AttendanceDisplay,
  AttendanceExceptionType,
  AttendanceFlag,
  AttendancePhase,
  AttendanceSurfaceManualRequestResource,
  ExpectedWorkday,
} from "@/lib/contracts/shared";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  weekday: "short",
});

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateTimeInputFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatParts(isoDateTime: string) {
  const parts = dateTimeInputFormatter.formatToParts(new Date(isoDateTime));

  const valueByType = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: valueByType.year ?? "0000",
    month: valueByType.month ?? "01",
    day: valueByType.day ?? "01",
    hour: valueByType.hour ?? "00",
    minute: valueByType.minute ?? "00",
  };
}

export function formatAttendanceDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00+09:00`));
}

export function formatAttendanceTime(isoDateTime: string | null) {
  if (isoDateTime === null) {
    return "기록 없음";
  }

  return timeFormatter.format(new Date(isoDateTime));
}

export function formatDateTimeLocalValue(isoDateTime: string | null) {
  if (isoDateTime === null) {
    return "";
  }

  const parts = formatParts(isoDateTime);

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function parseDateTimeLocalValue(value: string) {
  if (value.length === 0) {
    return null;
  }

  return `${value}:00+09:00`;
}

export function formatTimeInputValue(isoDateTime: string | null) {
  if (isoDateTime === null) {
    return "";
  }

  const parts = formatParts(isoDateTime);

  return `${parts.hour}:${parts.minute}`;
}

export function buildDateTimeFromDateAndTime(date: string, time: string) {
  if (time.length === 0) {
    return null;
  }

  return `${date}T${time}:00+09:00`;
}

export function formatWorkWindow(expectedWorkday: ExpectedWorkday) {
  if (
    expectedWorkday.adjustedClockInAt === null ||
    expectedWorkday.adjustedClockOutAt === null
  ) {
    if (
      expectedWorkday.expectedClockInAt === null ||
      expectedWorkday.expectedClockOutAt === null
    ) {
      return "근무 일정 없음";
    }

    return `${formatAttendanceTime(expectedWorkday.expectedClockInAt)} - ${formatAttendanceTime(expectedWorkday.expectedClockOutAt)}`;
  }

  return `${formatAttendanceTime(expectedWorkday.adjustedClockInAt)} - ${formatAttendanceTime(expectedWorkday.adjustedClockOutAt)}`;
}

export function formatWorkMinutes(workMinutes: number | null) {
  if (workMinutes === null) {
    return "계산 전";
  }

  const hours = Math.floor(workMinutes / 60);
  const minutes = workMinutes % 60;

  if (minutes === 0) {
    return `${hours}시간`;
  }

  return `${hours}시간 ${minutes}분`;
}

export function formatAttendancePhase(phase: AttendancePhase) {
  switch (phase) {
    case "non_workday":
      return "비근무일";
    case "before_check_in":
      return "출근 전";
    case "working":
      return "근무 중";
    case "checked_out":
      return "퇴근 완료";
  }
}

export function formatNextAction(display: AttendanceDisplay) {
  switch (display.nextAction.type) {
    case "clock_in":
      return "출근 처리는 기존 출근 동선에서 진행해 주세요.";
    case "clock_out":
      return "퇴근 처리는 기존 퇴근 동선에서 진행해 주세요.";
    case "submit_manual_request":
      return "정정 요청이 필요해요.";
    case "resolve_previous_day_checkout":
      return "전날 퇴근 시간을 먼저 확인해 주세요.";
    case "review_request_status":
      return "제출한 요청 상태를 확인해 주세요.";
    case "review_leave_conflict":
      return "휴가와 근무 기록 충돌을 확인해 주세요.";
    case "wait":
      return "지금은 추가 작업이 없어요.";
  }
}

export function formatAttendanceFlag(flag: AttendanceFlag) {
  switch (flag) {
    case "late":
      return "지각";
    case "early_leave":
      return "조기 퇴근";
  }
}

export function formatAttendanceException(
  exception: AttendanceExceptionType,
  request: AttendanceSurfaceManualRequestResource | null,
) {
  switch (exception) {
    case "attempt_failed":
      return "시도 실패";
    case "not_checked_in":
      return "출근 기록 없음";
    case "absent":
      return "결근 처리 전";
    case "previous_day_checkout_missing":
      return "전날 퇴근 누락";
    case "leave_work_conflict":
      return "휴가 충돌";
    case "manual_request_pending":
      return "정정 요청 검토 중";
    case "manual_request_rejected":
      return request?.status === "revision_requested"
        ? "보완 필요"
        : "조정 필요";
  }
}

export function formatRequestStatus(
  request: AttendanceSurfaceManualRequestResource,
) {
  switch (request.status) {
    case "pending":
      return "검토 중";
    case "revision_requested":
      return "보완 요청";
    case "rejected":
      return "반려";
  }
}
