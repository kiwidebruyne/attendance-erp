import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadAdminAttendanceScreenData } from "@/app/(erp)/(admin)/admin/attendance/_lib/load-admin-attendance-screen-data";
import { normalizeAdminAttendanceUrlState } from "@/app/(erp)/(admin)/admin/attendance/_lib/page-state";
import { getRequestOrigin } from "@/app/(erp)/(admin)/admin/attendance/_lib/request-origin";
import AdminAttendanceError from "@/app/(erp)/(admin)/admin/attendance/error";
import AdminAttendanceLoading from "@/app/(erp)/(admin)/admin/attendance/loading";
import {
  fetchAdminAttendanceList,
  fetchAdminAttendanceToday,
} from "@/lib/api/admin-attendance";

vi.mock("@/lib/api/admin-attendance", () => ({
  fetchAdminAttendanceList: vi.fn(),
  fetchAdminAttendanceToday: vi.fn(),
}));

const { headersMock } = vi.hoisted(() => ({
  headersMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

describe("admin attendance route helpers", () => {
  beforeEach(() => {
    vi.mocked(fetchAdminAttendanceList).mockReset();
    vi.mocked(fetchAdminAttendanceToday).mockReset();
    headersMock.mockReset();
  });

  it("loads today mode through the today API wrapper only", async () => {
    vi.mocked(fetchAdminAttendanceToday).mockResolvedValueOnce({
      date: "2026-04-13",
      summary: {
        checkedInCount: 9,
        notCheckedInCount: 2,
        lateCount: 1,
        onLeaveCount: 1,
        failedAttemptCount: 1,
        previousDayOpenCount: 1,
      },
      items: [],
    });

    const state = normalizeAdminAttendanceUrlState(new URLSearchParams());
    const result = await loadAdminAttendanceScreenData({
      baseUrl: "http://localhost:3000",
      state,
    });

    expect(fetchAdminAttendanceToday).toHaveBeenCalledTimes(1);
    expect(fetchAdminAttendanceToday).toHaveBeenCalledWith({
      baseUrl: "http://localhost:3000",
    });
    expect(fetchAdminAttendanceList).not.toHaveBeenCalled();
    expect(result.todayResponse?.date).toBe("2026-04-13");
    expect(result.todayExceptionRows).toEqual([]);
    expect(result.historyResponse).toBeUndefined();
  });

  it("loads history mode through the history API wrapper only", async () => {
    vi.mocked(fetchAdminAttendanceList).mockResolvedValueOnce({
      from: "2026-04-07",
      to: "2026-04-13",
      filters: {
        name: "alex",
      },
      total: 0,
      records: [],
    });

    const state = normalizeAdminAttendanceUrlState(
      new URLSearchParams(
        "mode=history&from=2026-04-07&to=2026-04-13&name=alex",
      ),
    );
    const result = await loadAdminAttendanceScreenData({
      baseUrl: "http://localhost:3000",
      state,
    });

    expect(fetchAdminAttendanceList).toHaveBeenCalledTimes(1);
    expect(fetchAdminAttendanceList).toHaveBeenCalledWith(
      {
        from: "2026-04-07",
        to: "2026-04-13",
        name: "alex",
      },
      {
        baseUrl: "http://localhost:3000",
      },
    );
    expect(fetchAdminAttendanceToday).not.toHaveBeenCalled();
    expect(result.historyResponse?.filters.name).toBe("alex");
    expect(result.todayExceptionRows).toBeUndefined();
    expect(result.todayResponse).toBeUndefined();
  });

  it("uses forwarded protocol when present and keeps localhost on http", async () => {
    headersMock.mockResolvedValueOnce(
      new Headers({
        "x-forwarded-host": "erp.example.internal",
        "x-forwarded-proto": "https",
      }),
    );

    await expect(getRequestOrigin()).resolves.toBe(
      "https://erp.example.internal",
    );

    headersMock.mockResolvedValueOnce(
      new Headers({
        host: "localhost:3000",
      }),
    );

    await expect(getRequestOrigin()).resolves.toBe("http://localhost:3000");

    headersMock.mockResolvedValueOnce(
      new Headers({
        host: "[::1]:3000",
      }),
    );

    await expect(getRequestOrigin()).resolves.toBe("http://[::1]:3000");
  });

  it("fails fast when protocol is missing for a non-local host", async () => {
    headersMock.mockResolvedValueOnce(
      new Headers({
        host: "staging.bestsleep.internal",
      }),
    );

    await expect(getRequestOrigin()).rejects.toThrow(
      "Missing request protocol for admin attendance API fetch.",
    );
  });
});

describe("admin attendance loading and error states", () => {
  it("renders explicit loading skeleton UI", () => {
    const { container } = render(<AdminAttendanceLoading />);

    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0);
  });

  it("renders error UI and retries through reset", () => {
    const reset = vi.fn();

    render(<AdminAttendanceError reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(
      screen.getByText("팀 근태 화면을 불러오지 못했어요"),
    ).toBeInTheDocument();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
