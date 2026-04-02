import type {
  AttendanceHistoryResponse,
  AttendanceTodayResponse,
} from "@/lib/contracts/attendance";
import { getCurrentEmployeeId } from "@/lib/server/current-employee";
import {
  createMockSeedRepository,
  getMockSeedWorld,
} from "@/lib/server/mock-state";

export type AttendanceHistoryView = "week" | "month";

export type AttendanceHistoryRange = Readonly<{
  from: string;
  to: string;
}>;

export type AttendancePageData = Readonly<{
  date: string;
  view: AttendanceHistoryView;
  historyRange: AttendanceHistoryRange;
  today: AttendanceTodayResponse;
  history: AttendanceHistoryResponse;
}>;

function addDays(date: string, delta: number) {
  const cursor = new Date(`${date}T00:00:00Z`);

  cursor.setUTCDate(cursor.getUTCDate() + delta);

  return cursor.toISOString().slice(0, 10);
}

export function parseAttendanceHistoryView(
  view: string | string[] | undefined,
): AttendanceHistoryView {
  if (view === "month") {
    return "month";
  }

  return "week";
}

export function getAttendanceHistoryRange(
  date: string,
  view: AttendanceHistoryView,
): AttendanceHistoryRange {
  const historyDays = view === "month" ? 30 : 7;

  return {
    from: addDays(date, -(historyDays - 1)),
    to: date,
  };
}

export function getAttendancePageData(input: {
  view: string | string[] | undefined;
}): AttendancePageData {
  const repository = createMockSeedRepository();
  const employeeId = getCurrentEmployeeId();
  const baselineDate = getMockSeedWorld().baselineDate;
  const today = repository.getEmployeeAttendanceToday({
    employeeId,
    date: baselineDate,
  });
  const view = parseAttendanceHistoryView(input.view);
  const historyRange = getAttendanceHistoryRange(today.date, view);
  const history = repository.getEmployeeAttendanceHistory({
    employeeId,
    from: historyRange.from,
    to: historyRange.to,
  });

  return {
    date: today.date,
    view,
    historyRange,
    today,
    history,
  };
}
