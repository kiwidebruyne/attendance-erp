import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusToggle } from "@/tests/fixtures/status-toggle";

// Starter integration-test example for the JSDOM lane using a client fixture.
describe("StatusToggle", () => {
  it("updates the visible status label after a user click", () => {
    render(<StatusToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Check in" }));

    expect(screen.getByText("Checked in")).toBeInTheDocument();
  });
});
