import { describe, expect, it } from "vitest";

import { formatDurationMinutes } from "@/tests/fixtures/format-duration";

describe("formatDurationMinutes", () => {
  it("formats full hours and leftover minutes for a summary label", () => {
    expect(formatDurationMinutes(135)).toBe("2h 15m");
  });
});
