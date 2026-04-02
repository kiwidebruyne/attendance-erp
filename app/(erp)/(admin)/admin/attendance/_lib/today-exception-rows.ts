import {
  buildExceptionSurfaceModels,
  buildHistoryAction,
} from "@/app/(erp)/(employee)/attendance/_lib/view-model";
import type { AdminAttendanceTodayResponse } from "@/lib/contracts/admin-attendance";
import {
  createMockSeedRepository,
  getMockSeedWorld,
} from "@/lib/server/mock-state";

export type AdminAttendanceTodayExceptionRow = Readonly<{
  department: string;
  detail: string;
  employeeId: string;
  employeeName: string;
  exceptionType: string;
  id: string;
  referenceDate: string;
  specialNote: string;
}>;

export type AdminAttendanceLedgerView =
  | "default"
  | "by-attendance-status"
  | "by-work-state";

type EmployeeHistoryRecord = ReturnType<
  ReturnType<typeof createMockSeedRepository>["getEmployeeAttendanceHistory"]
>["records"][number];

type SortableExceptionRow = AdminAttendanceTodayExceptionRow &
  Readonly<{
    priority: number;
  }>;

function getCurrentSurfacePriority(surfaceId: string) {
  if (surfaceId === "previous-day-checkout-missing") {
    return 0;
  }

  if (surfaceId.startsWith("attempt-failed")) {
    return 1;
  }

  if (surfaceId === "manual-request-summary") {
    return 2;
  }

  if (surfaceId === "leave-work-conflict") {
    return 3;
  }

  return 4;
}

function getCurrentSurfaceExceptionType(
  surface: ReturnType<typeof buildExceptionSurfaceModels>[number],
) {
  if (surface.id === "previous-day-checkout-missing") {
    return "전날 미퇴근";
  }

  if (surface.id.startsWith("attempt-failed")) {
    return "시도 실패";
  }

  if (surface.id === "manual-request-summary") {
    if (surface.title.includes("보완")) {
      return "정정 요청 보완 필요";
    }

    if (surface.title.includes("조정")) {
      return "정정 요청 반려";
    }

    return "정정 요청 검토 중";
  }

  if (surface.id === "leave-work-conflict") {
    return "휴가 충돌";
  }

  if (surface.id === "not-checked-in") {
    return "출근 기록 없음";
  }

  return "근무 기록 비어 있음";
}

function getCurrentSurfaceSpecialNote(
  surface: ReturnType<typeof buildExceptionSurfaceModels>[number],
) {
  if (surface.id === "previous-day-checkout-missing") {
    return "퇴근 누락";
  }

  if (surface.id === "not-checked-in") {
    return "출근 누락";
  }

  if (surface.id === "absent") {
    return "출근/퇴근 누락";
  }

  return "-";
}

function getCurrentSurfaceReferenceDate(
  item: AdminAttendanceTodayResponse["items"][number],
  surface: ReturnType<typeof buildExceptionSurfaceModels>[number],
  todayDate: string,
) {
  if (surface.id === "previous-day-checkout-missing") {
    return item.previousDayOpenRecord?.date ?? todayDate;
  }

  if (surface.id.startsWith("attempt-failed")) {
    return item.latestFailedAttempt?.date ?? todayDate;
  }

  if (surface.id === "manual-request-summary") {
    return item.manualRequest?.date ?? todayDate;
  }

  return todayDate;
}

function getHistorySpecialNoteLabel(
  record: EmployeeHistoryRecord,
  todayDate: string,
) {
  if (!record.expectedWorkday.isWorkday) {
    return "휴일";
  }

  if (
    record.date < todayDate &&
    record.record?.clockInAt !== null &&
    record.record?.clockInAt !== undefined &&
    record.record.clockOutAt === null
  ) {
    return "퇴근 누락";
  }

  if (record.display.activeExceptions.includes("not_checked_in")) {
    return "출근 누락";
  }

  if (record.display.activeExceptions.includes("absent")) {
    return "출근/퇴근 누락";
  }

  return "-";
}

function getHistoryExceptionTypeLabels(
  record: EmployeeHistoryRecord,
  todayDate: string,
) {
  const statuses: string[] = [];

  if (
    record.date < todayDate &&
    record.record?.clockInAt !== null &&
    record.record?.clockInAt !== undefined &&
    record.record.clockOutAt === null
  ) {
    statuses.push("전날 미퇴근");
  }

  if (record.display.activeExceptions.includes("attempt_failed")) {
    statuses.push("시도 실패");
  }

  if (record.display.activeExceptions.includes("manual_request_pending")) {
    statuses.push("정정 요청 검토 중");
  }

  if (record.display.activeExceptions.includes("manual_request_rejected")) {
    statuses.push("정정 요청 보완 필요");
  }

  if (record.display.activeExceptions.includes("not_checked_in")) {
    statuses.push("출근 기록 없음");
  }

  if (record.display.activeExceptions.includes("absent")) {
    statuses.push("결근");
  }

  return [...new Set(statuses)];
}

function hasHistoricalIssue(record: EmployeeHistoryRecord, todayDate: string) {
  return getHistoryExceptionTypeLabels(record, todayDate).length > 0;
}

function getHistoricalPriority(
  record: EmployeeHistoryRecord,
  todayDate: string,
) {
  if (
    record.date < todayDate &&
    record.record?.clockInAt !== null &&
    record.record?.clockInAt !== undefined &&
    record.record.clockOutAt === null
  ) {
    return 0;
  }

  if (record.display.activeExceptions.includes("attempt_failed")) {
    return 1;
  }

  if (
    record.display.activeExceptions.includes("manual_request_pending") ||
    record.display.activeExceptions.includes("manual_request_rejected")
  ) {
    return 2;
  }

  if (
    record.display.activeExceptions.includes("not_checked_in") ||
    record.display.activeExceptions.includes("absent")
  ) {
    return 4;
  }

  return 5;
}

function getHistoricalIssueDetails(
  record: EmployeeHistoryRecord,
  todayDate: string,
) {
  const specialNote = getHistorySpecialNoteLabel(record, todayDate);
  const labels = [
    ...getHistoryExceptionTypeLabels(record, todayDate),
    specialNote === "-" || specialNote === "휴일" ? null : specialNote,
  ].filter((label): label is string => label !== null);

  return [...new Set(labels)];
}

function getHistoricalIssueDescription(issueLabels: string[]) {
  if (issueLabels.length === 1) {
    return `${issueLabels[0]} 상태가 남아 있어요`;
  }

  return `${issueLabels.join(", ")} 상태가 함께 남아 있어요`;
}

function getHistoricalExceptionType(issueLabels: string[]) {
  if (issueLabels.length === 0) {
    return "정정 필요";
  }

  return issueLabels.join(" · ");
}

function buildCurrentRows(input: {
  item: AdminAttendanceTodayResponse["items"][number];
  repository: ReturnType<typeof createMockSeedRepository>;
  todayDate: string;
}) {
  const employeeToday = input.repository.getEmployeeAttendanceToday({
    employeeId: input.item.employee.id,
    date: input.todayDate,
  });

  return buildExceptionSurfaceModels(employeeToday).map<SortableExceptionRow>(
    (surface) => ({
      department: input.item.employee.department,
      detail: surface.description,
      employeeId: input.item.employee.id,
      employeeName: input.item.employee.name,
      exceptionType: getCurrentSurfaceExceptionType(surface),
      id: `current-${input.item.employee.id}-${surface.id}`,
      priority: getCurrentSurfacePriority(surface.id),
      referenceDate: getCurrentSurfaceReferenceDate(
        input.item,
        surface,
        input.todayDate,
      ),
      specialNote: getCurrentSurfaceSpecialNote(surface),
    }),
  );
}

function buildHistoricalRows(input: {
  employeeId: string;
  employeeName: string;
  department: string;
  repository: ReturnType<typeof createMockSeedRepository>;
  todayDate: string;
}) {
  const history = input.repository.getEmployeeAttendanceHistory({
    employeeId: input.employeeId,
    from: getMockSeedWorld().calendarWindow.start,
    to: input.todayDate,
  });

  return [...history.records]
    .sort((left, right) => right.date.localeCompare(left.date))
    .filter(
      (record) =>
        record.date < input.todayDate &&
        hasHistoricalIssue(record, input.todayDate),
    )
    .flatMap((record) => {
      const historyAction = buildHistoryAction(record);

      if (historyAction === null) {
        return [];
      }

      const issueLabels = getHistoricalIssueDetails(record, input.todayDate);
      const exceptionTypeLabels = getHistoryExceptionTypeLabels(
        record,
        input.todayDate,
      );

      return [
        {
          department: input.department,
          detail: getHistoricalIssueDescription(issueLabels),
          employeeId: input.employeeId,
          employeeName: input.employeeName,
          exceptionType: getHistoricalExceptionType(exceptionTypeLabels),
          id: `history-${input.employeeId}-${record.date}`,
          priority: getHistoricalPriority(record, input.todayDate),
          referenceDate: record.date,
          specialNote: getHistorySpecialNoteLabel(record, input.todayDate),
        } satisfies SortableExceptionRow,
      ];
    });
}

export function buildAdminAttendanceTodayExceptionRows(
  today: AdminAttendanceTodayResponse,
) {
  const repository = createMockSeedRepository();

  return today.items
    .flatMap((item) => [
      ...buildCurrentRows({
        item,
        repository,
        todayDate: today.date,
      }),
      ...buildHistoricalRows({
        department: item.employee.department,
        employeeId: item.employee.id,
        employeeName: item.employee.name,
        repository,
        todayDate: today.date,
      }),
    ])
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      if (left.priority === 5 && left.referenceDate !== right.referenceDate) {
        return right.referenceDate.localeCompare(left.referenceDate);
      }

      if (left.referenceDate !== right.referenceDate) {
        return left.referenceDate.localeCompare(right.referenceDate);
      }

      return left.employeeName.localeCompare(right.employeeName, "ko-KR");
    })
    .map<AdminAttendanceTodayExceptionRow>((row) => ({
      department: row.department,
      detail: row.detail,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      exceptionType: row.exceptionType,
      id: row.id,
      referenceDate: row.referenceDate,
      specialNote: row.specialNote,
    }));
}
