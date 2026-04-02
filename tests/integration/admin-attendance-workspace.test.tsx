import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByText("전체 팀 장부")).toBeInTheDocument();
    expect(screen.getAllByText("전날 미퇴근").length).toBeGreaterThan(0);
    const noRecordRow = screen.getAllByText("Junho Lee")[0]?.closest("tr");
    expect(noRecordRow).not.toBeNull();
    expect(noRecordRow).toHaveTextContent("출근 기록 없음");
    expect(noRecordRow).toHaveTextContent("Engineering");
    expect(screen.getAllByText("Minji Park").length).toBeGreaterThan(0);
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

    expect(screen.getAllByText("Minji Park").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2026-04-10").length).toBeGreaterThan(0);
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

    const pendingRequestRow = screen
      .getAllByText("Hyunwoo Baek")[0]
      ?.closest("tr");

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
      "/admin/attendance?mode=history&from=2026-04-07&to=2026-04-13",
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
      "/admin/attendance?mode=history&from=2026-04-07&to=2026-04-13",
    );
  });

  it("keeps history filters controlled from URL state after rerender", () => {
    const { rerender } = render(
      <AdminAttendanceWorkspace
        state={createState(
          "?mode=history&from=2026-04-07&to=2026-04-13&name=alex",
        )}
        historyResponse={repository.getAdminAttendanceList({
          from: "2026-04-07",
          to: "2026-04-13",
          name: "alex",
        })}
      />,
    );

    expect(screen.getByDisplayValue("alex")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-04-07")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-04-13")).toBeInTheDocument();

    rerender(
      <AdminAttendanceWorkspace
        state={createState(
          "?mode=history&from=2026-04-08&to=2026-04-12&name=junho",
        )}
        historyResponse={repository.getAdminAttendanceList({
          from: "2026-04-08",
          to: "2026-04-12",
          name: "junho",
        })}
      />,
    );

    expect(screen.getByDisplayValue("junho")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-04-08")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-04-12")).toBeInTheDocument();
  });

  it("renders the history empty state for the alex name filter", () => {
    render(
      <AdminAttendanceWorkspace
        state={createState(
          "?mode=history&from=2026-04-07&to=2026-04-13&name=alex",
        )}
        historyResponse={repository.getAdminAttendanceList({
          from: "2026-04-07",
          to: "2026-04-13",
          name: "alex",
        })}
      />,
    );

    expect(screen.getByDisplayValue("alex")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-04-07")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-04-13")).toBeInTheDocument();
    expect(
      screen.getByText("조건에 맞는 근태 이력이 없어요"),
    ).toBeInTheDocument();
  });

  it("renders explicit seeded history exception labels without today-copy phrasing", () => {
    render(
      <AdminAttendanceWorkspace
        state={createState("?mode=history&from=2026-04-13&to=2026-04-13")}
        historyResponse={repository.getAdminAttendanceList({
          from: "2026-04-13",
          to: "2026-04-13",
        })}
      />,
    );

    expect(getRowByEmployeeName("Minji Park")).toHaveTextContent("전날 미퇴근");
    expect(getRowByEmployeeName("Hyunwoo Baek")).toHaveTextContent("시도 실패");
    expect(
      screen.queryByText("오늘 지각으로 기록됐어요."),
    ).not.toBeInTheDocument();
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
});
