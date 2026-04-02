import { apiDateSchema } from "@/lib/contracts/shared";
import { fixedSeoulBaselineDate } from "@/lib/seed/seoul-clock";

export type AdminAttendanceMode = "today" | "history";

export type AdminAttendanceTodayUrlState = {
  mode: "today";
  name?: string;
};

export type AdminAttendanceHistoryUrlState = {
  mode: "history";
  from: string;
  to: string;
  name?: string;
};

export type AdminAttendanceUrlState =
  | AdminAttendanceTodayUrlState
  | AdminAttendanceHistoryUrlState;

export type AdminAttendanceTodayItem =
  import("@/lib/contracts/admin-attendance").AdminAttendanceTodayResponse["items"][number];

export type AdminAttendanceTodayRowGroups = {
  previousDayOpen: AdminAttendanceTodayItem[];
  failedAttempts: AdminAttendanceTodayItem[];
  manualRequests: AdminAttendanceTodayItem[];
  operationalRows: AdminAttendanceTodayItem[];
};

const historyWindowDays = 7;

function trimToUndefined(value: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function shiftApiDate(date: string, offsetDays: number) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day));

  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);

  return shifted.toISOString().slice(0, 10);
}

function getDefaultHistoryRange(today = fixedSeoulBaselineDate) {
  return {
    from: shiftApiDate(today, -(historyWindowDays - 1)),
    to: today,
  };
}

function isValidApiDate(value: string) {
  return apiDateSchema.safeParse(value).success;
}

function normalizeHistoryState(searchParams: URLSearchParams, name?: string) {
  const from = trimToUndefined(searchParams.get("from"));
  const to = trimToUndefined(searchParams.get("to"));

  if (from && to && isValidApiDate(from) && isValidApiDate(to) && from <= to) {
    return {
      mode: "history" as const,
      from,
      to,
      ...(name === undefined ? {} : { name }),
    } satisfies AdminAttendanceHistoryUrlState;
  }

  return {
    mode: "history" as const,
    ...getDefaultHistoryRange(),
    ...(name === undefined ? {} : { name }),
  } satisfies AdminAttendanceHistoryUrlState;
}

export function normalizeAdminAttendanceUrlState(
  searchParams: URLSearchParams,
): AdminAttendanceUrlState {
  const name = trimToUndefined(searchParams.get("name"));
  const mode = searchParams.get("mode");

  if (mode === "history") {
    return normalizeHistoryState(searchParams, name);
  }

  return {
    mode: "today",
    ...(name === undefined ? {} : { name }),
  } satisfies AdminAttendanceTodayUrlState;
}

export function groupAdminAttendanceTodayRows(
  items: AdminAttendanceTodayItem[],
): AdminAttendanceTodayRowGroups {
  const grouped: AdminAttendanceTodayRowGroups = {
    previousDayOpen: [],
    failedAttempts: [],
    manualRequests: [],
    operationalRows: [],
  };

  for (const item of items) {
    if (item.previousDayOpenRecord !== null) {
      grouped.previousDayOpen.push(item);
      continue;
    }

    if (item.latestFailedAttempt !== null) {
      grouped.failedAttempts.push(item);
      continue;
    }

    if (item.manualRequest !== null) {
      grouped.manualRequests.push(item);
      continue;
    }

    grouped.operationalRows.push(item);
  }

  return grouped;
}
