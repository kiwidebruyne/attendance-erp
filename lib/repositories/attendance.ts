import {
  deriveAdminAttendanceSummary,
  deriveAttendanceDisplay,
} from "@/lib/attendance/derivation";
import type {
  AdminAttendanceListResponse,
  AdminAttendanceTodayResponse,
} from "@/lib/contracts/admin-attendance";
import type {
  AttendanceHistoryResponse,
  AttendanceTodayResponse,
} from "@/lib/contracts/attendance";
import type {
  AttendanceAttempt,
  AttendanceRecord,
  AttendanceSurfaceManualRequestResource,
  ExpectedWorkday,
  FailedAttendanceAttempt,
  LeaveCoverage,
} from "@/lib/contracts/shared";
import { resolveEffectiveApprovedLeaveRequests } from "@/lib/repositories/leave-conflicts";
import { buildLeaveInterval } from "@/lib/repositories/leave-intervals";
import { resolveAttendanceSurfaceManualRequest } from "@/lib/repositories/manual-attendance";
import type { CanonicalSeedWorld } from "@/lib/seed/world";

export type AttendanceRepositoryWorld = CanonicalSeedWorld;

export type EmployeeAttendanceTodayInput = {
  employeeId: string;
  date: string;
  now: string;
};

export type EmployeeAttendanceHistoryInput = {
  employeeId: string;
  from: string;
  to: string;
  now: string;
};

export type AdminAttendanceTodayInput = {
  date: string;
  now: string;
};

export type AdminAttendanceListInput = {
  from: string;
  to: string;
  now: string;
  name?: string;
};

type AttendanceSurfaceRow = {
  date: string;
  employee: {
    id: string;
    name: string;
    department: string;
  };
  expectedWorkday: ExpectedWorkday;
  record: AttendanceRecord | null;
  attempts: AttendanceAttempt[];
  display: ReturnType<typeof deriveAttendanceDisplay>;
  latestFailedAttempt: FailedAttendanceAttempt | null;
  manualRequest: AttendanceSurfaceManualRequestResource | null;
};

function assertEmployeeExists(
  world: AttendanceRepositoryWorld,
  employeeId: string,
) {
  const employee = world.employees.find(
    (candidate) => candidate.id === employeeId,
  );

  if (employee === undefined) {
    throw new Error(`Unknown employee: ${employeeId}`);
  }

  return employee;
}

function getOffsetPart(value: string) {
  return value.endsWith("Z") ? "Z" : value.slice(-6);
}

function buildDateTime(date: string, time: string, referenceDateTime: string) {
  return `${date}T${time}${getOffsetPart(referenceDateTime)}`;
}

function addDays(date: string, delta: number) {
  const cursor = new Date(`${date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + delta);
  return cursor.toISOString().slice(0, 10);
}

function isWeekend(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function compareDateTimes(left: string, right: string) {
  return new Date(left).getTime() - new Date(right).getTime();
}

function compareDates(left: string, right: string) {
  return left.localeCompare(right);
}

function toAttendanceAttempt(
  attempt: AttendanceRepositoryWorld["attendanceAttempts"][number],
): AttendanceAttempt {
  if (attempt.status === "success") {
    return {
      id: attempt.id,
      date: attempt.date,
      action: attempt.action,
      attemptedAt: attempt.attemptedAt,
      status: "success",
      failureReason: null,
    };
  }

  return {
    id: attempt.id,
    date: attempt.date,
    action: attempt.action,
    attemptedAt: attempt.attemptedAt,
    status: "failed",
    failureReason: attempt.failureReason!,
  };
}

function createFallbackWorkday(
  date: string,
  referenceNow: string,
): ExpectedWorkday {
  const workday = !isWeekend(date);

  return {
    isWorkday: workday,
    expectedClockInAt: workday
      ? buildDateTime(date, "09:00:00", referenceNow)
      : null,
    expectedClockOutAt: workday
      ? buildDateTime(date, "18:00:00", referenceNow)
      : null,
    adjustedClockInAt: workday
      ? buildDateTime(date, "09:00:00", referenceNow)
      : null,
    adjustedClockOutAt: workday
      ? buildDateTime(date, "18:00:00", referenceNow)
      : null,
    countsTowardAdminSummary: workday,
    leaveCoverage: null,
  };
}

function resolveExpectedWorkday(
  world: AttendanceRepositoryWorld,
  employeeId: string,
  date: string,
  now: string,
): ExpectedWorkday {
  const seededWorkday = world.expectedWorkdays.find(
    (workday) => workday.employeeId === employeeId && workday.date === date,
  );
  const baseWorkday: ExpectedWorkday = seededWorkday
    ? {
        ...seededWorkday,
        leaveCoverage: null,
      }
    : createFallbackWorkday(date, now);
  const approvedLeave = resolveApprovedLeaveRequest(world, employeeId, date);

  if (approvedLeave === null) {
    return baseWorkday;
  }

  const leaveCoverage = buildLeaveCoverage(approvedLeave, baseWorkday);
  const nextWorkday: ExpectedWorkday = {
    ...baseWorkday,
    leaveCoverage,
  };

  if (approvedLeave.leaveType === "annual") {
    nextWorkday.adjustedClockInAt = null;
    nextWorkday.adjustedClockOutAt = null;
  } else if (approvedLeave.leaveType === "half_am") {
    nextWorkday.adjustedClockInAt = leaveCoverage.endAt;
    nextWorkday.adjustedClockOutAt = baseWorkday.expectedClockOutAt;
  } else if (approvedLeave.leaveType === "half_pm") {
    nextWorkday.adjustedClockInAt = baseWorkday.expectedClockInAt;
    nextWorkday.adjustedClockOutAt = leaveCoverage.startAt;
  } else if (
    approvedLeave.leaveType === "hourly" &&
    baseWorkday.expectedClockInAt !== null &&
    baseWorkday.expectedClockOutAt !== null
  ) {
    const expectedClockIn = new Date(baseWorkday.expectedClockInAt).getTime();
    const expectedClockOut = new Date(baseWorkday.expectedClockOutAt).getTime();
    const leaveStart = new Date(leaveCoverage.startAt).getTime();
    const leaveEnd = new Date(leaveCoverage.endAt).getTime();

    if (leaveStart <= expectedClockIn && leaveEnd >= expectedClockOut) {
      nextWorkday.adjustedClockInAt = null;
      nextWorkday.adjustedClockOutAt = null;
    } else if (leaveStart <= expectedClockIn) {
      nextWorkday.adjustedClockInAt = leaveCoverage.endAt;
      nextWorkday.adjustedClockOutAt = baseWorkday.expectedClockOutAt;
    } else if (leaveEnd >= expectedClockOut) {
      nextWorkday.adjustedClockInAt = baseWorkday.expectedClockInAt;
      nextWorkday.adjustedClockOutAt = leaveCoverage.startAt;
    }
  }

  return nextWorkday;
}

function resolveApprovedLeaveRequest(
  world: AttendanceRepositoryWorld,
  employeeId: string,
  date: string,
) {
  const requests = world.leaveRequests.filter(
    (request) => request.employeeId === employeeId && request.date === date,
  );

  return resolveEffectiveApprovedLeaveRequests(requests)[0] ?? null;
}

function buildLeaveCoverage(
  request: NonNullable<ReturnType<typeof resolveApprovedLeaveRequest>>,
  workday: ExpectedWorkday,
): LeaveCoverage {
  const interval = buildLeaveInterval(request, workday);

  return {
    requestId: request.id,
    leaveType: request.leaveType,
    ...interval,
  };
}

function resolveAttendanceRecord(
  world: AttendanceRepositoryWorld,
  employeeId: string,
  date: string,
) {
  return (
    world.attendanceRecords.find(
      (record) => record.employeeId === employeeId && record.date === date,
    ) ?? null
  );
}

function hasLaterSuccessfulAttempt(
  failedAttempt: AttendanceAttempt,
  attempts: AttendanceAttempt[],
) {
  const failedAttemptedAt = new Date(failedAttempt.attemptedAt).getTime();

  return attempts.some((attempt) => {
    if (attempt.status !== "success") {
      return false;
    }

    return new Date(attempt.attemptedAt).getTime() > failedAttemptedAt;
  });
}

function resolveOperationalAttempts(
  world: AttendanceRepositoryWorld,
  employeeId: string,
  date: string,
) {
  const relevantAttempts = world.attendanceAttempts
    .filter(
      (attempt) => attempt.employeeId === employeeId && attempt.date === date,
    )
    .map(toAttendanceAttempt);

  return relevantAttempts
    .filter((attempt) => {
      if (attempt.status === "success") {
        return true;
      }

      return !hasLaterSuccessfulAttempt(
        attempt,
        relevantAttempts.filter(
          (candidateAttempt) => candidateAttempt.date === attempt.date,
        ),
      );
    })
    .sort((left, right) =>
      compareDateTimes(left.attemptedAt, right.attemptedAt),
    );
}

function resolveLatestFailedAttempt(
  attempts: AttendanceAttempt[],
): FailedAttendanceAttempt | null {
  const unresolvedFailures = attempts.filter(
    (attempt): attempt is FailedAttendanceAttempt =>
      attempt.status === "failed" &&
      !hasLaterSuccessfulAttempt(attempt, attempts),
  );

  return (
    unresolvedFailures.sort((left, right) =>
      compareDateTimes(right.attemptedAt, left.attemptedAt),
    )[0] ?? null
  );
}

function buildAttendanceSurfaceRow(
  world: AttendanceRepositoryWorld,
  employeeId: string,
  date: string,
  now: string,
): AttendanceSurfaceRow {
  const employee = assertEmployeeExists(world, employeeId);
  const expectedWorkday = resolveExpectedWorkday(world, employeeId, date, now);
  const record = resolveAttendanceRecord(world, employeeId, date);
  const operationalAttempts = resolveOperationalAttempts(
    world,
    employeeId,
    date,
  );
  const manualRequest = resolveAttendanceSurfaceManualRequest(
    world,
    employeeId,
    date,
  );

  return {
    date,
    employee: {
      id: employee.id,
      name: employee.name,
      department: employee.department,
    },
    expectedWorkday,
    record,
    attempts: operationalAttempts,
    display: deriveAttendanceDisplay({
      now,
      expectedWorkday,
      record,
      attempts: operationalAttempts,
      manualRequest,
    }),
    latestFailedAttempt: resolveLatestFailedAttempt(operationalAttempts),
    manualRequest,
  };
}

function isAdminTodayItemRelevant(row: AttendanceSurfaceRow) {
  return (
    row.record !== null ||
    row.latestFailedAttempt !== null ||
    row.manualRequest !== null ||
    row.expectedWorkday.leaveCoverage !== null ||
    row.display.activeExceptions.length > 0
  );
}

function isAdminListRowRelevant(row: AttendanceSurfaceRow) {
  return (
    row.record !== null ||
    row.latestFailedAttempt !== null ||
    row.manualRequest !== null ||
    row.expectedWorkday.leaveCoverage !== null ||
    row.display.activeExceptions.length > 0
  );
}

function getRangeDates(from: string, to: string) {
  const dates: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
    if (cursor === to) {
      break;
    }
  }
  return dates;
}

function sortByDateAndNameDesc(
  left: AttendanceSurfaceRow,
  right: AttendanceSurfaceRow,
) {
  if (left.date !== right.date) {
    return compareDates(right.date, left.date);
  }

  return left.employee.name.localeCompare(right.employee.name);
}

function resolvePendingHistoryManualRequest(
  world: AttendanceRepositoryWorld,
  employeeId: string,
  date: string,
): AttendanceHistoryResponse["records"][number]["manualRequest"] {
  const manualRequest = resolveAttendanceSurfaceManualRequest(
    world,
    employeeId,
    date,
  );

  if (
    manualRequest?.status !== "pending" ||
    manualRequest.activeStatus !== "pending" ||
    manualRequest.effectiveStatus !== "pending"
  ) {
    return null;
  }

  return {
    ...manualRequest,
    status: "pending",
    activeStatus: "pending",
    effectiveStatus: "pending",
  };
}

export function getEmployeeAttendanceToday(
  world: AttendanceRepositoryWorld,
  input: EmployeeAttendanceTodayInput,
): AttendanceTodayResponse {
  const row = buildAttendanceSurfaceRow(
    world,
    input.employeeId,
    input.date,
    input.now,
  );

  return {
    date: input.date,
    employee: row.employee,
    expectedWorkday: row.expectedWorkday,
    todayRecord: row.record,
    attempts: row.attempts,
    manualRequest: row.manualRequest,
    display: row.display,
  };
}

export function getEmployeeAttendanceHistory(
  world: AttendanceRepositoryWorld,
  input: EmployeeAttendanceHistoryInput,
): AttendanceHistoryResponse {
  const records = getRangeDates(input.from, input.to).map((date) => {
    const row = buildAttendanceSurfaceRow(
      world,
      input.employeeId,
      date,
      input.now,
    );

    return {
      date,
      expectedWorkday: row.expectedWorkday,
      record: row.record,
      manualRequest: resolvePendingHistoryManualRequest(
        world,
        input.employeeId,
        date,
      ),
      display: row.display,
    };
  });

  return {
    from: input.from,
    to: input.to,
    records,
  };
}

export function getAdminAttendanceToday(
  world: AttendanceRepositoryWorld,
  input: AdminAttendanceTodayInput,
): AdminAttendanceTodayResponse {
  const allRows = world.employees.map((employee) =>
    buildAttendanceSurfaceRow(world, employee.id, input.date, input.now),
  );

  const summary = deriveAdminAttendanceSummary(
    allRows.map((row) => ({
      expectedWorkday: row.expectedWorkday,
      todayRecord: row.record,
      display: row.display,
    })),
  );

  const items = allRows
    .filter(isAdminTodayItemRelevant)
    .sort((left, right) => {
      const priority = (row: AttendanceSurfaceRow) => {
        if (row.latestFailedAttempt !== null) {
          return 0;
        }

        if (row.manualRequest !== null) {
          return 1;
        }

        if (row.display.activeExceptions.includes("not_checked_in")) {
          return 2;
        }

        if (row.display.activeExceptions.includes("leave_work_conflict")) {
          return 3;
        }

        return 4;
      };

      const priorityDelta = priority(left) - priority(right);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return left.employee.name.localeCompare(right.employee.name);
    })
    .map((row) => ({
      employee: row.employee,
      expectedWorkday: row.expectedWorkday,
      todayRecord: row.record,
      display: row.display,
      latestFailedAttempt: row.latestFailedAttempt,
      manualRequest: row.manualRequest,
    }));

  return {
    date: input.date,
    summary,
    items,
  };
}

export function getAdminAttendanceList(
  world: AttendanceRepositoryWorld,
  input: AdminAttendanceListInput,
): AdminAttendanceListResponse {
  const nameFilterValue = input.name?.trim().toLowerCase();
  const nameFilter =
    nameFilterValue === undefined || nameFilterValue.length === 0
      ? undefined
      : nameFilterValue;
  const rows = getRangeDates(input.from, input.to)
    .flatMap((date) =>
      world.employees.map((employee) =>
        buildAttendanceSurfaceRow(world, employee.id, date, input.now),
      ),
    )
    .filter((row) => {
      if (nameFilter === undefined) {
        return true;
      }

      return row.employee.name.toLowerCase().includes(nameFilter);
    })
    .filter(isAdminListRowRelevant)
    .sort(sortByDateAndNameDesc);

  return {
    from: input.from,
    to: input.to,
    filters: nameFilter === undefined ? {} : { name: nameFilter },
    total: rows.length,
    records: rows.map((row) => ({
      date: row.date,
      employee: row.employee,
      expectedWorkday: row.expectedWorkday,
      record: row.record,
      display: row.display,
      latestFailedAttempt: row.latestFailedAttempt,
    })),
  };
}
