import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAttendanceWorkspace } from "@/app/(erp)/(admin)/admin/attendance/_components/admin-attendance-workspace";
import {
  type AdminAttendanceUrlState,
  normalizeAdminAttendanceUrlState,
} from "@/app/(erp)/(admin)/admin/attendance/_lib/page-state";
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

describe("AdminAttendanceWorkspace", () => {
  beforeEach(() => {
    pathnameValue = "/admin/attendance";
    searchParamsValue = new URLSearchParams();
    replaceMock.mockReset();
  });

  it("renders today summary cards and the grouped exception-first queue", () => {
    const neutralOnTimeEmployee = repository
      .getAdminAttendanceToday({
        date: canonicalSeedWorld.baselineDate,
      })
      .items.find(
        (item) =>
          item.todayRecord !== null &&
          item.previousDayOpenRecord === null &&
          item.latestFailedAttempt === null &&
          item.manualRequest === null &&
          item.display.activeExceptions.length === 0 &&
          item.display.flags.length === 0,
      )?.employee.name;

    render(
      <AdminAttendanceWorkspace
        state={createState()}
        todayResponse={repository.getAdminAttendanceToday({
          date: canonicalSeedWorld.baselineDate,
        })}
      />,
    );

    expect(screen.getByText("출근 완료")).toBeInTheDocument();
    expect(screen.getByText("출근 전")).toBeInTheDocument();
    expect(screen.getByText("지각")).toBeInTheDocument();
    expect(screen.getByText("휴가")).toBeInTheDocument();
    expect(screen.getByText("출결 시도 실패")).toBeInTheDocument();
    expect(screen.getAllByText("전날 미퇴근").length).toBeGreaterThan(0);

    expect(screen.getByText("전날 기록 확인")).toBeInTheDocument();
    expect(screen.getByText("실패한 시도")).toBeInTheDocument();
    expect(screen.getByText("오늘 확인 필요")).toBeInTheDocument();
    const noRecordRow = screen.getByText("Junho Lee").closest("li");
    expect(noRecordRow).not.toBeNull();
    expect(noRecordRow).toHaveTextContent("출근 기록 없음");
    expect(noRecordRow).toHaveTextContent("기록 없음");

    if (neutralOnTimeEmployee !== undefined) {
      expect(screen.queryByText(neutralOnTimeEmployee)).not.toBeInTheDocument();
    }
  });

  it("shows the prior-workday target date for the carry-over row", () => {
    render(
      <AdminAttendanceWorkspace
        state={createState()}
        todayResponse={repository.getAdminAttendanceToday({
          date: canonicalSeedWorld.baselineDate,
        })}
      />,
    );

    expect(screen.getByText("Minji Park")).toBeInTheDocument();
    expect(screen.getByText("대상일 2026-04-10")).toBeInTheDocument();
  });

  it("shows the governing review comment for the pending manual-request projection", () => {
    render(
      <AdminAttendanceWorkspace
        state={createState()}
        todayResponse={repository.getAdminAttendanceToday({
          date: canonicalSeedWorld.baselineDate,
        })}
      />,
    );

    expect(screen.getByText("Hyunwoo Baek")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Please submit a follow-up if the beacon issue continues.",
      ),
    ).toBeInTheDocument();
  });

  it("switches to history mode with the default date range in the URL", () => {
    render(
      <AdminAttendanceWorkspace
        state={createState()}
        todayResponse={repository.getAdminAttendanceToday({
          date: canonicalSeedWorld.baselineDate,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "이력" }));

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      "/admin/attendance?mode=history&from=2026-04-07&to=2026-04-13",
    );
  });

  it("switches tabs from the keyboard through a single replace path", () => {
    render(
      <AdminAttendanceWorkspace
        state={createState()}
        todayResponse={repository.getAdminAttendanceToday({
          date: canonicalSeedWorld.baselineDate,
        })}
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
      screen.getByText("조건에 맞는 근태 이력이 없어요."),
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

    expect(
      screen.getByText("오늘 바로 확인할 근태가 없어요."),
    ).toBeInTheDocument();
  });
});
