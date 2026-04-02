import {
  attendanceAttemptEntitySchema,
  attendanceRecordEntitySchema,
  companyEventEntitySchema,
  employeeEntitySchema,
  expectedWorkdayEntitySchema,
  leaveRequestEntitySchema,
  manualAttendanceRequestEntitySchema,
  requestReviewEventEntitySchema,
} from "@/lib/seed/entities";
import {
  buildFixedSeoulDateTime,
  fixedSeoulBaselineDate,
  fixedSeoulCalendarWindow,
} from "@/lib/seed/seoul-clock";

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return value;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }

  return value;
}

function listDateRange(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (cursor.getTime() <= last.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function isWeekend(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

const seededSpecialWorkdays = new Set(["2026-04-18"]);

function workdayId(employeeId: string, date: string) {
  return `expected_workday_${employeeId}_${date}`;
}

function attendanceAttemptId(
  employeeId: string,
  date: string,
  action: "clock_in" | "clock_out",
  status: "success" | "failed",
) {
  return `attendance_attempt_${employeeId}_${date}_${action}${
    status === "failed" ? "_failed" : ""
  }`;
}

function attendanceRecordId(employeeId: string, date: string) {
  return `attendance_record_${employeeId}_${date}`;
}

function manualRequestId(
  employeeId: string,
  date: string,
  suffix: "root" | "resubmission",
) {
  return `manual_request_${employeeId}_${date}_${suffix}`;
}

function leaveRequestId(
  employeeId: string,
  date: string,
  suffix: "root" | "change" | "resubmission",
) {
  return `leave_request_${employeeId}_${date}_${suffix}`;
}

const employees = deepFreeze(
  employeeEntitySchema.array().parse([
    {
      id: "emp_001",
      name: "Minji Park",
      department: "Operations",
      role: "employee",
    },
    {
      id: "emp_002",
      name: "Junho Lee",
      department: "Engineering",
      role: "employee",
    },
    {
      id: "emp_003",
      name: "Hana Choi",
      department: "Customer Success",
      role: "employee",
    },
    {
      id: "emp_004",
      name: "Seungwoo Kim",
      department: "Sales",
      role: "employee",
    },
    {
      id: "emp_005",
      name: "Yuna Kang",
      department: "Finance",
      role: "employee",
    },
    {
      id: "emp_006",
      name: "Daeho Jung",
      department: "Product",
      role: "employee",
    },
    {
      id: "emp_007",
      name: "Jisoo Lim",
      department: "Operations",
      role: "employee",
    },
    {
      id: "emp_008",
      name: "Taeyang Shin",
      department: "Engineering",
      role: "employee",
    },
    { id: "emp_009", name: "Sora Moon", department: "HR", role: "employee" },
    {
      id: "emp_010",
      name: "Hyunwoo Baek",
      department: "Support",
      role: "employee",
    },
    { id: "emp_011", name: "Nari Oh", department: "Finance", role: "employee" },
    { id: "emp_012", name: "Jiwon Han", department: "People", role: "admin" },
  ]),
);

const calendarDates = listDateRange(
  fixedSeoulCalendarWindow.start,
  fixedSeoulCalendarWindow.end,
);

const expectedWorkdays = deepFreeze(
  expectedWorkdayEntitySchema.array().parse(
    employees.flatMap((employee) =>
      calendarDates.map((date) => {
        // The seed contract explicitly uses 2026-04-18 for a leave-work conflict,
        // so that date stays a seeded operational workday even though it falls on a weekend.
        const weekend = isWeekend(date) && !seededSpecialWorkdays.has(date);
        const leaveOverride =
          (employee.id === "emp_004" && date === "2026-04-16") ||
          (employee.id === "emp_005" && date === "2026-04-18");

        return {
          id: workdayId(employee.id, date),
          employeeId: employee.id,
          date,
          isWorkday: !weekend,
          expectedClockInAt: weekend
            ? null
            : buildFixedSeoulDateTime(date, "09:00:00"),
          expectedClockOutAt: weekend
            ? null
            : buildFixedSeoulDateTime(date, "18:00:00"),
          adjustedClockInAt:
            weekend || leaveOverride
              ? null
              : buildFixedSeoulDateTime(date, "09:00:00"),
          adjustedClockOutAt:
            weekend || leaveOverride
              ? null
              : buildFixedSeoulDateTime(date, "18:00:00"),
          countsTowardAdminSummary: !weekend,
        };
      }),
    ),
  ),
);

function minutesBetween(startAt: string, endAt: string) {
  return Math.round(
    (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000,
  );
}

const emp001CompletedAttendanceDays = deepFreeze([
  {
    date: "2026-03-24",
    clockInAt: buildFixedSeoulDateTime("2026-03-24", "08:58:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-03-24", "18:02:00"),
  },
  {
    date: "2026-03-25",
    clockInAt: buildFixedSeoulDateTime("2026-03-25", "09:14:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-03-25", "18:11:00"),
  },
  {
    date: "2026-03-26",
    clockInAt: buildFixedSeoulDateTime("2026-03-26", "09:01:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-03-26", "18:05:00"),
  },
  {
    date: "2026-03-31",
    clockInAt: buildFixedSeoulDateTime("2026-03-31", "08:57:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-03-31", "17:34:00"),
  },
  {
    date: "2026-04-01",
    clockInAt: buildFixedSeoulDateTime("2026-04-01", "09:00:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-04-01", "18:08:00"),
  },
  {
    date: "2026-04-02",
    clockInAt: buildFixedSeoulDateTime("2026-04-02", "09:10:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-04-02", "18:06:00"),
  },
  {
    date: "2026-04-03",
    clockInAt: buildFixedSeoulDateTime("2026-04-03", "08:55:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-04-03", "18:03:00"),
  },
  {
    date: "2026-04-06",
    clockInAt: buildFixedSeoulDateTime("2026-04-06", "08:59:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-04-06", "18:00:00"),
  },
  {
    date: "2026-04-07",
    clockInAt: buildFixedSeoulDateTime("2026-04-07", "08:57:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-04-07", "18:04:00"),
  },
  {
    date: "2026-04-08",
    clockInAt: buildFixedSeoulDateTime("2026-04-08", "09:18:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-04-08", "18:02:00"),
  },
  {
    date: "2026-04-09",
    clockInAt: buildFixedSeoulDateTime("2026-04-09", "08:59:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-04-09", "17:21:00"),
  },
]);

const attendanceAttempts = deepFreeze(
  attendanceAttemptEntitySchema.array().parse([
    {
      id: attendanceAttemptId("emp_001", "2026-04-10", "clock_in", "success"),
      employeeId: "emp_001",
      date: "2026-04-10",
      action: "clock_in",
      attemptedAt: buildFixedSeoulDateTime("2026-04-10", "08:56:00"),
      status: "success",
      failureReason: null,
    },
    ...emp001CompletedAttendanceDays.flatMap((day) => [
      {
        id: attendanceAttemptId("emp_001", day.date, "clock_in", "success"),
        employeeId: "emp_001",
        date: day.date,
        action: "clock_in" as const,
        attemptedAt: day.clockInAt,
        status: "success" as const,
        failureReason: null,
      },
      {
        id: attendanceAttemptId("emp_001", day.date, "clock_out", "success"),
        employeeId: "emp_001",
        date: day.date,
        action: "clock_out" as const,
        attemptedAt: day.clockOutAt,
        status: "success" as const,
        failureReason: null,
      },
    ]),
    {
      id: attendanceAttemptId("emp_001", "2026-04-11", "clock_in", "success"),
      employeeId: "emp_001",
      date: "2026-04-11",
      action: "clock_in",
      attemptedAt: buildFixedSeoulDateTime("2026-04-11", "09:12:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_001", "2026-04-11", "clock_out", "success"),
      employeeId: "emp_001",
      date: "2026-04-11",
      action: "clock_out",
      attemptedAt: buildFixedSeoulDateTime("2026-04-11", "18:04:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_002", "2026-04-02", "clock_in", "success"),
      employeeId: "emp_002",
      date: "2026-04-02",
      action: "clock_in",
      attemptedAt: buildFixedSeoulDateTime("2026-04-02", "09:05:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_002", "2026-04-02", "clock_out", "success"),
      employeeId: "emp_002",
      date: "2026-04-02",
      action: "clock_out",
      attemptedAt: buildFixedSeoulDateTime("2026-04-02", "18:00:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_002", "2026-04-14", "clock_in", "success"),
      employeeId: "emp_002",
      date: "2026-04-14",
      action: "clock_in",
      attemptedAt: buildFixedSeoulDateTime("2026-04-14", "09:02:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_002", "2026-04-14", "clock_out", "success"),
      employeeId: "emp_002",
      date: "2026-04-14",
      action: "clock_out",
      attemptedAt: buildFixedSeoulDateTime("2026-04-15", "08:45:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_003", "2026-04-16", "clock_out", "failed"),
      employeeId: "emp_003",
      date: "2026-04-16",
      action: "clock_out",
      attemptedAt: buildFixedSeoulDateTime("2026-04-16", "18:10:00"),
      status: "failed",
      failureReason: "Bluetooth beacon was unavailable at checkout.",
    },
    {
      id: attendanceAttemptId("emp_004", "2026-04-01", "clock_in", "success"),
      employeeId: "emp_004",
      date: "2026-04-01",
      action: "clock_in",
      attemptedAt: buildFixedSeoulDateTime("2026-04-01", "09:17:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_004", "2026-04-01", "clock_out", "success"),
      employeeId: "emp_004",
      date: "2026-04-01",
      action: "clock_out",
      attemptedAt: buildFixedSeoulDateTime("2026-04-01", "18:20:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_005", "2026-04-18", "clock_in", "success"),
      employeeId: "emp_005",
      date: "2026-04-18",
      action: "clock_in",
      attemptedAt: buildFixedSeoulDateTime("2026-04-18", "09:01:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_005", "2026-04-18", "clock_out", "success"),
      employeeId: "emp_005",
      date: "2026-04-18",
      action: "clock_out",
      attemptedAt: buildFixedSeoulDateTime("2026-04-18", "18:03:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_006", "2026-04-04", "clock_in", "success"),
      employeeId: "emp_006",
      date: "2026-04-04",
      action: "clock_in",
      attemptedAt: buildFixedSeoulDateTime("2026-04-04", "09:01:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_006", "2026-04-04", "clock_out", "success"),
      employeeId: "emp_006",
      date: "2026-04-04",
      action: "clock_out",
      attemptedAt: buildFixedSeoulDateTime("2026-04-04", "17:45:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_007", "2026-04-03", "clock_in", "success"),
      employeeId: "emp_007",
      date: "2026-04-03",
      action: "clock_in",
      attemptedAt: buildFixedSeoulDateTime("2026-04-03", "09:00:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_008", "2026-04-09", "clock_in", "success"),
      employeeId: "emp_008",
      date: "2026-04-09",
      action: "clock_in",
      attemptedAt: buildFixedSeoulDateTime("2026-04-09", "09:11:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_008", "2026-04-09", "clock_out", "success"),
      employeeId: "emp_008",
      date: "2026-04-09",
      action: "clock_out",
      attemptedAt: buildFixedSeoulDateTime("2026-04-09", "17:12:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_010", "2026-04-13", "clock_in", "failed"),
      employeeId: "emp_010",
      date: "2026-04-13",
      action: "clock_in",
      attemptedAt: buildFixedSeoulDateTime("2026-04-13", "09:08:00"),
      status: "failed",
      failureReason: "The phone app could not reach the beacon service.",
    },
    {
      id: attendanceAttemptId("emp_011", "2026-04-11", "clock_in", "success"),
      employeeId: "emp_011",
      date: "2026-04-11",
      action: "clock_in",
      attemptedAt: buildFixedSeoulDateTime("2026-04-11", "09:00:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_011", "2026-04-11", "clock_out", "success"),
      employeeId: "emp_011",
      date: "2026-04-11",
      action: "clock_out",
      attemptedAt: buildFixedSeoulDateTime("2026-04-11", "17:40:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_012", "2026-04-14", "clock_in", "success"),
      employeeId: "emp_012",
      date: "2026-04-14",
      action: "clock_in",
      attemptedAt: buildFixedSeoulDateTime("2026-04-14", "09:24:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_012", "2026-04-14", "clock_out", "success"),
      employeeId: "emp_012",
      date: "2026-04-14",
      action: "clock_out",
      attemptedAt: buildFixedSeoulDateTime("2026-04-14", "18:10:00"),
      status: "success",
      failureReason: null,
    },
  ]),
);

const attendanceRecords = deepFreeze(
  attendanceRecordEntitySchema.array().parse([
    {
      id: attendanceRecordId("emp_001", "2026-04-10"),
      employeeId: "emp_001",
      date: "2026-04-10",
      clockInAt: buildFixedSeoulDateTime("2026-04-10", "08:56:00"),
      clockInSource: "beacon",
      clockOutAt: null,
      clockOutSource: null,
      workMinutes: null,
      manualRequestId: null,
    },
    ...emp001CompletedAttendanceDays.map((day) => ({
      id: attendanceRecordId("emp_001", day.date),
      employeeId: "emp_001",
      date: day.date,
      clockInAt: day.clockInAt,
      clockInSource: "beacon" as const,
      clockOutAt: day.clockOutAt,
      clockOutSource: "beacon" as const,
      workMinutes: minutesBetween(day.clockInAt, day.clockOutAt),
      manualRequestId: null,
    })),
    {
      id: attendanceRecordId("emp_001", "2026-04-11"),
      employeeId: "emp_001",
      date: "2026-04-11",
      clockInAt: buildFixedSeoulDateTime("2026-04-11", "09:12:00"),
      clockInSource: "beacon",
      clockOutAt: buildFixedSeoulDateTime("2026-04-11", "18:04:00"),
      clockOutSource: "beacon",
      workMinutes: minutesBetween(
        buildFixedSeoulDateTime("2026-04-11", "09:12:00"),
        buildFixedSeoulDateTime("2026-04-11", "18:04:00"),
      ),
      manualRequestId: null,
    },
    {
      id: attendanceRecordId("emp_002", "2026-04-02"),
      employeeId: "emp_002",
      date: "2026-04-02",
      clockInAt: buildFixedSeoulDateTime("2026-04-02", "09:05:00"),
      clockInSource: "beacon",
      clockOutAt: buildFixedSeoulDateTime("2026-04-02", "18:00:00"),
      clockOutSource: "beacon",
      workMinutes: minutesBetween(
        buildFixedSeoulDateTime("2026-04-02", "09:05:00"),
        buildFixedSeoulDateTime("2026-04-02", "18:00:00"),
      ),
      manualRequestId: null,
    },
    {
      id: attendanceRecordId("emp_002", "2026-04-14"),
      employeeId: "emp_002",
      date: "2026-04-14",
      clockInAt: buildFixedSeoulDateTime("2026-04-14", "09:02:00"),
      clockInSource: "beacon",
      clockOutAt: buildFixedSeoulDateTime("2026-04-15", "08:45:00"),
      clockOutSource: "beacon",
      workMinutes: minutesBetween(
        buildFixedSeoulDateTime("2026-04-14", "09:02:00"),
        buildFixedSeoulDateTime("2026-04-15", "08:45:00"),
      ),
      manualRequestId: null,
    },
    {
      id: attendanceRecordId("emp_004", "2026-04-01"),
      employeeId: "emp_004",
      date: "2026-04-01",
      clockInAt: buildFixedSeoulDateTime("2026-04-01", "09:17:00"),
      clockInSource: "beacon",
      clockOutAt: buildFixedSeoulDateTime("2026-04-01", "18:20:00"),
      clockOutSource: "beacon",
      workMinutes: minutesBetween(
        buildFixedSeoulDateTime("2026-04-01", "09:17:00"),
        buildFixedSeoulDateTime("2026-04-01", "18:20:00"),
      ),
      manualRequestId: null,
    },
    {
      id: attendanceRecordId("emp_005", "2026-04-18"),
      employeeId: "emp_005",
      date: "2026-04-18",
      clockInAt: buildFixedSeoulDateTime("2026-04-18", "09:01:00"),
      clockInSource: "beacon",
      clockOutAt: buildFixedSeoulDateTime("2026-04-18", "18:03:00"),
      clockOutSource: "beacon",
      workMinutes: minutesBetween(
        buildFixedSeoulDateTime("2026-04-18", "09:01:00"),
        buildFixedSeoulDateTime("2026-04-18", "18:03:00"),
      ),
      manualRequestId: null,
    },
    {
      id: attendanceRecordId("emp_006", "2026-04-04"),
      employeeId: "emp_006",
      date: "2026-04-04",
      clockInAt: buildFixedSeoulDateTime("2026-04-04", "09:01:00"),
      clockInSource: "beacon",
      clockOutAt: buildFixedSeoulDateTime("2026-04-04", "17:45:00"),
      clockOutSource: "beacon",
      workMinutes: minutesBetween(
        buildFixedSeoulDateTime("2026-04-04", "09:01:00"),
        buildFixedSeoulDateTime("2026-04-04", "17:45:00"),
      ),
      manualRequestId: null,
    },
    {
      id: attendanceRecordId("emp_007", "2026-04-03"),
      employeeId: "emp_007",
      date: "2026-04-03",
      clockInAt: buildFixedSeoulDateTime("2026-04-03", "09:00:00"),
      clockInSource: "beacon",
      clockOutAt: buildFixedSeoulDateTime("2026-04-03", "18:05:00"),
      clockOutSource: "manual",
      workMinutes: minutesBetween(
        buildFixedSeoulDateTime("2026-04-03", "09:00:00"),
        buildFixedSeoulDateTime("2026-04-03", "18:05:00"),
      ),
      manualRequestId: manualRequestId("emp_007", "2026-04-03", "root"),
    },
    {
      id: attendanceRecordId("emp_008", "2026-04-09"),
      employeeId: "emp_008",
      date: "2026-04-09",
      clockInAt: buildFixedSeoulDateTime("2026-04-09", "09:11:00"),
      clockInSource: "beacon",
      clockOutAt: buildFixedSeoulDateTime("2026-04-09", "17:12:00"),
      clockOutSource: "beacon",
      workMinutes: minutesBetween(
        buildFixedSeoulDateTime("2026-04-09", "09:11:00"),
        buildFixedSeoulDateTime("2026-04-09", "17:12:00"),
      ),
      manualRequestId: null,
    },
    {
      id: attendanceRecordId("emp_011", "2026-04-11"),
      employeeId: "emp_011",
      date: "2026-04-11",
      clockInAt: buildFixedSeoulDateTime("2026-04-11", "09:00:00"),
      clockInSource: "beacon",
      clockOutAt: buildFixedSeoulDateTime("2026-04-11", "17:40:00"),
      clockOutSource: "beacon",
      workMinutes: minutesBetween(
        buildFixedSeoulDateTime("2026-04-11", "09:00:00"),
        buildFixedSeoulDateTime("2026-04-11", "17:40:00"),
      ),
      manualRequestId: null,
    },
    {
      id: attendanceRecordId("emp_012", "2026-04-14"),
      employeeId: "emp_012",
      date: "2026-04-14",
      clockInAt: buildFixedSeoulDateTime("2026-04-14", "09:24:00"),
      clockInSource: "beacon",
      clockOutAt: buildFixedSeoulDateTime("2026-04-14", "18:10:00"),
      clockOutSource: "beacon",
      workMinutes: minutesBetween(
        buildFixedSeoulDateTime("2026-04-14", "09:24:00"),
        buildFixedSeoulDateTime("2026-04-14", "18:10:00"),
      ),
      manualRequestId: null,
    },
  ]),
);

const manualAttendanceRequests = deepFreeze(
  manualAttendanceRequestEntitySchema.array().parse([
    {
      id: manualRequestId("emp_007", "2026-04-03", "root"),
      employeeId: "emp_007",
      requestType: "manual_attendance",
      action: "clock_out",
      date: "2026-04-03",
      submittedAt: buildFixedSeoulDateTime("2026-04-03", "17:55:00"),
      requestedClockInAt: null,
      requestedClockOutAt: buildFixedSeoulDateTime("2026-04-03", "18:05:00"),
      reason: "Checkout beacon was unavailable after the shift ended.",
      status: "approved",
      reviewedAt: buildFixedSeoulDateTime("2026-04-04", "09:15:00"),
      reviewComment: null,
      rootRequestId: manualRequestId("emp_007", "2026-04-03", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: manualRequestId("emp_009", "2026-04-08", "root"),
      employeeId: "emp_009",
      requestType: "manual_attendance",
      action: "clock_in",
      date: "2026-04-08",
      submittedAt: buildFixedSeoulDateTime("2026-04-08", "11:05:00"),
      requestedClockInAt: buildFixedSeoulDateTime("2026-04-08", "09:08:00"),
      requestedClockOutAt: null,
      reason: "The beacon app did not detect the office entrance.",
      status: "rejected",
      reviewedAt: buildFixedSeoulDateTime("2026-04-08", "14:20:00"),
      reviewComment: "Please resubmit with a clearer arrival note.",
      rootRequestId: manualRequestId("emp_009", "2026-04-08", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: manualRequestId("emp_009", "2026-04-08", "resubmission"),
      employeeId: "emp_009",
      requestType: "manual_attendance",
      action: "clock_in",
      date: "2026-04-08",
      submittedAt: buildFixedSeoulDateTime("2026-04-08", "16:05:00"),
      requestedClockInAt: buildFixedSeoulDateTime("2026-04-08", "09:08:00"),
      requestedClockOutAt: null,
      reason:
        "I arrived at the office at 09:08 and the beacon still did not register.",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: manualRequestId("emp_009", "2026-04-08", "root"),
      parentRequestId: manualRequestId("emp_009", "2026-04-08", "root"),
      followUpKind: "resubmission",
      supersededByRequestId: null,
    },
    {
      id: manualRequestId("emp_010", "2026-04-09", "root"),
      employeeId: "emp_010",
      requestType: "manual_attendance",
      action: "clock_in",
      date: "2026-04-09",
      submittedAt: buildFixedSeoulDateTime("2026-04-09", "11:35:00"),
      requestedClockInAt: buildFixedSeoulDateTime("2026-04-09", "09:07:00"),
      requestedClockOutAt: null,
      reason:
        "I need to correct the missing morning attendance note before review.",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: manualRequestId("emp_010", "2026-04-09", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: manualRequestId("emp_011", "2026-04-07", "root"),
      employeeId: "emp_011",
      requestType: "manual_attendance",
      action: "both",
      date: "2026-04-07",
      submittedAt: buildFixedSeoulDateTime("2026-04-07", "18:50:00"),
      requestedClockInAt: buildFixedSeoulDateTime("2026-04-07", "09:04:00"),
      requestedClockOutAt: buildFixedSeoulDateTime("2026-04-07", "18:01:00"),
      reason:
        "Please correct both attendance facts from the office network outage.",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: manualRequestId("emp_011", "2026-04-07", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: manualRequestId("emp_010", "2026-04-13", "root"),
      employeeId: "emp_010",
      requestType: "manual_attendance",
      action: "clock_in",
      date: "2026-04-13",
      submittedAt: buildFixedSeoulDateTime("2026-04-13", "09:20:00"),
      requestedClockInAt: buildFixedSeoulDateTime("2026-04-13", "09:08:00"),
      requestedClockOutAt: null,
      reason: "Beacon connectivity failed during baseline check-in.",
      status: "rejected",
      reviewedAt: buildFixedSeoulDateTime("2026-04-13", "14:00:00"),
      reviewComment: "Please submit a follow-up if the beacon issue continues.",
      rootRequestId: manualRequestId("emp_010", "2026-04-13", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: manualRequestId("emp_010", "2026-04-13", "resubmission"),
      employeeId: "emp_010",
      requestType: "manual_attendance",
      action: "clock_in",
      date: "2026-04-13",
      submittedAt: buildFixedSeoulDateTime("2026-04-13", "16:35:00"),
      requestedClockInAt: buildFixedSeoulDateTime("2026-04-13", "09:08:00"),
      requestedClockOutAt: null,
      reason:
        "Resubmitting after the beacon outage to keep the correction chain linked.",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: manualRequestId("emp_010", "2026-04-13", "root"),
      parentRequestId: manualRequestId("emp_010", "2026-04-13", "root"),
      followUpKind: "resubmission",
      supersededByRequestId: null,
    },
  ]),
);

const leaveRequests = deepFreeze(
  leaveRequestEntitySchema.array().parse([
    {
      id: leaveRequestId("emp_001", "2026-04-15", "root"),
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-15",
      startAt: null,
      endAt: null,
      reason: "Need a full-day leave for a private appointment.",
      requestedAt: buildFixedSeoulDateTime("2026-04-13", "10:05:00"),
      status: "revision_requested",
      reviewedAt: buildFixedSeoulDateTime("2026-04-13", "16:10:00"),
      reviewComment: "Please include the exact leave window in the note.",
      rootRequestId: leaveRequestId("emp_001", "2026-04-15", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: leaveRequestId("emp_001", "2026-04-17", "root"),
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "hourly",
      date: "2026-04-17",
      startAt: buildFixedSeoulDateTime("2026-04-17", "13:00:00"),
      endAt: buildFixedSeoulDateTime("2026-04-17", "16:00:00"),
      reason: "Need a short afternoon leave for a personal appointment.",
      requestedAt: buildFixedSeoulDateTime("2026-04-15", "11:20:00"),
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: leaveRequestId("emp_001", "2026-04-17", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: leaveRequestId("emp_001", "2026-04-18", "root"),
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-18",
      startAt: null,
      endAt: null,
      reason: "Family appointment requires a full-day leave.",
      requestedAt: buildFixedSeoulDateTime("2026-04-13", "13:40:00"),
      status: "approved",
      reviewedAt: buildFixedSeoulDateTime("2026-04-14", "09:25:00"),
      reviewComment: null,
      rootRequestId: leaveRequestId("emp_001", "2026-04-18", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: leaveRequestId("emp_001", "2026-04-18", "change"),
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "hourly",
      date: "2026-04-18",
      startAt: buildFixedSeoulDateTime("2026-04-18", "12:00:00"),
      endAt: buildFixedSeoulDateTime("2026-04-18", "15:00:00"),
      reason: "Adjusting the approved leave to cover only the afternoon.",
      requestedAt: buildFixedSeoulDateTime("2026-04-15", "09:05:00"),
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: leaveRequestId("emp_001", "2026-04-18", "root"),
      parentRequestId: leaveRequestId("emp_001", "2026-04-18", "root"),
      followUpKind: "change",
      supersededByRequestId: null,
    },
    {
      id: leaveRequestId("emp_004", "2026-04-16", "root"),
      employeeId: "emp_004",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-16",
      startAt: null,
      endAt: null,
      reason: "Spring launch dry run requires a full-day absence.",
      requestedAt: buildFixedSeoulDateTime("2026-04-13", "09:30:00"),
      status: "approved",
      reviewedAt: buildFixedSeoulDateTime("2026-04-14", "10:30:00"),
      reviewComment: null,
      rootRequestId: leaveRequestId("emp_004", "2026-04-16", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: leaveRequestId("emp_004", "2026-04-16", "change"),
      employeeId: "emp_004",
      requestType: "leave",
      leaveType: "hourly",
      date: "2026-04-16",
      startAt: buildFixedSeoulDateTime("2026-04-16", "13:00:00"),
      endAt: buildFixedSeoulDateTime("2026-04-16", "16:00:00"),
      reason:
        "Adjusting the approved leave window for the afternoon briefings.",
      requestedAt: buildFixedSeoulDateTime("2026-04-15", "11:00:00"),
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: leaveRequestId("emp_004", "2026-04-16", "root"),
      parentRequestId: leaveRequestId("emp_004", "2026-04-16", "root"),
      followUpKind: "change",
      supersededByRequestId: null,
    },
    {
      id: leaveRequestId("emp_006", "2026-04-17", "root"),
      employeeId: "emp_006",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-17",
      startAt: null,
      endAt: null,
      reason: "Inventory audit support is pulling coverage from the team.",
      requestedAt: buildFixedSeoulDateTime("2026-04-13", "15:10:00"),
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: leaveRequestId("emp_006", "2026-04-17", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: leaveRequestId("emp_005", "2026-04-18", "root"),
      employeeId: "emp_005",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-18",
      startAt: null,
      endAt: null,
      reason: "Planned personal leave for the full workday.",
      requestedAt: buildFixedSeoulDateTime("2026-04-13", "16:20:00"),
      status: "approved",
      reviewedAt: buildFixedSeoulDateTime("2026-04-15", "09:10:00"),
      reviewComment: null,
      rootRequestId: leaveRequestId("emp_005", "2026-04-18", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: leaveRequestId("emp_010", "2026-04-20", "root"),
      employeeId: "emp_010",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-20",
      startAt: null,
      endAt: null,
      reason: "Family appointment on the final workday of the month window.",
      requestedAt: buildFixedSeoulDateTime("2026-04-16", "10:05:00"),
      status: "rejected",
      reviewedAt: buildFixedSeoulDateTime("2026-04-18", "13:40:00"),
      reviewComment: "Please resubmit after adjusting the staffing plan.",
      rootRequestId: leaveRequestId("emp_010", "2026-04-20", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: leaveRequestId("emp_010", "2026-04-20", "resubmission"),
      employeeId: "emp_010",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-20",
      startAt: null,
      endAt: null,
      reason:
        "Resubmitting the leave request with the same target date and updated note.",
      requestedAt: buildFixedSeoulDateTime("2026-04-19", "09:25:00"),
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: leaveRequestId("emp_010", "2026-04-20", "root"),
      parentRequestId: leaveRequestId("emp_010", "2026-04-20", "root"),
      followUpKind: "resubmission",
      supersededByRequestId: null,
    },
  ]),
);

const requestReviewEvents = deepFreeze(
  requestReviewEventEntitySchema.array().parse([
    {
      id: "request_review_manual_emp_007_2026-04-03",
      requestId: manualRequestId("emp_007", "2026-04-03", "root"),
      decision: "approve",
      reviewComment: null,
      reviewedAt: buildFixedSeoulDateTime("2026-04-04", "09:15:00"),
      reviewerId: "emp_012",
    },
    {
      id: "request_review_manual_emp_009_2026-04-08",
      requestId: manualRequestId("emp_009", "2026-04-08", "root"),
      decision: "reject",
      reviewComment: "Please resubmit with a clearer arrival note.",
      reviewedAt: buildFixedSeoulDateTime("2026-04-08", "14:20:00"),
      reviewerId: "emp_012",
    },
    {
      id: "request_review_manual_emp_010_2026-04-13",
      requestId: manualRequestId("emp_010", "2026-04-13", "root"),
      decision: "reject",
      reviewComment: "Please submit a follow-up if the beacon issue continues.",
      reviewedAt: buildFixedSeoulDateTime("2026-04-13", "14:00:00"),
      reviewerId: "emp_012",
    },
    {
      id: "request_review_leave_emp_004_2026-04-16",
      requestId: leaveRequestId("emp_004", "2026-04-16", "root"),
      decision: "approve",
      reviewComment: null,
      reviewedAt: buildFixedSeoulDateTime("2026-04-14", "10:30:00"),
      reviewerId: "emp_012",
    },
    {
      id: "request_review_leave_emp_001_2026-04-15",
      requestId: leaveRequestId("emp_001", "2026-04-15", "root"),
      decision: "request_revision",
      reviewComment: "Please include the exact leave window in the note.",
      reviewedAt: buildFixedSeoulDateTime("2026-04-13", "16:10:00"),
      reviewerId: "emp_012",
    },
    {
      id: "request_review_leave_emp_001_2026-04-18",
      requestId: leaveRequestId("emp_001", "2026-04-18", "root"),
      decision: "approve",
      reviewComment: null,
      reviewedAt: buildFixedSeoulDateTime("2026-04-14", "09:25:00"),
      reviewerId: "emp_012",
    },
    {
      id: "request_review_leave_emp_005_2026-04-18",
      requestId: leaveRequestId("emp_005", "2026-04-18", "root"),
      decision: "approve",
      reviewComment: null,
      reviewedAt: buildFixedSeoulDateTime("2026-04-15", "09:10:00"),
      reviewerId: "emp_012",
    },
    {
      id: "request_review_leave_emp_010_2026-04-20",
      requestId: leaveRequestId("emp_010", "2026-04-20", "root"),
      decision: "reject",
      reviewComment: "Please resubmit after adjusting the staffing plan.",
      reviewedAt: buildFixedSeoulDateTime("2026-04-18", "13:40:00"),
      reviewerId: "emp_012",
    },
  ]),
);

const companyEvents = deepFreeze(
  companyEventEntitySchema.array().parse([
    {
      id: "company_event_2026-04-16_spring-launch",
      date: "2026-04-16",
      title: "Spring Launch Dry Run",
    },
    {
      id: "company_event_2026-04-17_inventory-audit",
      date: "2026-04-17",
      title: "Quarterly Inventory Audit",
    },
  ]),
);

export const canonicalSeedWorld = deepFreeze({
  baselineDate: fixedSeoulBaselineDate,
  calendarWindow: fixedSeoulCalendarWindow,
  employees,
  expectedWorkdays,
  attendanceAttempts,
  attendanceRecords,
  manualAttendanceRequests,
  leaveRequests,
  requestReviewEvents,
  companyEvents,
});

export const seedScenarioAnchors = deepFreeze({
  previousDayMissingCheckout: {
    employeeId: "emp_001",
    recordDate: "2026-04-10",
    surfaceDate: "2026-04-13",
    attendanceRecordId: attendanceRecordId("emp_001", "2026-04-10"),
  },
  nextDayCheckout: {
    employeeId: "emp_002",
    recordDate: "2026-04-14",
    checkoutAttemptId: attendanceAttemptId(
      "emp_002",
      "2026-04-14",
      "clock_out",
      "success",
    ),
    closedAt: buildFixedSeoulDateTime("2026-04-15", "08:45:00"),
  },
  unresolvedFailedAttempt: {
    employeeId: "emp_003",
    date: "2026-04-16",
    attemptId: attendanceAttemptId(
      "emp_003",
      "2026-04-16",
      "clock_out",
      "failed",
    ),
  },
  companyEventSensitiveLeaveDate: {
    employeeId: "emp_004",
    date: "2026-04-16",
    eventId: "company_event_2026-04-16_spring-launch",
    activeRequestId: leaveRequestId("emp_004", "2026-04-16", "change"),
  },
  staffingSensitiveLeaveDate: {
    employeeId: "emp_006",
    date: "2026-04-17",
    activeRequestId: leaveRequestId("emp_006", "2026-04-17", "root"),
  },
  leaveWorkConflict: {
    employeeId: "emp_005",
    date: "2026-04-18",
    attendanceRecordId: attendanceRecordId("emp_005", "2026-04-18"),
    leaveRequestId: leaveRequestId("emp_005", "2026-04-18", "root"),
  },
  manualAttendanceResubmissionChain: {
    employeeId: "emp_009",
    rootRequestId: manualRequestId("emp_009", "2026-04-08", "root"),
    activeRequestId: manualRequestId("emp_009", "2026-04-08", "resubmission"),
  },
  pendingManualEdit: {
    employeeId: "emp_010",
    requestId: manualRequestId("emp_010", "2026-04-09", "root"),
  },
  pendingManualWithdraw: {
    employeeId: "emp_011",
    requestId: manualRequestId("emp_011", "2026-04-07", "root"),
  },
  approvedManualWriteback: {
    employeeId: "emp_007",
    requestId: manualRequestId("emp_007", "2026-04-03", "root"),
    attendanceRecordId: attendanceRecordId("emp_007", "2026-04-03"),
  },
  reviewedNonApprovedLeaveTrail: {
    employeeId: "emp_010",
    reviewedRequestId: leaveRequestId("emp_010", "2026-04-20", "root"),
    activeRequestId: leaveRequestId("emp_010", "2026-04-20", "resubmission"),
  },
});

export type CanonicalSeedWorld = typeof canonicalSeedWorld;
export type SeedScenarioAnchors = typeof seedScenarioAnchors;
