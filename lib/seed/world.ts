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

const manualBeaconFollowUpReviewComment =
  "비콘 문제가 계속되면 후속 정정 요청을 다시 제출해 주세요.";
const leaveWindowRevisionReviewComment =
  "메모에 정확한 휴가 시간을 함께 적어 주세요.";
const staffingPlanReviewComment =
  "운영 인력 계획을 조정한 뒤 다시 제출해 주세요.";
const springLaunchDryRunTitle = "봄 시즌 론칭 리허설";
const quarterlyInventoryAuditTitle = "분기 재고 실사";

const employees = deepFreeze(
  employeeEntitySchema.array().parse([
    {
      id: "emp_001",
      name: "박민지",
      department: "운영",
      role: "employee",
    },
    {
      id: "emp_002",
      name: "이준호",
      department: "엔지니어링",
      role: "employee",
    },
    {
      id: "emp_003",
      name: "최하나",
      department: "고객성공",
      role: "employee",
    },
    {
      id: "emp_004",
      name: "김승우",
      department: "영업",
      role: "employee",
    },
    {
      id: "emp_005",
      name: "강유나",
      department: "재무",
      role: "employee",
    },
    {
      id: "emp_006",
      name: "정대호",
      department: "프로덕트",
      role: "employee",
    },
    {
      id: "emp_007",
      name: "임지수",
      department: "운영",
      role: "employee",
    },
    {
      id: "emp_008",
      name: "신태양",
      department: "엔지니어링",
      role: "employee",
    },
    { id: "emp_009", name: "문소라", department: "인사", role: "employee" },
    {
      id: "emp_010",
      name: "백현우",
      department: "고객지원",
      role: "employee",
    },
    { id: "emp_011", name: "오나리", department: "재무", role: "employee" },
    { id: "emp_012", name: "한지원", department: "인재문화", role: "admin" },
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

type CompletedAttendanceDaySeed = Readonly<{
  clockInAt: string;
  clockOutAt: string;
  date: string;
  employeeId: string;
}>;

function buildCompletedAttendanceDaySeed(input: {
  clockInTime: string;
  clockOutTime: string;
  date: string;
  employeeId: string;
}): CompletedAttendanceDaySeed {
  return {
    clockInAt: buildFixedSeoulDateTime(input.date, input.clockInTime),
    clockOutAt: buildFixedSeoulDateTime(input.date, input.clockOutTime),
    date: input.date,
    employeeId: input.employeeId,
  };
}

const preBaselineAutoAttendanceExclusions = deepFreeze({
  emp_001: new Set([
    "2026-03-24",
    "2026-03-25",
    "2026-03-26",
    "2026-03-27",
    "2026-03-31",
    "2026-04-01",
    "2026-04-02",
    "2026-04-03",
    "2026-04-06",
    "2026-04-07",
    "2026-04-08",
    "2026-04-09",
    "2026-04-10",
  ]),
  emp_002: new Set(["2026-04-02"]),
  emp_004: new Set(["2026-04-01"]),
  emp_007: new Set(["2026-04-03"]),
  emp_008: new Set(["2026-04-09"]),
});

const defaultHistoricalCheckInTimes = ["08:57:00", "08:58:00", "08:59:00"];
const defaultHistoricalCheckOutTimes = ["18:02:00", "18:03:00", "18:04:00"];

const preBaselineCompletedAttendanceDays = deepFreeze(
  employees.flatMap((employee, employeeIndex) => {
    const excludedDates =
      preBaselineAutoAttendanceExclusions[
        employee.id as keyof typeof preBaselineAutoAttendanceExclusions
      ] ?? new Set<string>();
    const timeIndex = employeeIndex % defaultHistoricalCheckInTimes.length;

    return calendarDates
      .filter(
        (date) =>
          date < fixedSeoulBaselineDate &&
          !isWeekend(date) &&
          !excludedDates.has(date),
      )
      .map((date) =>
        buildCompletedAttendanceDaySeed({
          clockInTime: defaultHistoricalCheckInTimes[timeIndex]!,
          clockOutTime: defaultHistoricalCheckOutTimes[timeIndex]!,
          date,
          employeeId: employee.id,
        }),
      );
  }),
);

const emp001CompletedAttendanceDays = deepFreeze([
  {
    date: "2026-03-16",
    clockInAt: buildFixedSeoulDateTime("2026-03-16", "08:56:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-03-16", "18:01:00"),
  },
  {
    date: "2026-03-17",
    clockInAt: buildFixedSeoulDateTime("2026-03-17", "08:58:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-03-17", "18:04:00"),
  },
  {
    date: "2026-03-18",
    clockInAt: buildFixedSeoulDateTime("2026-03-18", "08:57:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-03-18", "18:02:00"),
  },
  {
    date: "2026-03-19",
    clockInAt: buildFixedSeoulDateTime("2026-03-19", "08:59:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-03-19", "18:00:00"),
  },
  {
    date: "2026-03-20",
    clockInAt: buildFixedSeoulDateTime("2026-03-20", "08:55:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-03-20", "18:05:00"),
  },
  {
    date: "2026-03-23",
    clockInAt: buildFixedSeoulDateTime("2026-03-23", "08:59:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-03-23", "18:03:00"),
  },
  {
    date: "2026-03-25",
    clockInAt: buildFixedSeoulDateTime("2026-03-25", "08:59:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-03-25", "18:11:00"),
  },
  {
    date: "2026-03-26",
    clockInAt: buildFixedSeoulDateTime("2026-03-26", "09:00:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-03-26", "18:05:00"),
  },
  {
    date: "2026-03-30",
    clockInAt: buildFixedSeoulDateTime("2026-03-30", "08:58:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-03-30", "18:06:00"),
  },
  {
    date: "2026-03-31",
    clockInAt: buildFixedSeoulDateTime("2026-03-31", "08:57:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-03-31", "18:04:00"),
  },
  {
    date: "2026-04-01",
    clockInAt: buildFixedSeoulDateTime("2026-04-01", "09:00:00"),
    clockOutAt: buildFixedSeoulDateTime("2026-04-01", "18:08:00"),
  },
  {
    date: "2026-04-02",
    clockInAt: buildFixedSeoulDateTime("2026-04-02", "08:59:00"),
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

const baselineWorkingCheckIns = deepFreeze([
  {
    employeeId: "emp_001",
    date: "2026-04-13",
    clockInAt: buildFixedSeoulDateTime("2026-04-13", "08:58:00"),
  },
  {
    employeeId: "emp_002",
    date: "2026-04-13",
    clockInAt: buildFixedSeoulDateTime("2026-04-13", "08:59:00"),
  },
  {
    employeeId: "emp_003",
    date: "2026-04-13",
    clockInAt: buildFixedSeoulDateTime("2026-04-13", "08:57:00"),
  },
  {
    employeeId: "emp_004",
    date: "2026-04-13",
    clockInAt: buildFixedSeoulDateTime("2026-04-13", "09:14:00"),
  },
  {
    employeeId: "emp_006",
    date: "2026-04-13",
    clockInAt: buildFixedSeoulDateTime("2026-04-13", "09:00:00"),
  },
  {
    employeeId: "emp_007",
    date: "2026-04-13",
    clockInAt: buildFixedSeoulDateTime("2026-04-13", "08:56:00"),
  },
  {
    employeeId: "emp_008",
    date: "2026-04-13",
    clockInAt: buildFixedSeoulDateTime("2026-04-13", "08:59:00"),
  },
  {
    employeeId: "emp_009",
    date: "2026-04-13",
    clockInAt: buildFixedSeoulDateTime("2026-04-13", "08:58:00"),
  },
  {
    employeeId: "emp_012",
    date: "2026-04-13",
    clockInAt: buildFixedSeoulDateTime("2026-04-13", "09:00:00"),
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
    {
      id: attendanceAttemptId("emp_001", "2026-04-13", "clock_in", "success"),
      employeeId: "emp_001",
      date: "2026-04-13",
      action: "clock_in",
      attemptedAt: buildFixedSeoulDateTime("2026-04-13", "09:02:00"),
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
    ...preBaselineCompletedAttendanceDays.flatMap((day) => [
      {
        id: attendanceAttemptId(
          day.employeeId,
          day.date,
          "clock_in",
          "success",
        ),
        employeeId: day.employeeId,
        date: day.date,
        action: "clock_in" as const,
        attemptedAt: day.clockInAt,
        status: "success" as const,
        failureReason: null,
      },
      {
        id: attendanceAttemptId(
          day.employeeId,
          day.date,
          "clock_out",
          "success",
        ),
        employeeId: day.employeeId,
        date: day.date,
        action: "clock_out" as const,
        attemptedAt: day.clockOutAt,
        status: "success" as const,
        failureReason: null,
      },
    ]),
    ...baselineWorkingCheckIns.map((entry) => ({
      id: attendanceAttemptId(
        entry.employeeId,
        entry.date,
        "clock_in",
        "success",
      ),
      employeeId: entry.employeeId,
      date: entry.date,
      action: "clock_in" as const,
      attemptedAt: entry.clockInAt,
      status: "success" as const,
      failureReason: null,
    })),
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
      failureReason: "퇴근 처리 중 비콘 연결이 끊겨 기록에 실패했어요.",
    },
    {
      id: attendanceAttemptId("emp_004", "2026-04-01", "clock_in", "success"),
      employeeId: "emp_004",
      date: "2026-04-01",
      action: "clock_in",
      attemptedAt: buildFixedSeoulDateTime("2026-04-01", "08:59:00"),
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
      attemptedAt: buildFixedSeoulDateTime("2026-04-04", "18:01:00"),
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
      attemptedAt: buildFixedSeoulDateTime("2026-04-09", "08:59:00"),
      status: "success",
      failureReason: null,
    },
    {
      id: attendanceAttemptId("emp_008", "2026-04-09", "clock_out", "success"),
      employeeId: "emp_008",
      date: "2026-04-09",
      action: "clock_out",
      attemptedAt: buildFixedSeoulDateTime("2026-04-09", "18:02:00"),
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
      failureReason: "휴대폰 앱이 비콘 서비스에 연결되지 않았어요.",
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
      attemptedAt: buildFixedSeoulDateTime("2026-04-11", "18:01:00"),
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
    {
      id: attendanceRecordId("emp_001", "2026-04-13"),
      employeeId: "emp_001",
      date: "2026-04-13",
      clockInAt: buildFixedSeoulDateTime("2026-04-13", "09:02:00"),
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
    ...preBaselineCompletedAttendanceDays.map((day) => ({
      id: attendanceRecordId(day.employeeId, day.date),
      employeeId: day.employeeId,
      date: day.date,
      clockInAt: day.clockInAt,
      clockInSource: "beacon" as const,
      clockOutAt: day.clockOutAt,
      clockOutSource: "beacon" as const,
      workMinutes: minutesBetween(day.clockInAt, day.clockOutAt),
      manualRequestId: null,
    })),
    ...baselineWorkingCheckIns.map((entry) => ({
      id: attendanceRecordId(entry.employeeId, entry.date),
      employeeId: entry.employeeId,
      date: entry.date,
      clockInAt: entry.clockInAt,
      clockInSource: "beacon" as const,
      clockOutAt: null,
      clockOutSource: null,
      workMinutes: null,
      manualRequestId: null,
    })),
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
      clockInAt: buildFixedSeoulDateTime("2026-04-01", "08:59:00"),
      clockInSource: "beacon",
      clockOutAt: buildFixedSeoulDateTime("2026-04-01", "18:20:00"),
      clockOutSource: "beacon",
      workMinutes: minutesBetween(
        buildFixedSeoulDateTime("2026-04-01", "08:59:00"),
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
      clockOutAt: buildFixedSeoulDateTime("2026-04-04", "18:01:00"),
      clockOutSource: "beacon",
      workMinutes: minutesBetween(
        buildFixedSeoulDateTime("2026-04-04", "09:01:00"),
        buildFixedSeoulDateTime("2026-04-04", "18:01:00"),
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
      clockInAt: buildFixedSeoulDateTime("2026-04-09", "08:59:00"),
      clockInSource: "beacon",
      clockOutAt: buildFixedSeoulDateTime("2026-04-09", "18:02:00"),
      clockOutSource: "beacon",
      workMinutes: minutesBetween(
        buildFixedSeoulDateTime("2026-04-09", "08:59:00"),
        buildFixedSeoulDateTime("2026-04-09", "18:02:00"),
      ),
      manualRequestId: null,
    },
    {
      id: attendanceRecordId("emp_011", "2026-04-11"),
      employeeId: "emp_011",
      date: "2026-04-11",
      clockInAt: buildFixedSeoulDateTime("2026-04-11", "09:00:00"),
      clockInSource: "beacon",
      clockOutAt: buildFixedSeoulDateTime("2026-04-11", "18:01:00"),
      clockOutSource: "beacon",
      workMinutes: minutesBetween(
        buildFixedSeoulDateTime("2026-04-11", "09:00:00"),
        buildFixedSeoulDateTime("2026-04-11", "18:01:00"),
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
      reason: "근무 종료 후 퇴근 비콘이 잡히지 않아 수동으로 요청했어요.",
      status: "approved",
      reviewedAt: buildFixedSeoulDateTime("2026-04-04", "09:15:00"),
      reviewComment: null,
      rootRequestId: manualRequestId("emp_007", "2026-04-03", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: manualRequestId("emp_010", "2026-04-17", "root"),
      employeeId: "emp_010",
      requestType: "manual_attendance",
      action: "clock_in",
      date: "2026-04-17",
      submittedAt: buildFixedSeoulDateTime("2026-04-13", "11:18:00"),
      requestedClockInAt: buildFixedSeoulDateTime("2026-04-17", "09:07:00"),
      requestedClockOutAt: null,
      reason:
        "정확한 출근 메모를 확인한 뒤 수정할 수 있도록 임시로 남겨둔 요청이에요.",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: manualRequestId("emp_010", "2026-04-17", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: manualRequestId("emp_011", "2026-04-20", "root"),
      employeeId: "emp_011",
      requestType: "manual_attendance",
      action: "both",
      date: "2026-04-20",
      submittedAt: buildFixedSeoulDateTime("2026-04-13", "11:42:00"),
      requestedClockInAt: buildFixedSeoulDateTime("2026-04-20", "09:04:00"),
      requestedClockOutAt: buildFixedSeoulDateTime("2026-04-20", "18:01:00"),
      reason:
        "필요하면 철회할 수 있도록 하루 전체 정정 요청을 열어둔 상태예요.",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: manualRequestId("emp_011", "2026-04-20", "root"),
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
      submittedAt: buildFixedSeoulDateTime("2026-04-13", "09:12:00"),
      requestedClockInAt: buildFixedSeoulDateTime("2026-04-13", "09:08:00"),
      requestedClockOutAt: null,
      reason:
        "기준일 출근 시 비콘 연결이 실패해서 출근 시간을 정정 요청했어요.",
      status: "rejected",
      reviewedAt: buildFixedSeoulDateTime("2026-04-13", "10:05:00"),
      reviewComment: manualBeaconFollowUpReviewComment,
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
      submittedAt: buildFixedSeoulDateTime("2026-04-13", "10:28:00"),
      requestedClockInAt: buildFixedSeoulDateTime("2026-04-13", "09:08:00"),
      requestedClockOutAt: null,
      reason: "비콘 장애 이후 같은 정정 건으로 다시 제출하는 요청이에요.",
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
      id: leaveRequestId("emp_001", "2026-03-24", "root"),
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-03-24",
      startAt: null,
      endAt: null,
      reason: "시드 기본 연차 예시로 넣어 둔 하루 연차예요.",
      requestedAt: buildFixedSeoulDateTime("2026-03-20", "15:00:00"),
      status: "approved",
      reviewedAt: buildFixedSeoulDateTime("2026-03-21", "10:30:00"),
      reviewComment: null,
      rootRequestId: leaveRequestId("emp_001", "2026-03-24", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: leaveRequestId("emp_005", "2026-04-13", "root"),
      employeeId: "emp_005",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-13",
      startAt: null,
      endAt: null,
      reason: "기준일 월요일 근무에 맞춰 승인된 하루 연차예요.",
      requestedAt: buildFixedSeoulDateTime("2026-04-10", "14:10:00"),
      status: "approved",
      reviewedAt: buildFixedSeoulDateTime("2026-04-10", "17:20:00"),
      reviewComment: null,
      rootRequestId: leaveRequestId("emp_005", "2026-04-13", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: leaveRequestId("emp_001", "2026-04-15", "root"),
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "annual",
      date: "2026-04-15",
      startAt: null,
      endAt: null,
      reason: "개인 일정으로 하루 연차가 필요해요.",
      requestedAt: buildFixedSeoulDateTime("2026-04-13", "10:05:00"),
      status: "revision_requested",
      reviewedAt: buildFixedSeoulDateTime("2026-04-13", "16:10:00"),
      reviewComment: leaveWindowRevisionReviewComment,
      rootRequestId: leaveRequestId("emp_001", "2026-04-15", "root"),
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    },
    {
      id: leaveRequestId("emp_001", "2026-04-07", "root"),
      employeeId: "emp_001",
      requestType: "leave",
      leaveType: "hourly",
      date: "2026-04-07",
      startAt: buildFixedSeoulDateTime("2026-04-07", "13:00:00"),
      endAt: buildFixedSeoulDateTime("2026-04-07", "16:00:00"),
      reason: "시드 기본 시간차 예시로 넣어 둔 요청이에요.",
      requestedAt: buildFixedSeoulDateTime("2026-04-05", "11:20:00"),
      status: "approved",
      reviewedAt: buildFixedSeoulDateTime("2026-04-06", "09:40:00"),
      reviewComment: null,
      rootRequestId: leaveRequestId("emp_001", "2026-04-07", "root"),
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
      reason: "개인 일정으로 오후 시간차가 필요해요.",
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
      reason: "가족 일정으로 하루 연차를 사용하려고 해요.",
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
      reason: "이미 승인된 휴가를 오후 시간만 반영하도록 변경하고 싶어요.",
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
      reason: "봄 시즌 론칭 리허설 일정 때문에 하루 자리를 비워야 해요.",
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
      reason: "오후 브리핑 일정에 맞춰 승인된 휴가 시간을 조정하고 싶어요.",
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
      reason: "재고 실사 지원 일정으로 하루 연차를 요청해요.",
      requestedAt: buildFixedSeoulDateTime("2026-04-13", "10:40:00"),
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
      reason: "개인 일정으로 하루 연차를 사용할 예정이에요.",
      requestedAt: buildFixedSeoulDateTime("2026-04-13", "11:10:00"),
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
      reason: "월말 마지막 근무일에 가족 일정이 있어 연차를 요청해요.",
      requestedAt: buildFixedSeoulDateTime("2026-04-16", "10:05:00"),
      status: "rejected",
      reviewedAt: buildFixedSeoulDateTime("2026-04-18", "13:40:00"),
      reviewComment: staffingPlanReviewComment,
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
      reason: "같은 날짜로 메모를 보완해 다시 제출한 휴가 요청이에요.",
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
      id: "request_review_manual_emp_010_2026-04-13",
      requestId: manualRequestId("emp_010", "2026-04-13", "root"),
      decision: "reject",
      reviewComment: manualBeaconFollowUpReviewComment,
      reviewedAt: buildFixedSeoulDateTime("2026-04-13", "10:05:00"),
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
      reviewComment: leaveWindowRevisionReviewComment,
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
      reviewComment: staffingPlanReviewComment,
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
      title: springLaunchDryRunTitle,
    },
    {
      id: "company_event_2026-04-17_inventory-audit",
      date: "2026-04-17",
      title: quarterlyInventoryAuditTitle,
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
    employeeId: "emp_010",
    rootRequestId: manualRequestId("emp_010", "2026-04-13", "root"),
    activeRequestId: manualRequestId("emp_010", "2026-04-13", "resubmission"),
  },
  pendingManualEdit: {
    employeeId: "emp_010",
    requestId: manualRequestId("emp_010", "2026-04-17", "root"),
  },
  pendingManualWithdraw: {
    employeeId: "emp_011",
    requestId: manualRequestId("emp_011", "2026-04-20", "root"),
  },
  defaultEmployeeAnnualLeave: {
    employeeId: "emp_001",
    date: "2026-03-24",
    requestId: leaveRequestId("emp_001", "2026-03-24", "root"),
  },
  defaultEmployeeHourlyLeave: {
    employeeId: "emp_001",
    date: "2026-04-07",
    requestId: leaveRequestId("emp_001", "2026-04-07", "root"),
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
