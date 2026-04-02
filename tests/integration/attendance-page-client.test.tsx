import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  vi.clearAllMocks();
  navigation.pathname = "/attendance";
  api.createManualAttendanceRequest.mockResolvedValue({});
  api.updateManualAttendanceRequest.mockResolvedValue({});
});

describe("AttendancePageClient", () => {
  it("renders the today card above the carry-over exception stack", () => {
    render(<AttendancePageClient initialData={createPageData()} />);

    expect(screen.getByText("근태 관리")).toBeInTheDocument();
    expect(
      screen.getByText("어제 퇴근 기록이 아직 없어요."),
    ).toBeInTheDocument();
    expect(screen.getByText("출퇴근 이력")).toBeInTheDocument();
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

    expect(screen.getByText("비콘을 찾을 수 없어요.")).toBeInTheDocument();
    expect(
      screen.getByText("오늘 출근 기록이 아직 없어요."),
    ).toBeInTheDocument();
  });

  it("opens carry-over correction with the prior date and clock-out defaults", () => {
    render(<AttendancePageClient initialData={createPageData()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "어제 퇴근 시간 정정 요청" }),
    );

    const sheet = within(
      document.body.querySelector('[data-slot="sheet-content"]') as HTMLElement,
    );

    expect(
      sheet.getByText("어제 퇴근 기록이 아직 없어요."),
    ).toBeInTheDocument();
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

  it("opens pending request status, allows edit, and refreshes after save", async () => {
    render(
      <AttendancePageClient
        initialData={createPageData({
          today: {
            ...createPageData().today,
            previousDayOpenRecord: null,
            manualRequest: createManualRequest(),
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

    fireEvent.click(screen.getByRole("button", { name: "상태 확인" }));

    const sheet = within(
      document.body.querySelector('[data-slot="sheet-content"]') as HTMLElement,
    );

    expect(
      sheet.getByRole("button", { name: "내용 수정" }),
    ).toBeInTheDocument();
    expect(sheet.getByRole("button", { name: "철회" })).toBeInTheDocument();

    fireEvent.click(sheet.getByRole("button", { name: "내용 수정" }));
    fireEvent.change(sheet.getByLabelText("사유"), {
      target: { value: "출근 시도 실패 내용을 조금 더 자세히 남깁니다." },
    });
    fireEvent.click(sheet.getByRole("button", { name: "변경 저장" }));

    await waitFor(() => {
      expect(api.updateManualAttendanceRequest).toHaveBeenCalledWith(
        "manual_request_emp_001_2026-04-13_root",
        expect.objectContaining({
          date: "2026-04-13",
          action: "clock_in",
          reason: "출근 시도 실패 내용을 조금 더 자세히 남깁니다.",
          requestedClockInAt: "2026-04-13T09:05:00+09:00",
        }),
      );
      expect(navigation.refresh).toHaveBeenCalled();
    });
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

    fireEvent.click(screen.getByRole("button", { name: "상태 확인" }));

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

  it("shows revision_requested rationale and submits a resubmission follow-up", async () => {
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
      expect(navigation.refresh).toHaveBeenCalled();
    });
  });

  it("reopens the shared sheet from a history-row action without displacing the today card", () => {
    render(<AttendancePageClient initialData={createPageData()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "정정 요청" })[0]!);

    const sheet = within(
      document.body.querySelector('[data-slot="sheet-content"]') as HTMLElement,
    );

    expect(screen.getByText("근태 관리")).toBeInTheDocument();
    expect(
      sheet.getByText("근무 기록을 정정할 수 있어요."),
    ).toBeInTheDocument();
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
        "승인된 휴가 정보와 실제 근무 기록이 같은 날짜에 함께 보이고 있어요.",
      ),
    ).toBeInTheDocument();
    expect(sheet.queryByLabelText("사유")).not.toBeInTheDocument();
  });
});
