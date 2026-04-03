import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAttendanceWorkspace } from "@/app/(erp)/(admin)/admin/attendance/_components/admin-attendance-workspace";
import {
  type AdminAttendanceUrlState,
  normalizeAdminAttendanceUrlState,
} from "@/app/(erp)/(admin)/admin/attendance/_lib/page-state";
import { buildAdminAttendanceTodayExceptionRows } from "@/app/(erp)/(admin)/admin/attendance/_lib/today-exception-rows";
import { createSeedRepository } from "@/lib/repositories";
import { canonicalSeedWorld } from "@/lib/seed/world";

const replaceMock = vi.fn();

let pathnameValue = "/admin/attendance";
let searchParamsValue = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameValue,
  useRouter: () => ({
    replace: replaceMock,
  }),
  useSearchParams: () => searchParamsValue,
}));

function createState(search = ""): AdminAttendanceUrlState {
  return normalizeAdminAttendanceUrlState(new URLSearchParams(search));
}

function getRowByEmployeeName(name: string) {
  const cell = screen.getByText(name);
  const row = cell.closest("tr");

  expect(row).not.toBeNull();

  return row!;
}

const repository = createSeedRepository({
  world: canonicalSeedWorld,
});

function createTodayResponse() {
  return repository.getAdminAttendanceToday({
    date: canonicalSeedWorld.baselineDate,
  });
}

describe("AdminAttendanceWorkspace", () => {
  beforeEach(() => {
    pathnameValue = "/admin/attendance";
    searchParamsValue = new URLSearchParams();
    replaceMock.mockReset();
  });

  it("renders the exception table, one-row summary cards, and full team ledger", () => {
    const todayResponse = createTodayResponse();

    render(
      <AdminAttendanceWorkspace
        state={createState()}
        todayExceptionRows={buildAdminAttendanceTodayExceptionRows(
          todayResponse,
        )}
        todayResponse={todayResponse}
      />,
    );

    expect(screen.getByText("누적 예외")).toBeInTheDocument();
    expect(screen.getAllByText("근무중").length).toBeGreaterThan(0);
    expect(screen.getAllByText("출근 전").length).toBeGreaterThan(0);
    expect(screen.getAllByText("지각").length).toBeGreaterThan(0);
    expect(screen.getAllByText("조퇴").length).toBeGreaterThan(0);
    expect(screen.getAllByText("연차").length).toBeGreaterThan(0);
    expect(screen.getAllByText("반차").length).toBeGreaterThan(0);
    expect(screen.getAllByText("시간차").length).toBeGreaterThan(0);
    expect(screen.getByText("전체 팀 근무현황")).toBeInTheDocument();
    expect(screen.getAllByText("전날 미퇴근").length).toBeGreaterThan(0);
    const ledgerTable = screen.getAllByRole("table")[1];
    const noRecordRow = within(ledgerTable!).getByText("오나리").closest("tr");

    expect(noRecordRow).not.toBeNull();
    expect(noRecordRow).toHaveTextContent("재무");
    expect(noRecordRow).toHaveTextContent("출근 기록 없음");
    expect(within(noRecordRow!).getAllByText("-").length).toBeGreaterThan(0);
    expect(screen.getAllByText("박민지").length).toBeGreaterThan(0);
  });

  it("shows the prior-workday target date for the carry-over row", () => {
    const todayResponse = createTodayResponse();

    render(
      <AdminAttendanceWorkspace
        state={createState()}
        todayExceptionRows={buildAdminAttendanceTodayExceptionRows(
          todayResponse,
        )}
        todayResponse={todayResponse}
      />,
    );

    expect(screen.getAllByText("이준호").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2026-04-02").length).toBeGreaterThan(0);
  });

  it("keeps failed-attempt rows visible in the exception table", () => {
    const todayResponse = createTodayResponse();

    render(
      <AdminAttendanceWorkspace
        state={createState()}
        todayExceptionRows={buildAdminAttendanceTodayExceptionRows(
          todayResponse,
        )}
        todayResponse={todayResponse}
      />,
    );

    const pendingRequestRow = screen.getAllByText("백현우")[0]?.closest("tr");

    expect(pendingRequestRow).not.toBeNull();
    expect(pendingRequestRow).toHaveTextContent("시도 실패");
  });

  it("switches to history mode with the default date range in the URL", () => {
    const todayResponse = createTodayResponse();

    render(
      <AdminAttendanceWorkspace
        state={createState()}
        todayExceptionRows={buildAdminAttendanceTodayExceptionRows(
          todayResponse,
        )}
        todayResponse={todayResponse}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "이력" }));

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      "/admin/attendance?mode=history&from=2026-03-28&to=2026-04-03",
    );
  });

  it("switches tabs from the keyboard through a single replace path", () => {
    const todayResponse = createTodayResponse();

    render(
      <AdminAttendanceWorkspace
        state={createState()}
        todayExceptionRows={buildAdminAttendanceTodayExceptionRows(
          todayResponse,
        )}
        todayResponse={todayResponse}
      />,
    );

    fireEvent.keyDown(screen.getByRole("tab", { name: "오늘" }), {
      key: "ArrowRight",
    });

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      "/admin/attendance?mode=history&from=2026-03-28&to=2026-04-03",
    );
  });

  it("keeps history filters controlled from URL state after rerender", () => {
    const { rerender } = render(
      <AdminAttendanceWorkspace
        state={createState(
          "?mode=history&from=2026-03-28&to=2026-04-03&name=민지",
        )}
        historyResponse={repository.getAdminAttendanceList({
          from: "2026-03-28",
          to: "2026-04-03",
          name: "민지",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "이름 필터" }));
    expect(screen.getByPlaceholderText("이름으로 찾아요")).toHaveValue("민지");
    fireEvent.click(screen.getByRole("button", { name: "날짜 필터" }));
    expect(screen.getByLabelText("시작일")).toHaveValue("2026-03-28");
    expect(screen.getByLabelText("종료일")).toHaveValue("2026-04-03");

    rerender(
      <AdminAttendanceWorkspace
        state={createState(
          "?mode=history&from=2026-03-29&to=2026-04-02&name=준호",
        )}
        historyResponse={repository.getAdminAttendanceList({
          from: "2026-03-29",
          to: "2026-04-02",
          name: "준호",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "이름 필터" }));
    expect(screen.getByPlaceholderText("이름으로 찾아요")).toHaveValue("준호");
    fireEvent.click(screen.getByRole("button", { name: "날짜 필터" }));
    expect(screen.getByLabelText("시작일")).toHaveValue("2026-03-29");
    expect(screen.getByLabelText("종료일")).toHaveValue("2026-04-02");
  });

  it("applies history date presets through a single URL replacement", () => {
    render(
      <AdminAttendanceWorkspace
        state={createState("?mode=history&from=2026-03-29&to=2026-04-03")}
        historyResponse={repository.getAdminAttendanceList({
          from: "2026-03-29",
          to: "2026-04-03",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "날짜 필터" }));
    fireEvent.click(screen.getByRole("radio", { name: "최근 30일" }));

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      "/admin/attendance?mode=history&from=2026-03-05&to=2026-04-03",
    );
  });

  it("renders the history empty state for a non-matching Hangul name filter", () => {
    render(
      <AdminAttendanceWorkspace
        state={createState(
          "?mode=history&from=2026-03-28&to=2026-04-03&name=없는이름",
        )}
        historyResponse={repository.getAdminAttendanceList({
          from: "2026-03-28",
          to: "2026-04-03",
          name: "없는이름",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "이름 필터" }));
    expect(screen.getByPlaceholderText("이름으로 찾아요")).toHaveValue(
      "없는이름",
    );
    fireEvent.click(screen.getByRole("button", { name: "날짜 필터" }));
    expect(screen.getByLabelText("시작일")).toHaveValue("2026-03-28");
    expect(screen.getByLabelText("종료일")).toHaveValue("2026-04-03");
    expect(
      screen.getByText(/조건에 맞는 근태 이력이 없어요/),
    ).toBeInTheDocument();
  });

  it("renders explicit seeded history exception labels without today-copy phrasing", () => {
    render(
      <AdminAttendanceWorkspace
        state={createState("?mode=history&from=2026-04-03&to=2026-04-03")}
        historyResponse={repository.getAdminAttendanceList({
          from: "2026-04-03",
          to: "2026-04-03",
        })}
      />,
    );

    expect(getRowByEmployeeName("이준호")).toHaveTextContent("전날 미퇴근");
    expect(getRowByEmployeeName("백현우")).toHaveTextContent("시도 실패");
    expect(
      screen.queryByText("오늘 지각으로 기록됐어요."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("근태 이력을 한눈에 보고 있어요"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("운영 요약")).not.toBeInTheDocument();
  });

  it("renders an explicit today empty state when no grouped rows exist", () => {
    render(
      <AdminAttendanceWorkspace
        state={createState()}
        todayExceptionRows={[]}
        todayResponse={{
          date: canonicalSeedWorld.baselineDate,
          summary: {
            checkedInCount: 0,
            notCheckedInCount: 0,
            lateCount: 0,
            onLeaveCount: 0,
            failedAttemptCount: 0,
            previousDayOpenCount: 0,
          },
          items: [],
        }}
      />,
    );

    expect(screen.getByText("지금 누적 예외가 없어요")).toBeInTheDocument();
    expect(screen.getByText("검색 결과가 없어요")).toBeInTheDocument();
  });

  it("uses the danger tint for absent rows in the exception table", () => {
    render(
      <AdminAttendanceWorkspace
        state={createState()}
        todayExceptionRows={[
          {
            department: "운영",
            detail: "결근 상태가 남아 있어요",
            employeeId: "emp_absent",
            employeeName: "결근 직원",
            exceptionType: "결근",
            id: "exception-absent-row",
            referenceDate: "2026-04-10",
            specialNote: "-",
          },
        ]}
        todayResponse={{
          date: canonicalSeedWorld.baselineDate,
          summary: {
            checkedInCount: 0,
            notCheckedInCount: 0,
            lateCount: 0,
            onLeaveCount: 0,
            failedAttemptCount: 0,
            previousDayOpenCount: 0,
          },
          items: [],
        }}
      />,
    );

    expect(getRowByEmployeeName("결근 직원")).toHaveClass(
      "bg-status-danger-soft/28",
    );
  });

  it("keeps department keyword filtering consistent across today summaries and the ledger", () => {
    const todayResponse = createTodayResponse();

    render(
      <AdminAttendanceWorkspace
        state={createState("?name=재무")}
        todayExceptionRows={buildAdminAttendanceTodayExceptionRows(
          todayResponse,
        )}
        todayResponse={todayResponse}
      />,
    );

    expect(
      screen.queryByText("조건에 맞는 근무현황이 없어요."),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("강유나").length).toBeGreaterThan(0);
    expect(screen.getAllByText("오나리").length).toBeGreaterThan(0);
  });
});
