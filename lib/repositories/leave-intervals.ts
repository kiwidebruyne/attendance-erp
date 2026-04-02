import type { ExpectedWorkday, LeaveType } from "@/lib/contracts/shared";
import { buildFixedSeoulDateTime } from "@/lib/seed/seoul-clock";

type LeaveIntervalInput = Readonly<{
  date: string;
  leaveType: LeaveType;
  startAt: string | null;
  endAt: string | null;
}>;

export type LeaveInterval = Readonly<{
  startAt: string;
  endAt: string;
}>;

function resolveWorkdayBoundary(
  value: string | null,
  date: string,
  fallbackTime: "09:00:00" | "18:00:00",
) {
  return value ?? buildFixedSeoulDateTime(date, fallbackTime);
}

export function buildLeaveInterval(
  input: LeaveIntervalInput,
  workday: Pick<ExpectedWorkday, "expectedClockInAt" | "expectedClockOutAt">,
): LeaveInterval {
  const workdayStart = resolveWorkdayBoundary(
    workday.expectedClockInAt,
    input.date,
    "09:00:00",
  );
  const workdayEnd = resolveWorkdayBoundary(
    workday.expectedClockOutAt,
    input.date,
    "18:00:00",
  );

  if (input.leaveType === "hourly") {
    if (input.startAt === null || input.endAt === null) {
      throw new Error(
        `Hourly leave request on "${input.date}" must include both "startAt" and "endAt"`,
      );
    }

    return {
      startAt: input.startAt,
      endAt: input.endAt,
    };
  }

  if (input.leaveType === "half_am") {
    return {
      startAt: workdayStart,
      endAt: buildFixedSeoulDateTime(input.date, "13:00:00"),
    };
  }

  if (input.leaveType === "half_pm") {
    return {
      startAt: buildFixedSeoulDateTime(input.date, "13:00:00"),
      endAt: workdayEnd,
    };
  }

  return {
    startAt: workdayStart,
    endAt: workdayEnd,
  };
}

export function getLeaveDurationHours(input: LeaveIntervalInput) {
  if (
    input.leaveType !== "hourly" ||
    input.startAt === null ||
    input.endAt === null
  ) {
    return null;
  }

  return (
    Math.round(
      ((new Date(input.endAt).getTime() - new Date(input.startAt).getTime()) /
        3_600_000) *
        100,
    ) / 100
  );
}

export function leaveIntervalsOverlap(
  left: LeaveInterval,
  right: LeaveInterval,
) {
  return (
    new Date(left.startAt).getTime() < new Date(right.endAt).getTime() &&
    new Date(right.startAt).getTime() < new Date(left.endAt).getTime()
  );
}
