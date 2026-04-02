import type {
  AttendanceAttempt,
  AttendanceDisplay,
  AttendanceExceptionType,
  AttendanceFlag,
  AttendancePhase,
  AttendanceRecord,
  ExpectedWorkday,
  PreviousDayOpenRecord,
} from "@/lib/contracts/shared";

type DeriveAttendanceDisplayInput = {
  now: string;
  expectedWorkday: ExpectedWorkday;
  record: AttendanceRecord | null;
  attempts: AttendanceAttempt[];
  previousDayOpenRecord: PreviousDayOpenRecord | null;
};

type DeriveAdminAttendanceSummaryItem = {
  expectedWorkday: ExpectedWorkday;
  todayRecord: AttendanceRecord | null;
  display: AttendanceDisplay;
};

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function getOffset(isoDateTime: string): string {
  return isoDateTime.endsWith("Z") ? "Z" : isoDateTime.slice(-6);
}

function buildDateTime(
  date: string,
  time: string,
  referenceDateTime: string,
): string {
  return `${date}T${time}${getOffset(referenceDateTime)}`;
}

function getRequestedDate(
  now: string,
  expectedWorkday: ExpectedWorkday,
  record: AttendanceRecord | null,
): string {
  return (
    record?.date ??
    expectedWorkday.adjustedClockInAt?.slice(0, 10) ??
    expectedWorkday.expectedClockInAt?.slice(0, 10) ??
    expectedWorkday.adjustedClockOutAt?.slice(0, 10) ??
    expectedWorkday.expectedClockOutAt?.slice(0, 10) ??
    now.slice(0, 10)
  );
}

function hasLaterSuccessfulAttempt(
  failedAttempt: AttendanceAttempt,
  attempts: AttendanceAttempt[],
): boolean {
  const failedAttemptedAt = toDate(failedAttempt.attemptedAt);

  return attempts.some((attempt) => {
    if (attempt.status !== "success") {
      return false;
    }

    const attemptedAt = toDate(attempt.attemptedAt);

    return (
      attemptedAt !== null &&
      failedAttemptedAt !== null &&
      attemptedAt.getTime() > failedAttemptedAt.getTime()
    );
  });
}

function derivePhase(
  expectedWorkday: ExpectedWorkday,
  record: AttendanceRecord | null,
): AttendancePhase {
  if (record?.clockOutAt) {
    return "checked_out";
  }

  if (record?.clockInAt) {
    return "working";
  }

  if (!expectedWorkday.isWorkday) {
    return "non_workday";
  }

  return "before_check_in";
}

function deriveFlags(
  expectedWorkday: ExpectedWorkday,
  record: AttendanceRecord | null,
): AttendanceFlag[] {
  const flags: AttendanceFlag[] = [];
  const adjustedClockInAt = toDate(expectedWorkday.adjustedClockInAt);
  const adjustedClockOutAt = toDate(expectedWorkday.adjustedClockOutAt);
  const clockInAt = toDate(record?.clockInAt ?? null);
  const clockOutAt = toDate(record?.clockOutAt ?? null);

  if (
    clockInAt !== null &&
    adjustedClockInAt !== null &&
    clockInAt.getTime() > adjustedClockInAt.getTime()
  ) {
    flags.push("late");
  }

  if (
    clockOutAt !== null &&
    adjustedClockOutAt !== null &&
    clockOutAt.getTime() < adjustedClockOutAt.getTime()
  ) {
    flags.push("early_leave");
  }

  return flags;
}

function deriveActiveExceptions({
  now,
  expectedWorkday,
  record,
  attempts,
  previousDayOpenRecord,
  phase,
}: DeriveAttendanceDisplayInput & {
  phase: AttendancePhase;
}): AttendanceExceptionType[] {
  const activeExceptions: AttendanceExceptionType[] = [];
  const requestedDate = getRequestedDate(now, expectedWorkday, record);
  const sameDayAttempts = attempts.filter(
    (attempt) => attempt.date === requestedDate,
  );
  const currentDate = now.slice(0, 10);
  const carryOverCutoff = toDate(buildDateTime(currentDate, "09:00:00", now));
  const currentTime = toDate(now);
  const adjustedClockInAt = toDate(expectedWorkday.adjustedClockInAt);
  const adjustedClockOutAt = toDate(expectedWorkday.adjustedClockOutAt);

  if (
    previousDayOpenRecord !== null &&
    currentTime !== null &&
    carryOverCutoff !== null &&
    currentTime.getTime() >= carryOverCutoff.getTime()
  ) {
    activeExceptions.push("previous_day_checkout_missing");
  }

  const latestOperationalFailure = sameDayAttempts.findLast(
    (attempt) =>
      attempt.status === "failed" &&
      !hasLaterSuccessfulAttempt(attempt, sameDayAttempts),
  );

  if (latestOperationalFailure) {
    activeExceptions.push("attempt_failed");
  }

  if (
    expectedWorkday.leaveCoverage !== null &&
    (record?.clockInAt !== null || record?.clockOutAt !== null)
  ) {
    activeExceptions.push("leave_work_conflict");
  }

  if (phase === "before_check_in" && expectedWorkday.isWorkday) {
    if (
      currentTime !== null &&
      adjustedClockOutAt !== null &&
      currentTime.getTime() > adjustedClockOutAt.getTime()
    ) {
      activeExceptions.push("absent");
    } else if (
      currentTime !== null &&
      adjustedClockInAt !== null &&
      currentTime.getTime() >= adjustedClockInAt.getTime()
    ) {
      activeExceptions.push("not_checked_in");
    }
  }

  return activeExceptions;
}

function deriveNextAction(
  phase: AttendancePhase,
  activeExceptions: AttendanceExceptionType[],
): AttendanceDisplay["nextAction"] {
  if (activeExceptions.includes("previous_day_checkout_missing")) {
    return {
      type: "resolve_previous_day_checkout",
      relatedRequestId: null,
    };
  }

  if (
    activeExceptions.includes("manual_request_pending") ||
    activeExceptions.includes("manual_request_rejected")
  ) {
    return {
      type: "review_request_status",
      relatedRequestId: null,
    };
  }

  if (activeExceptions.includes("leave_work_conflict")) {
    return {
      type: "review_leave_conflict",
      relatedRequestId: null,
    };
  }

  if (phase === "working") {
    return {
      type: "clock_out",
      relatedRequestId: null,
    };
  }

  if (phase === "before_check_in") {
    return {
      type: "clock_in",
      relatedRequestId: null,
    };
  }

  return {
    type: "wait",
    relatedRequestId: null,
  };
}

export function deriveAttendanceDisplay(
  input: DeriveAttendanceDisplayInput,
): AttendanceDisplay {
  const phase = derivePhase(input.expectedWorkday, input.record);
  const flags = deriveFlags(input.expectedWorkday, input.record);
  const activeExceptions = deriveActiveExceptions({
    ...input,
    phase,
  });

  return {
    phase,
    flags,
    activeExceptions,
    nextAction: deriveNextAction(phase, activeExceptions),
  };
}

export function deriveAdminAttendanceSummary(
  items: DeriveAdminAttendanceSummaryItem[],
) {
  return items.reduce(
    (summary, item) => {
      if (item.todayRecord?.clockInAt) {
        summary.checkedInCount += 1;
      }

      if (item.display.activeExceptions.includes("not_checked_in")) {
        summary.notCheckedInCount += 1;
      }

      if (item.display.flags.includes("late")) {
        summary.lateCount += 1;
      }

      if (item.expectedWorkday.leaveCoverage !== null) {
        summary.onLeaveCount += 1;
      }

      if (item.display.activeExceptions.includes("attempt_failed")) {
        summary.failedAttemptCount += 1;
      }

      if (
        item.display.activeExceptions.includes("previous_day_checkout_missing")
      ) {
        summary.previousDayOpenCount += 1;
      }

      return summary;
    },
    {
      checkedInCount: 0,
      notCheckedInCount: 0,
      lateCount: 0,
      onLeaveCount: 0,
      failedAttemptCount: 0,
      previousDayOpenCount: 0,
    },
  );
}
