import { describe, expect, it } from "vitest";

import {
  attendanceHistoryQuerySchema,
  manualAttendanceRequestBodySchema,
} from "@/lib/contracts/attendance";
import { adminRequestDecisionBodySchema } from "@/lib/contracts/requests";
import {
  parseJsonBody,
  parseSearchParams,
  validationErrorResponse,
} from "@/lib/server/api";

describe("server api helpers", () => {
  it("parses valid query params into typed data", () => {
    const result = parseSearchParams(
      attendanceHistoryQuerySchema,
      new URLSearchParams({
        from: "2026-03-24",
        to: "2026-03-30",
      }),
    );

    expect(result).toEqual({
      success: true,
      data: {
        from: "2026-03-24",
        to: "2026-03-30",
      },
    });
  });

  it("returns the documented validation envelope for invalid query params", async () => {
    const result = parseSearchParams(
      attendanceHistoryQuerySchema,
      new URLSearchParams({
        from: "2026-03-24",
      }),
    );

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected query parsing to fail");
    }

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({
      error: {
        code: "validation_error",
        message:
          'Invalid query parameter "to": Invalid input: expected string, received undefined',
      },
    });
  });

  it("returns the documented validation envelope for invalid request bodies", async () => {
    const result = await parseJsonBody(
      manualAttendanceRequestBodySchema,
      new Request("https://example.com/api/attendance/manual", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          date: "2026-03-30",
          action: "check_in",
          requestedAt: "2026-03-30T09:00:00+09:00",
          reason: "Beacon was not detected at the office entrance.",
        }),
      }),
    );

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected body parsing to fail");
    }

    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({
      error: {
        code: "validation_error",
        message:
          'Invalid request body for "action": Invalid option: expected one of "clock_in"|"clock_out"|"both"',
      },
    });
  });

  it("parses valid request bodies", async () => {
    const result = await parseJsonBody(
      adminRequestDecisionBodySchema,
      new Request("https://example.com/api/admin/requests/req_manual_001", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          decision: "reject",
          rejectionReason: "Please clarify the missing clock-out time.",
        }),
      }),
    );

    expect(result).toEqual({
      success: true,
      data: {
        decision: "reject",
        rejectionReason: "Please clarify the missing clock-out time.",
      },
    });
  });

  it("builds validation responses directly from a message", async () => {
    const response = validationErrorResponse(
      'Invalid query parameter "from": Date is required',
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "validation_error",
        message: 'Invalid query parameter "from": Date is required',
      },
    });
  });
});
