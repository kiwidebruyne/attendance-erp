import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ErpShellFrame } from "@/components/shell/erp-shell-frame";

describe("ErpShellFrame", () => {
  it("renders the two navigation groups, the four assignment links, and the active route", () => {
    render(
      <ErpShellFrame pathname="/attendance/leave">
        <div>Route content</div>
      </ErpShellFrame>,
    );

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
  });
});
