import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AttendancePageClient } from "@/app/(erp)/(employee)/attendance/_components/attendance-page-client";
import type { AttendancePageData } from "@/lib/attendance/page-data";
import type {
  AttendanceAttempt,
  AttendanceDisplay,
  AttendanceSurfaceManualRequestResource,
  ExpectedWorkday,
  PreviousDayOpenRecord,
} from "@/lib/contracts/shared";

const navigation = vi.hoisted(() => ({
  back: vi.fn(),
  forward: vi.fn(),
  pathname: "/attendance",
  prefetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

const api = vi.hoisted(() => ({
  getAttendanceHistory: vi.fn(),
  getAttendanceToday: vi.fn(),
  createManualAttendanceRequest: vi.fn(),
  updateManualAttendanceRequest: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({
    push: navigation.push,
    replace: navigation.replace,
    refresh: navigation.refresh,
    prefetch: navigation.prefetch,
    back: navigation.back,
    forward: navigation.forward,
  }),
}));

vi.mock("@/lib/attendance/api-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/attendance/api-client")
  >("@/lib/attendance/api-client");

  return {
    ...actual,
    getAttendanceHistory: api.getAttendanceHistory,
    getAttendanceToday: api.getAttendanceToday,
    createManualAttendanceRequest: api.createManualAttendanceRequest,
    updateManualAttendanceRequest: api.updateManualAttendanceRequest,
  };
});

function createExpectedWorkday(
  overrides: Partial<ExpectedWorkday> = {},
): ExpectedWorkday {
  return {
    isWorkday: true,
    expectedClockInAt: "2026-04-13T09:00:00+09:00",
    expectedClockOutAt: "2026-04-13T18:00:00+09:00",
    adjustedClockInAt: "2026-04-13T09:00:00+09:00",
    adjustedClockOutAt: "2026-04-13T18:00:00+09:00",
    countsTowardAdminSummary: true,
    leaveCoverage: null,
    ...overrides,
  };
}

function createDisplay(
  overrides: Partial<AttendanceDisplay> = {},
): AttendanceDisplay {
  return {
    phase: "before_check_in",
    flags: [],
    activeExceptions: [],
    nextAction: {
      type: "clock_in",
      relatedRequestId: null,
    },
    ...overrides,
  };
}

function createPreviousDayOpenRecord(
  overrides: Partial<PreviousDayOpenRecord> = {},
): PreviousDayOpenRecord {
  return {
    date: "2026-04-10",
    clockInAt: "2026-04-10T09:04:00+09:00",
    clockOutAt: null,
    expectedClockOutAt: "2026-04-10T18:00:00+09:00",
    ...overrides,
  };
}

function createFailedAttempt(
  overrides: Partial<Extract<AttendanceAttempt, { status: "failed" }>> = {},
): Extract<AttendanceAttempt, { status: "failed" }> {
  return {
    id: "attempt_failed_001",
    date: "2026-04-13",
    action: "clock_in",
    attemptedAt: "2026-04-13T09:05:00+09:00",
    status: "failed",
    failureReason: "BLE beacon not detected",
    ...overrides,
  };
}

function createManualRequest(
  overrides: Partial<AttendanceSurfaceManualRequestResource> = {},
): AttendanceSurfaceManualRequestResource {
  return {
    id: "manual_request_emp_001_2026-04-13_root",
    requestType: "manual_attendance",
    action: "clock_in",
    date: "2026-04-13",
    submittedAt: "2026-04-13T10:05:00+09:00",
    requestedClockInAt: "2026-04-13T09:05:00+09:00",
    requestedClockOutAt: null,
    reason: "Beacon was unavailable during check-in.",
    status: "pending",
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: "manual_request_emp_001_2026-04-13_root",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
    activeRequestId: "manual_request_emp_001_2026-04-13_root",
    activeStatus: "pending",
    effectiveRequestId: "manual_request_emp_001_2026-04-13_root",
    effectiveStatus: "pending",
    governingReviewComment: null,
    hasActiveFollowUp: false,
    nextAction: "admin_review",
    ...overrides,
  };
}

function createPageData(
  overrides: Partial<AttendancePageData> = {},
): AttendancePageData {
  return {
    date: "2026-04-13",
    view: "week",
    historyRange: {
      from: "2026-04-07",
      to: "2026-04-13",
    },
    today: {
      date: "2026-04-13",
      employee: {
        id: "emp_001",
        name: "Minji Park",
        department: "Operations",
      },
      expectedWorkday: createExpectedWorkday(),
      previousDayOpenRecord: createPreviousDayOpenRecord(),
      todayRecord: null,
      attempts: [],
      manualRequest: null,
      display: createDisplay({
        activeExceptions: ["previous_day_checkout_missing", "not_checked_in"],
        nextAction: {
          type: "resolve_previous_day_checkout",
          relatedRequestId: null,
        },
      }),
    },
    history: {
      from: "2026-04-07",
      to: "2026-04-13",
      records: [
        {
          date: "2026-04-13",
          expectedWorkday: createExpectedWorkday(),
          record: null,
          manualRequest: null,
          display: createDisplay({
            activeExceptions: ["not_checked_in"],
          }),
        },
        {
          date: "2026-04-09",
          expectedWorkday: createExpectedWorkday({
            expectedClockInAt: "2026-04-09T09:00:00+09:00",
            expectedClockOutAt: "2026-04-09T18:00:00+09:00",
            adjustedClockInAt: "2026-04-09T09:00:00+09:00",
            adjustedClockOutAt: "2026-04-09T18:00:00+09:00",
          }),
          record: null,
          manualRequest: null,
          display: createDisplay({
            activeExceptions: ["absent"],
            nextAction: {
              type: "submit_manual_request",
              relatedRequestId: null,
            },
          }),
        },
      ],
    },
    ...overrides,
  };
}

function createSameDayCorrectionPageData(
  overrides: Partial<AttendancePageData> = {},
): AttendancePageData {
  const baseData = createPageData();

  return {
    ...baseData,
    today: {
      ...baseData.today,
      previousDayOpenRecord: null,
      manualRequest: null,
      display: createDisplay({
        activeExceptions: ["not_checked_in"],
        nextAction: {
          type: "submit_manual_request",
          relatedRequestId: null,
        },
      }),
    },
    history: {
      ...baseData.history,
      records: [
        {
          date: "2026-04-13",
          expectedWorkday: createExpectedWorkday(),
          record: null,
          manualRequest: null,
          display: createDisplay({
            activeExceptions: ["not_checked_in"],
            nextAction: {
              type: "submit_manual_request",
              relatedRequestId: null,
            },
          }),
        },
        ...baseData.history.records.filter(
          (record) => record.date !== "2026-04-13",
        ),
      ],
    },
    ...overrides,
  };
}

function createSameDayPendingPageData(
  requestOverrides: Partial<AttendanceSurfaceManualRequestResource> = {},
  overrides: Partial<AttendancePageData> = {},
): AttendancePageData {
  const baseData = createSameDayCorrectionPageData();
  const request = createManualRequest(requestOverrides);

  return {
    ...baseData,
    today: {
      ...baseData.today,
      manualRequest: request,
      display: createDisplay({
        activeExceptions: ["manual_request_pending", "not_checked_in"],
        nextAction: {
          type: "review_request_status",
          relatedRequestId: request.id,
        },
      }),
    },
    history: {
      ...baseData.history,
      records: [
        {
          date: "2026-04-13",
          expectedWorkday: createExpectedWorkday(),
          record: null,
          manualRequest: createManualRequest(requestOverrides),
          display: createDisplay({
            activeExceptions: ["manual_request_pending", "not_checked_in"],
            nextAction: {
              type: "review_request_status",
              relatedRequestId: request.id,
            },
          }),
        },
        ...baseData.history.records.filter(
          (record) => record.date !== "2026-04-13",
        ),
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  navigation.pathname = "/attendance";
  api.getAttendanceToday.mockResolvedValue(createPageData().today);
  api.getAttendanceHistory.mockResolvedValue(createPageData().history);
  api.createManualAttendanceRequest.mockResolvedValue({});
  api.updateManualAttendanceRequest.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AttendancePageClient", () => {
  it("renders the today card above the carry-over exception stack", () => {
    render(<AttendancePageClient initialData={createPageData()} />);

    expect(screen.getByText("근태 관리")).toBeInTheDocument();
    expect(
      screen.getByText("오늘의 근무 상태와 기록을 확인하고 관리합니다"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("어제 퇴근 기록이 아직 없어요"),
    ).toBeInTheDocument();
    expect(screen.getByText("출퇴근 이력")).toBeInTheDocument();
  });

  it("shows beacon authentication status and current worked time in the today card", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-13T12:15:00+09:00"));

    const pageData = createPageData({
      today: {
        ...createPageData().today,
        todayRecord: {
          id: "attendance_record_emp_001_2026-04-13",
          date: "2026-04-13",
          clockInAt: "2026-04-13T09:00:00+09:00",
          clockInSource: "beacon",
          clockOutAt: null,
          clockOutSource: null,
          workMinutes: 180,
        },
      },
    });

    render(<AttendancePageClient initialData={pageData} />);

    expect(screen.getByText("비콘 인증 여부")).toBeInTheDocument();
    expect(screen.getByText("인증됨")).toBeInTheDocument();
    expect(screen.getByText("오늘 근무한 시간")).toBeInTheDocument();
    expect(screen.getByText("3시간 15분")).toBeInTheDocument();
    expect(
      screen.getAllByText("퇴근 시간")[0]?.closest("div"),
    ).toHaveTextContent("퇴근 시간-");
    expect(
      screen.queryByRole("button", { name: /우선 확인:/ }),
    ).not.toBeInTheDocument();
  });

  it("renders special notes, leave usage, and dash placeholders in history rows", () => {
    const pageData = createPageData({
      history: {
        ...createPageData().history,
        records: [
          {
            date: "2026-04-11",
            expectedWorkday: createExpectedWorkday({
              isWorkday: false,
              expectedClockInAt: null,
              expectedClockOutAt: null,
              adjustedClockInAt: null,
              adjustedClockOutAt: null,
            }),
            record: null,
            manualRequest: null,
            display: createDisplay({
              phase: "non_workday",
              activeExceptions: [],
              nextAction: {
                type: "wait",
                relatedRequestId: null,
              },
            }),
          },
          {
            date: "2026-04-12",
            expectedWorkday: createExpectedWorkday({
              leaveCoverage: {
                requestId: "leave_request_annual_001",
                leaveType: "annual",
                startAt: "2026-04-12T09:00:00+09:00",
                endAt: "2026-04-12T18:00:00+09:00",
              },
            }),
            record: null,
            manualRequest: null,
            display: createDisplay({
              nextAction: {
                type: "wait",
                relatedRequestId: null,
              },
            }),
          },
        ],
      },
    });

    render(<AttendancePageClient initialData={pageData} />);

    expect(
      screen.getByRole("columnheader", { name: "특이사항" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "정정하기" })).toHaveLength(2);
    expect(
      screen.getByRole("columnheader", { name: "휴가 사용" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "출근 시간" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "퇴근 시간" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "총 근무 시간" }),
    ).toBeInTheDocument();

    const holidayRow = screen.getByText("휴일").closest("tr");
    const annualLeaveRow = screen.getByText("연차").closest("tr");

    expect(holidayRow).not.toBeNull();
    expect(annualLeaveRow).not.toBeNull();
    expect(
      within(holidayRow as HTMLElement).getAllByText("-").length,
    ).toBeGreaterThan(0);
  });

  it("sorts history newest first and limits row statuses to the planned set", () => {
    const pageData = createPageData({
      history: {
        ...createPageData().history,
        records: [
          {
            date: "2026-04-10",
            expectedWorkday: createExpectedWorkday({
              expectedClockInAt: "2026-04-10T09:00:00+09:00",
              expectedClockOutAt: "2026-04-10T18:00:00+09:00",
              adjustedClockInAt: "2026-04-10T09:00:00+09:00",
              adjustedClockOutAt: "2026-04-10T18:00:00+09:00",
            }),
            record: {
              id: "attendance_record_emp_001_2026-04-10",
              date: "2026-04-10",
              clockInAt: "2026-04-10T09:08:00+09:00",
              clockInSource: "beacon",
              clockOutAt: null,
              clockOutSource: null,
              workMinutes: null,
            },
            manualRequest: null,
            display: createDisplay({
              flags: ["late"],
              activeExceptions: ["previous_day_checkout_missing"],
            }),
          },
          {
            date: "2026-04-13",
            expectedWorkday: createExpectedWorkday(),
            record: {
              id: "attendance_record_emp_001_2026-04-13",
              date: "2026-04-13",
              clockInAt: "2026-04-13T09:00:00+09:00",
              clockInSource: "beacon",
              clockOutAt: "2026-04-13T18:00:00+09:00",
              clockOutSource: "beacon",
              workMinutes: 540,
            },
            manualRequest: null,
            display: createDisplay({
              phase: "checked_out",
              nextAction: {
                type: "wait",
                relatedRequestId: null,
              },
            }),
          },
          {
            date: "2026-04-09",
            expectedWorkday: createExpectedWorkday({
              expectedClockInAt: "2026-04-09T09:00:00+09:00",
              expectedClockOutAt: "2026-04-09T18:00:00+09:00",
              adjustedClockInAt: "2026-04-09T09:00:00+09:00",
              adjustedClockOutAt: "2026-04-09T18:00:00+09:00",
            }),
            record: null,
            manualRequest: null,
            display: createDisplay({
              activeExceptions: ["absent"],
              nextAction: {
                type: "submit_manual_request",
                relatedRequestId: null,
              },
            }),
          },
        ],
      },
    });

    render(<AttendancePageClient initialData={pageData} />);

    const rows = screen.getAllByRole("row");

    expect(rows[1]).toHaveTextContent("2026.04.13");
    expect(rows[2]).toHaveTextContent("2026.04.10");
    expect(rows[3]).toHaveTextContent("2026.04.09");

    const correctionRow = screen.getByText("퇴근 누락").closest("tr");

    expect(correctionRow).not.toBeNull();
    expect(correctionRow).toHaveClass("bg-status-danger-soft/42");
    expect(
      within(correctionRow as HTMLElement).getByText("정정 필요"),
    ).toBeInTheDocument();
    expect(
      within(correctionRow as HTMLElement).getByText("지각"),
    ).toBeInTheDocument();
    expect(
      within(correctionRow as HTMLElement).getByRole("button", {
        name: "정정하기",
      }),
    ).toBeInTheDocument();

    const absentRow = screen.getByText("결근").closest("tr");

    expect(absentRow).not.toBeNull();
    expect(absentRow).toHaveClass("bg-status-danger-soft/42");
    expect(
      within(rows[1] as HTMLElement).getByText("정상"),
    ).toBeInTheDocument();
    expect(
      within(rows[1] as HTMLElement).getByRole("button", {
        name: "정정하기",
      }),
    ).toBeInTheDocument();
  });

  it("keeps failed attempts and missing check-ins as separate surfaces", () => {
    render(
      <AttendancePageClient
        initialData={createPageData({
          today: {
            ...createPageData().today,
            previousDayOpenRecord: null,
            attempts: [createFailedAttempt()],
            display: createDisplay({
              activeExceptions: ["attempt_failed", "not_checked_in"],
            }),
          },
        })}
      />,
    );

    expect(screen.getByText("비콘을 찾을 수 없어요")).toBeInTheDocument();
    expect(
      screen.getByText("오늘 출근 기록이 아직 없어요"),
    ).toBeInTheDocument();
  });

  it("renders pending history rows with warning emphasis and a request-view action", () => {
    render(
      <AttendancePageClient
        initialData={createPageData({
          history: {
            ...createPageData().history,
            records: [
              {
                date: "2026-04-10",
                expectedWorkday: createExpectedWorkday({
                  expectedClockInAt: "2026-04-10T09:00:00+09:00",
                  expectedClockOutAt: "2026-04-10T18:00:00+09:00",
                  adjustedClockInAt: "2026-04-10T09:00:00+09:00",
                  adjustedClockOutAt: "2026-04-10T18:00:00+09:00",
                }),
                record: null,
                manualRequest: createManualRequest({
                  id: "manual_request_emp_001_2026-04-10_root",
                  date: "2026-04-10",
                  action: "both",
                  requestedClockInAt: "2026-04-10T09:03:00+09:00",
                  requestedClockOutAt: "2026-04-10T18:04:00+09:00",
                  reason: "Beacon retry details were attached for review.",
                  rootRequestId: "manual_request_emp_001_2026-04-10_root",
                  activeRequestId: "manual_request_emp_001_2026-04-10_root",
                  effectiveRequestId: "manual_request_emp_001_2026-04-10_root",
                }),
                display: createDisplay({
                  activeExceptions: ["manual_request_pending", "absent"],
                  nextAction: {
                    type: "review_request_status",
                    relatedRequestId: "manual_request_emp_001_2026-04-10_root",
                  },
                }),
              },
            ],
          },
        })}
      />,
    );

    const pendingRow = screen.getByText("정정 요청됨").closest("tr");

    expect(pendingRow).not.toBeNull();
    expect(pendingRow).toHaveClass("bg-status-warning-soft/42");
    expect(
      within(pendingRow as HTMLElement).queryByText("정정 필요"),
    ).not.toBeInTheDocument();
    expect(
      within(pendingRow as HTMLElement).getByText("결근"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(pendingRow as HTMLElement).getByRole("button", {
        name: "요청 보기",
      }),
    );

    const sheet = within(
      document.body.querySelector('[data-slot="sheet-content"]') as HTMLElement,
    );

    expect(
      sheet.getByText("Beacon retry details were attached for review."),
    ).toBeInTheDocument();
    expect(
      sheet.getByRole("button", { name: "내용 수정" }),
    ).toBeInTheDocument();
  });

  it("suppresses generic correction-needed chips on same-day rows after a pending request is submitted", () => {
    render(
      <AttendancePageClient
        initialData={createPageData({
          history: {
            ...createPageData().history,
            records: [
              {
                date: "2026-04-13",
                expectedWorkday: createExpectedWorkday(),
                record: null,
                manualRequest: createManualRequest(),
                display: createDisplay({
                  activeExceptions: [
                    "manual_request_pending",
                    "not_checked_in",
                  ],
                  nextAction: {
                    type: "review_request_status",
                    relatedRequestId: "manual_request_emp_001_2026-04-13_root",
                  },
                }),
              },
            ],
          },
        })}
      />,
    );

    const pendingRow = screen.getByText("정정 요청됨").closest("tr");

    expect(pendingRow).not.toBeNull();
    expect(
      within(pendingRow as HTMLElement).queryByText("정정 필요"),
    ).not.toBeInTheDocument();
    expect(
      within(pendingRow as HTMLElement).getByRole("button", {
        name: "요청 보기",
      }),
    ).toBeInTheDocument();
  });

  it("adds historical issue rows into the exception stack", () => {
    render(
      <AttendancePageClient
        initialData={createPageData({
          history: {
            ...createPageData().history,
            records: [
              {
                date: "2026-04-13",
                expectedWorkday: createExpectedWorkday(),
                record: null,
                manualRequest: null,
                display: createDisplay({
                  activeExceptions: ["not_checked_in"],
                }),
              },
              {
                date: "2026-04-11",
                expectedWorkday: createExpectedWorkday({
                  expectedClockInAt: "2026-04-11T09:00:00+09:00",
                  expectedClockOutAt: "2026-04-11T18:00:00+09:00",
                  adjustedClockInAt: "2026-04-11T09:00:00+09:00",
                  adjustedClockOutAt: "2026-04-11T18:00:00+09:00",
                }),
                record: {
                  id: "attendance_record_emp_001_2026-04-11",
                  date: "2026-04-11",
                  clockInAt: "2026-04-11T09:07:00+09:00",
                  clockInSource: "beacon",
                  clockOutAt: "2026-04-11T18:02:00+09:00",
                  clockOutSource: "beacon",
                  workMinutes: 535,
                },
                manualRequest: null,
                display: createDisplay({
                  phase: "checked_out",
                  flags: ["late"],
                  nextAction: {
                    type: "wait",
                    relatedRequestId: null,
                  },
                }),
              },
              {
                date: "2026-04-09",
                expectedWorkday: createExpectedWorkday({
                  expectedClockInAt: "2026-04-09T09:00:00+09:00",
                  expectedClockOutAt: "2026-04-09T18:00:00+09:00",
                  adjustedClockInAt: "2026-04-09T09:00:00+09:00",
                  adjustedClockOutAt: "2026-04-09T18:00:00+09:00",
                }),
                record: null,
                manualRequest: null,
                display: createDisplay({
                  activeExceptions: ["absent"],
                  nextAction: {
                    type: "submit_manual_request",
                    relatedRequestId: null,
                  },
                }),
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText("지금 확인할 예외가 있어요")).toBeInTheDocument();
    expect(
      screen.getByText(
        "결근 상태가 보여서 이 날짜 기록을 열어서 정정할 수 있어요",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "지각 상태가 보여서 이 날짜 기록을 열어서 정정할 수 있어요",
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps warning pending-request rail cards below destructive historical issues", () => {
    render(
      <AttendancePageClient
        initialData={createPageData({
          today: {
            ...createPageData().today,
            previousDayOpenRecord: null,
            manualRequest: createManualRequest({
              reason: "Today pending request should stay below red issues.",
            }),
            display: createDisplay({
              activeExceptions: ["manual_request_pending"],
              nextAction: {
                type: "review_request_status",
                relatedRequestId: "manual_request_emp_001_2026-04-13_root",
              },
            }),
          },
          history: {
            ...createPageData().history,
            records: [
              {
                date: "2026-04-10",
                expectedWorkday: createExpectedWorkday({
                  expectedClockInAt: "2026-04-10T09:00:00+09:00",
                  expectedClockOutAt: "2026-04-10T18:00:00+09:00",
                  adjustedClockInAt: "2026-04-10T09:00:00+09:00",
                  adjustedClockOutAt: "2026-04-10T18:00:00+09:00",
                }),
                record: null,
                manualRequest: null,
                display: createDisplay({
                  activeExceptions: ["absent"],
                  nextAction: {
                    type: "submit_manual_request",
                    relatedRequestId: null,
                  },
                }),
              },
              {
                date: "2026-04-09",
                expectedWorkday: createExpectedWorkday({
                  expectedClockInAt: "2026-04-09T09:00:00+09:00",
                  expectedClockOutAt: "2026-04-09T18:00:00+09:00",
                  adjustedClockInAt: "2026-04-09T09:00:00+09:00",
                  adjustedClockOutAt: "2026-04-09T18:00:00+09:00",
                }),
                record: null,
                manualRequest: createManualRequest({
                  id: "manual_request_emp_001_2026-04-09_root",
                  date: "2026-04-09",
                  action: "both",
                  requestedClockInAt: "2026-04-09T09:04:00+09:00",
                  requestedClockOutAt: "2026-04-09T18:06:00+09:00",
                  reason: "History pending request should render as warning.",
                  rootRequestId: "manual_request_emp_001_2026-04-09_root",
                  activeRequestId: "manual_request_emp_001_2026-04-09_root",
                  effectiveRequestId: "manual_request_emp_001_2026-04-09_root",
                }),
                display: createDisplay({
                  activeExceptions: ["manual_request_pending", "absent"],
                  nextAction: {
                    type: "review_request_status",
                    relatedRequestId: "manual_request_emp_001_2026-04-09_root",
                  },
                }),
              },
            ],
          },
        })}
      />,
    );

    const exceptionStack = screen
      .getByText("지금 확인할 예외가 있어요")
      .closest("section");

    expect(exceptionStack).not.toBeNull();
    expect(
      within(exceptionStack as HTMLElement).getAllByText("정정 요청중이에요"),
    ).toHaveLength(2);

    const stackButtons = within(exceptionStack as HTMLElement).getAllByRole(
      "button",
    );
    const destructiveIndex = stackButtons.findIndex(
      (button) => button.textContent === "정정하기",
    );
    const warningIndices = stackButtons.flatMap((button, index) =>
      button.textContent === "요청 보기" ? [index] : [],
    );

    expect(destructiveIndex).toBeGreaterThanOrEqual(0);
    expect(warningIndices.length).toBe(2);
    expect(warningIndices.every((index) => index > destructiveIndex)).toBe(
      true,
    );
  });

  it("opens carry-over correction with the prior date and clock-out defaults", () => {
    render(<AttendancePageClient initialData={createPageData()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "어제 퇴근 시간 정정 요청" }),
    );

    const sheet = within(
      document.body.querySelector('[data-slot="sheet-content"]') as HTMLElement,
    );

    expect(sheet.getByText("어제 퇴근 기록이 아직 없어요")).toBeInTheDocument();
    expect(sheet.getByLabelText("대상 날짜")).toHaveValue("2026-04-10");
    expect(sheet.getByLabelText("퇴근 시간")).toHaveValue("18:00");
  });

  it("updates the URL when switching the history range", async () => {
    render(<AttendancePageClient initialData={createPageData()} />);

    fireEvent.click(screen.getByRole("radio", { name: "30일" }));

    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith("/attendance?view=month");
    });
  });

  it("submits a same-day correction and replaces stale create surfaces with pending status", async () => {
    const refetchedData = createSameDayPendingPageData(
      {
        reason: "비콘 재시도 실패로 출근 시간을 정정 요청했어요.",
      },
      {
        today: {
          ...createSameDayPendingPageData().today,
          previousDayOpenRecord: null,
        },
      },
    );

    api.getAttendanceToday.mockResolvedValueOnce(refetchedData.today);
    api.getAttendanceHistory.mockResolvedValueOnce(refetchedData.history);

    render(
      <AttendancePageClient initialData={createSameDayCorrectionPageData()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "출근 기록 확인" }));

    const sheet = within(
      document.body.querySelector('[data-slot="sheet-content"]') as HTMLElement,
    );

    fireEvent.change(sheet.getByLabelText("사유"), {
      target: { value: "비콘 재시도 실패로 출근 시간을 정정 요청했어요." },
    });
    fireEvent.click(sheet.getByRole("button", { name: "출근 기록 확인" }));

    await waitFor(() => {
      expect(api.createManualAttendanceRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          date: "2026-04-13",
          action: "clock_in",
          reason: "비콘 재시도 실패로 출근 시간을 정정 요청했어요.",
        }),
      );
      expect(api.getAttendanceToday).toHaveBeenCalledTimes(1);
      expect(api.getAttendanceHistory).toHaveBeenCalledWith({
        from: "2026-04-07",
        to: "2026-04-13",
      });
    });

    expect(screen.getByText("정정 요청중이에요")).toBeInTheDocument();
    expect(screen.getByText("정정 요청됨")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "출근 기록 확인" }),
    ).not.toBeInTheDocument();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("opens pending request status, allows edit, and refreshes current session after save", async () => {
    const updatedReason = "출근 시도 실패 내용을 조금 더 자세히 남깁니다.";
    const refetchedData = createSameDayPendingPageData({
      reason: updatedReason,
    });

    api.getAttendanceToday.mockResolvedValueOnce(refetchedData.today);
    api.getAttendanceHistory.mockResolvedValueOnce(refetchedData.history);

    render(
      <AttendancePageClient initialData={createSameDayPendingPageData()} />,
    );

    expect(
      screen.queryByRole("button", { name: "출근 기록 확인" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "요청 보기" })[0]!);

    const sheet = within(
      document.body.querySelector('[data-slot="sheet-content"]') as HTMLElement,
    );

    expect(
      sheet.getByRole("button", { name: "내용 수정" }),
    ).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "철회" })).toBeInTheDocument();

    fireEvent.click(sheet.getByRole("button", { name: "내용 수정" }));
    fireEvent.change(sheet.getByLabelText("사유"), {
      target: { value: updatedReason },
    });
    fireEvent.click(sheet.getByRole("button", { name: "변경 저장" }));

    await waitFor(() => {
      expect(api.updateManualAttendanceRequest).toHaveBeenCalledWith(
        "manual_request_emp_001_2026-04-13_root",
        expect.objectContaining({
          date: "2026-04-13",
          action: "clock_in",
          reason: updatedReason,
          requestedClockInAt: "2026-04-13T09:05:00+09:00",
        }),
      );
      expect(api.getAttendanceToday).toHaveBeenCalledTimes(1);
      expect(api.getAttendanceHistory).toHaveBeenCalledWith({
        from: "2026-04-07",
        to: "2026-04-13",
      });
    });

    fireEvent.click(screen.getAllByRole("button", { name: "요청 보기" })[0]!);

    const updatedSheet = within(
      document.body.querySelector('[data-slot="sheet-content"]') as HTMLElement,
    );

    expect(updatedSheet.getByText(updatedReason)).toBeInTheDocument();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("drops hidden clock fields when changing a pending request action type", async () => {
    render(
      <AttendancePageClient
        initialData={createPageData({
          today: {
            ...createPageData().today,
            previousDayOpenRecord: null,
            manualRequest: createManualRequest({
              action: "both",
              requestedClockOutAt: "2026-04-13T18:04:00+09:00",
              reason: "Office network outage blocked both attendance writes.",
            }),
            display: createDisplay({
              activeExceptions: ["manual_request_pending", "not_checked_in"],
              nextAction: {
                type: "review_request_status",
                relatedRequestId: null,
              },
            }),
          },
        })}
      />,
    );

    expect(
      screen.queryByText("오늘 출근 기록이 아직 없어요"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "요청 보기" })[0]!);

    const sheet = within(
      document.body.querySelector('[data-slot="sheet-content"]') as HTMLElement,
    );

    fireEvent.click(sheet.getByRole("button", { name: "내용 수정" }));
    fireEvent.click(sheet.getByRole("radio", { name: "퇴근" }));

    expect(sheet.queryByLabelText("출근 시간")).not.toBeInTheDocument();

    fireEvent.click(sheet.getByRole("button", { name: "변경 저장" }));

    await waitFor(() => {
      expect(api.updateManualAttendanceRequest).toHaveBeenCalledTimes(1);
    });

    const [, payload] = api.updateManualAttendanceRequest.mock.calls[0] as [
      string,
      Record<string, string>,
    ];

    expect(payload).toMatchObject({
      action: "clock_out",
      date: "2026-04-13",
      reason: "Office network outage blocked both attendance writes.",
      requestedClockOutAt: "2026-04-13T18:04:00+09:00",
    });
    expect(payload).not.toHaveProperty("requestedClockInAt");
  });

  it("keeps same-day failed attempts from surfacing as a second red correction after a pending request exists", () => {
    render(
      <AttendancePageClient
        initialData={createPageData({
          today: {
            ...createPageData().today,
            previousDayOpenRecord: null,
            attempts: [createFailedAttempt()],
            manualRequest: createManualRequest(),
            display: createDisplay({
              activeExceptions: [
                "attempt_failed",
                "manual_request_pending",
                "not_checked_in",
              ],
              nextAction: {
                type: "review_request_status",
                relatedRequestId: "manual_request_emp_001_2026-04-13_root",
              },
            }),
          },
        })}
      />,
    );

    expect(screen.getByText("정정 요청중이에요")).toBeInTheDocument();
    expect(screen.queryByText("비콘을 찾을 수 없어요")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "출근 기록 확인" }),
    ).not.toBeInTheDocument();
  });

  it("restores the correction CTA after withdrawing a pending request and refetching current session data", async () => {
    const refetchedData = createSameDayCorrectionPageData();

    api.getAttendanceToday.mockResolvedValueOnce(refetchedData.today);
    api.getAttendanceHistory.mockResolvedValueOnce(refetchedData.history);

    render(
      <AttendancePageClient initialData={createSameDayPendingPageData()} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "요청 보기" })[0]!);

    const sheet = within(
      document.body.querySelector('[data-slot="sheet-content"]') as HTMLElement,
    );

    fireEvent.click(sheet.getByRole("button", { name: "철회" }));

    await waitFor(() => {
      expect(api.updateManualAttendanceRequest).toHaveBeenCalledWith(
        "manual_request_emp_001_2026-04-13_root",
        {
          status: "withdrawn",
        },
      );
      expect(api.getAttendanceToday).toHaveBeenCalledTimes(1);
      expect(api.getAttendanceHistory).toHaveBeenCalledWith({
        from: "2026-04-07",
        to: "2026-04-13",
      });
    });

    expect(
      screen.getByRole("button", { name: "출근 기록 확인" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("정정 요청됨")).not.toBeInTheDocument();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("shows revision_requested rationale and submits a resubmission follow-up", async () => {
    const refetchedData = createSameDayPendingPageData({
      id: "manual_request_emp_001_2026-04-13_resubmitted",
      parentRequestId: "manual_request_emp_001_2026-04-13_revision",
      rootRequestId: "manual_request_emp_001_2026-04-13_revision",
      followUpKind: "resubmission",
      reason: "보완 요청 내용을 반영해서 다시 제출합니다.",
      effectiveRequestId: "manual_request_emp_001_2026-04-13_resubmitted",
      activeRequestId: "manual_request_emp_001_2026-04-13_resubmitted",
    });

    api.getAttendanceToday.mockResolvedValueOnce(refetchedData.today);
    api.getAttendanceHistory.mockResolvedValueOnce(refetchedData.history);

    render(
      <AttendancePageClient
        initialData={createPageData({
          today: {
            ...createPageData().today,
            previousDayOpenRecord: null,
            manualRequest: createManualRequest({
              id: "manual_request_emp_001_2026-04-13_revision",
              status: "revision_requested",
              reviewedAt: "2026-04-13T12:00:00+09:00",
              reviewComment: "퇴근 시간을 조금 더 구체적으로 적어 주세요.",
              activeRequestId: null,
              activeStatus: null,
              effectiveRequestId: "manual_request_emp_001_2026-04-13_revision",
              effectiveStatus: "revision_requested",
              governingReviewComment:
                "퇴근 시간을 조금 더 구체적으로 적어 주세요.",
              nextAction: "none",
            }),
            display: createDisplay({
              activeExceptions: ["manual_request_rejected", "absent"],
              nextAction: {
                type: "review_request_status",
                relatedRequestId: null,
              },
            }),
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 제출" }));

    const sheet = within(
      document.body.querySelector('[data-slot="sheet-content"]') as HTMLElement,
    );

    expect(
      sheet.getByText("퇴근 시간을 조금 더 구체적으로 적어 주세요."),
    ).toBeInTheDocument();

    fireEvent.click(sheet.getByRole("button", { name: "다시 제출" }));
    fireEvent.change(sheet.getByLabelText("사유"), {
      target: { value: "보완 요청 내용을 반영해서 다시 제출합니다." },
    });
    fireEvent.click(sheet.getByRole("button", { name: "다시 제출" }));

    await waitFor(() => {
      expect(api.createManualAttendanceRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          date: "2026-04-13",
          action: "clock_in",
          reason: "보완 요청 내용을 반영해서 다시 제출합니다.",
          parentRequestId: "manual_request_emp_001_2026-04-13_revision",
          followUpKind: "resubmission",
        }),
      );
      expect(api.getAttendanceToday).toHaveBeenCalledTimes(1);
      expect(api.getAttendanceHistory).toHaveBeenCalledWith({
        from: "2026-04-07",
        to: "2026-04-13",
      });
    });

    expect(screen.getByText("정정 요청중이에요")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "다시 제출" }),
    ).not.toBeInTheDocument();
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("falls back to router refresh when current-session refetch fails after a successful mutation", async () => {
    api.getAttendanceToday.mockRejectedValueOnce(new Error("refetch failed"));

    render(
      <AttendancePageClient initialData={createSameDayCorrectionPageData()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "출근 기록 확인" }));

    const sheet = within(
      document.body.querySelector('[data-slot="sheet-content"]') as HTMLElement,
    );

    fireEvent.change(sheet.getByLabelText("사유"), {
      target: { value: "refetch fallback 확인" },
    });
    fireEvent.click(sheet.getByRole("button", { name: "출근 기록 확인" }));

    await waitFor(() => {
      expect(api.createManualAttendanceRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          date: "2026-04-13",
          action: "clock_in",
          reason: "refetch fallback 확인",
        }),
      );
      expect(navigation.refresh).toHaveBeenCalled();
    });
  });

  it("reopens the shared sheet from a history-row action without displacing the today card", () => {
    render(<AttendancePageClient initialData={createPageData()} />);

    const historyTable = screen.getByRole("table");

    fireEvent.click(
      within(historyTable).getAllByRole("button", { name: "정정하기" })[0]!,
    );

    const sheet = within(
      document.body.querySelector('[data-slot="sheet-content"]') as HTMLElement,
    );

    expect(screen.getByText("근태 관리")).toBeInTheDocument();
    expect(sheet.getByText("근무 기록을 정정할 수 있어요")).toBeInTheDocument();
    expect(sheet.getByLabelText("대상 날짜")).toHaveValue("2026-04-13");
  });

  it("renders leave conflict guidance as a read-only sheet", () => {
    render(
      <AttendancePageClient
        initialData={createPageData({
          today: {
            ...createPageData().today,
            previousDayOpenRecord: null,
            expectedWorkday: createExpectedWorkday({
              leaveCoverage: {
                requestId: "leave_request_001",
                leaveType: "annual",
                startAt: "2026-04-13T09:00:00+09:00",
                endAt: "2026-04-13T18:00:00+09:00",
              },
            }),
            todayRecord: {
              id: "attendance_record_emp_001_2026-04-13",
              date: "2026-04-13",
              clockInAt: "2026-04-13T09:10:00+09:00",
              clockInSource: "beacon",
              clockOutAt: null,
              clockOutSource: null,
              workMinutes: null,
            },
            display: createDisplay({
              phase: "working",
              activeExceptions: ["leave_work_conflict"],
              nextAction: {
                type: "review_leave_conflict",
                relatedRequestId: null,
              },
            }),
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "충돌 확인" }));

    const sheet = within(
      document.body.querySelector('[data-slot="sheet-content"]') as HTMLElement,
    );

    expect(
      sheet.getByText(
        "승인된 휴가 정보와 실제 근무 기록이 같은 날짜에 함께 보이고 있어요",
      ),
    ).toBeInTheDocument();
    expect(sheet.queryByLabelText("사유")).not.toBeInTheDocument();
  });
});
