import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import Home from "@/app/page";

describe("Root page", () => {
  it("redirects to the attendance overview", () => {
    expect(() => Home()).toThrowError("NEXT_REDIRECT:/attendance");
    expect(redirectMock).toHaveBeenCalledWith("/attendance");
  });
});
