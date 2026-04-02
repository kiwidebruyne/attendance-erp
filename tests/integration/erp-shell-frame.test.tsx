import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ErpShellFrame } from "@/components/shell/erp-shell-frame";

describe("ErpShellFrame", () => {
  it("renders the shell brand, removes the header copy, and keeps navigation intact", () => {
    const { container } = render(
      <ErpShellFrame pathname="/attendance/leave">
        <div>Route content</div>
      </ErpShellFrame>,
    );

    expect(
      screen.queryByText("업무 영역을 선택하여 시작하세요"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("베스트슬립")).toBeInTheDocument();
    expect(screen.getByText("전사 관리 시스템")).toBeInTheDocument();

    const navigation = screen.getByRole("navigation");

    expect(within(navigation).getByText("직원")).toBeInTheDocument();
    expect(within(navigation).getByText("관리자")).toBeInTheDocument();

    const navLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") !== "#main-content");
    expect(navLinks).toHaveLength(4);
    expect(navLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/attendance",
      "/attendance/leave",
      "/admin/attendance",
      "/admin/attendance/requests",
    ]);

    expect(screen.getByRole("link", { name: "휴가 신청" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Route content")).toBeInTheDocument();
    expect(container.querySelector("aside")).toHaveStyle({ width: "200px" });
  });

  it("collapses the desktop sidebar into a rail and expands it again", async () => {
    const { container } = render(
      <ErpShellFrame pathname="/attendance">
        <div>Route content</div>
      </ErpShellFrame>,
    );

    const collapseButton = screen.getByRole("button", {
      name: "사이드바 접기",
    });
    fireEvent.click(collapseButton);

    expect(
      screen.getByRole("button", { name: "사이드바 펼치기" }),
    ).toBeVisible();
    expect(screen.queryByText("베스트슬립")).not.toBeInTheDocument();
    expect(screen.queryByText("전사 관리 시스템")).not.toBeInTheDocument();
    expect(container.querySelector("aside")).toHaveStyle({ width: "56px" });

    fireEvent.click(screen.getByRole("button", { name: "사이드바 펼치기" }));

    expect(screen.getByRole("button", { name: "사이드바 접기" })).toBeVisible();
    expect(screen.getByText("베스트슬립")).toBeInTheDocument();
  });
});
