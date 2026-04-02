import { afterEach, describe, expect, it } from "vitest";

import { PATCH as patchManualAttendance } from "@/app/api/attendance/manual/[id]/route";
import { POST as createManualAttendance } from "@/app/api/attendance/manual/route";
import { GET as getAttendanceHistory } from "@/app/api/attendance/me/history/route";
import { GET as getAttendanceMe } from "@/app/api/attendance/me/route";
import {
  attendanceHistoryResponseSchema,
  attendanceTodayResponseSchema,
  manualAttendanceRequestResponseSchema,
} from "@/lib/contracts/attendance";
import { type CanonicalSeedWorld, canonicalSeedWorld } from "@/lib/seed/world";
import {
  resetMockSeedWorldForTests,
  setMockSeedWorldForTests,
} from "@/lib/server/mock-state";

function createWorld() {
  return structuredClone(canonicalSeedWorld) as CanonicalSeedWorld;
}

function addPendingManualRequest(
  world: CanonicalSeedWorld,
  overrides: Partial<
    CanonicalSeedWorld["manualAttendanceRequests"][number]
  > = {},
) {
  world.manualAttendanceRequests.push({
    id: "manual_request_emp_001_2026-04-13_root",
    employeeId: "emp_001",
    requestType: "manual_attendance",
    action: "clock_in",
    date: "2026-04-13",
    submittedAt: "2026-04-13T10:05:00+09:00",
    requestedClockInAt: "2026-04-13T09:05:00+09:00",
    requestedClockOutAt: null,
    reason: "Beacon was unavailable during check-in.",
    status: "pending",
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: "manual_request_emp_001_2026-04-13_root",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
    ...overrides,
  });
}

afterEach(() => {
  resetMockSeedWorldForTests();
});

describe("employee attendance route handlers", () => {
  it("returns contract-aligned today state for the fixed employee persona", async () => {
    const response = await getAttendanceMe();

    expect(response.status).toBe(200);
    expect(
      attendanceTodayResponseSchema.parse(await response.json()),
    ).toMatchObject({
      date: "2026-04-13",
      employee: {
        id: "emp_001",
      },
      previousDayOpenRecord: {
        date: "2026-04-10",
      },
      manualRequest: null,
    });
  });

  it("keeps carry-over prior-workday manual requests visible on today's card", async () => {
    const world = createWorld();
    addPendingManualRequest(world, {
      id: "manual_request_emp_001_2026-04-10_root",
      date: "2026-04-10",
      action: "clock_out",
      requestedClockInAt: null,
      requestedClockOutAt: "2026-04-10T18:10:00+09:00",
      submittedAt: "2026-04-13T09:20:00+09:00",
      reason: "Submitting a carry-over checkout correction.",
      rootRequestId: "manual_request_emp_001_2026-04-10_root",
    });
    setMockSeedWorldForTests(world);

    const response = await getAttendanceMe();
    const body = attendanceTodayResponseSchema.parse(await response.json());

    expect(body.manualRequest).toMatchObject({
      id: "manual_request_emp_001_2026-04-10_root",
      date: "2026-04-10",
      status: "pending",
    });
  });

  it("prefers the carry-over prior-workday request even when a same-day completed request exists", async () => {
    const world = createWorld();
    addPendingManualRequest(world, {
      id: "manual_request_emp_001_2026-04-10_root",
      date: "2026-04-10",
      action: "clock_out",
      requestedClockInAt: null,
      requestedClockOutAt: "2026-04-10T18:10:00+09:00",
      submittedAt: "2026-04-13T09:20:00+09:00",
      reason: "Submitting a carry-over checkout correction.",
      rootRequestId: "manual_request_emp_001_2026-04-10_root",
    });
    addPendingManualRequest(world, {
      id: "manual_request_emp_001_2026-04-13_withdrawn",
      status: "withdrawn",
      rootRequestId: "manual_request_emp_001_2026-04-13_withdrawn",
    });
    setMockSeedWorldForTests(world);

    const response = await getAttendanceMe();
    const body = attendanceTodayResponseSchema.parse(await response.json());

    expect(body.manualRequest).toMatchObject({
      id: "manual_request_emp_001_2026-04-10_root",
      date: "2026-04-10",
      status: "pending",
    });
  });

  it("does not embed approved or withdrawn manual requests on the attendance card", async () => {
    const approvedWorld = createWorld();
    addPendingManualRequest(approvedWorld, {
      status: "approved",
      reviewedAt: "2026-04-13T11:00:00+09:00",
      rootRequestId: "manual_request_emp_001_2026-04-13_root",
    });
    setMockSeedWorldForTests(approvedWorld);

    const approvedResponse = await getAttendanceMe();
    const approvedBody = attendanceTodayResponseSchema.parse(
      await approvedResponse.json(),
    );
    expect(approvedBody.manualRequest).toBeNull();

    const withdrawnWorld = createWorld();
    addPendingManualRequest(withdrawnWorld, {
      status: "withdrawn",
      rootRequestId: "manual_request_emp_001_2026-04-13_root",
    });
    setMockSeedWorldForTests(withdrawnWorld);

    const withdrawnResponse = await getAttendanceMe();
    const withdrawnBody = attendanceTodayResponseSchema.parse(
      await withdrawnResponse.json(),
    );
    expect(withdrawnBody.manualRequest).toBeNull();
  });

  it("returns facts-first history without embedding raw request history", async () => {
    const response = await getAttendanceHistory(
      new Request(
        "https://example.com/api/attendance/me/history?from=2026-04-10&to=2026-04-13",
      ),
    );

    expect(response.status).toBe(200);
    const body = attendanceHistoryResponseSchema.parse(await response.json());

    expect(body.records).toHaveLength(4);
    expect(Object.hasOwn(body.records[0] ?? {}, "manualRequest")).toBe(false);
  });

  it("returns validation errors for invalid history query params", async () => {
    const response = await getAttendanceHistory(
      new Request(
        "https://example.com/api/attendance/me/history?from=2026-04-10",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "validation_error",
        message:
          'Invalid query parameter "to": Invalid input: expected string, received undefined',
      },
    });
  });

  it("creates a new manual-attendance request and returns the full request resource", async () => {
    const response = await createManualAttendance(
      new Request("https://example.com/api/attendance/manual", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          date: "2026-04-13",
          action: "clock_in",
          requestedClockInAt: "2026-04-13T09:05:00+09:00",
          reason: "Beacon was unavailable during check-in.",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(
      manualAttendanceRequestResponseSchema.parse(await response.json()),
    ).toMatchObject({
      requestType: "manual_attendance",
      date: "2026-04-13",
      status: "pending",
      activeStatus: "pending",
      effectiveStatus: "pending",
    });
  });

  it("returns conflict responses for duplicate manual-attendance roots", async () => {
    const world = createWorld();
    addPendingManualRequest(world);
    setMockSeedWorldForTests(world);

    const response = await createManualAttendance(
      new Request("https://example.com/api/attendance/manual", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          date: "2026-04-13",
          action: "both",
          requestedClockInAt: "2026-04-13T09:05:00+09:00",
          requestedClockOutAt: "2026-04-13T18:05:00+09:00",
          reason: "Submitting a duplicate request should conflict.",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "conflict",
        message:
          'A governing manual attendance chain already exists for employee "emp_001" on date "2026-04-13"',
      },
    });
  });

  it("edits and withdraws a pending request, and subsequent reads refresh accordingly", async () => {
    const world = createWorld();
    addPendingManualRequest(world);
    setMockSeedWorldForTests(world);

    const editResponse = await patchManualAttendance(
      new Request(
        "https://example.com/api/attendance/manual/manual_request_emp_001_2026-04-13_root",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            reason: "Edited note before review.",
          }),
        },
      ),
      {
        params: Promise.resolve({
          id: "manual_request_emp_001_2026-04-13_root",
        }),
      },
    );

    expect(editResponse.status).toBe(200);
    const editedBody = manualAttendanceRequestResponseSchema.parse(
      await editResponse.json(),
    );
    expect(editedBody).toMatchObject({
      reason: "Edited note before review.",
      submittedAt: "2026-04-13T10:05:00+09:00",
    });

    const todayAfterEdit = attendanceTodayResponseSchema.parse(
      await (await getAttendanceMe()).json(),
    );
    expect(todayAfterEdit.manualRequest).toMatchObject({
      reason: "Edited note before review.",
    });

    const withdrawResponse = await patchManualAttendance(
      new Request(
        "https://example.com/api/attendance/manual/manual_request_emp_001_2026-04-13_root",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            status: "withdrawn",
          }),
        },
      ),
      {
        params: Promise.resolve({
          id: "manual_request_emp_001_2026-04-13_root",
        }),
      },
    );

    expect(withdrawResponse.status).toBe(200);
    expect(
      manualAttendanceRequestResponseSchema.parse(
        await withdrawResponse.json(),
      ),
    ).toMatchObject({
      status: "withdrawn",
      activeRequestId: null,
      activeStatus: null,
      effectiveStatus: "withdrawn",
    });

    const todayAfterWithdraw = attendanceTodayResponseSchema.parse(
      await (await getAttendanceMe()).json(),
    );
    expect(todayAfterWithdraw.manualRequest).toBeNull();
  });

  it("returns not-found and lifecycle conflicts for invalid patch targets", async () => {
    const missingResponse = await patchManualAttendance(
      new Request("https://example.com/api/attendance/manual/req_missing", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reason: "Attempting to edit a missing request.",
        }),
      }),
      {
        params: Promise.resolve({
          id: "req_missing",
        }),
      },
    );

    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({
      error: {
        code: "not_found",
        message: 'Manual attendance request "req_missing" was not found',
      },
    });

    const world = createWorld();
    addPendingManualRequest(world, {
      id: "manual_request_emp_001_2026-04-13_reviewed",
      status: "rejected",
      reviewedAt: "2026-04-13T11:00:00+09:00",
      reviewComment: "Please clarify the correction context.",
      rootRequestId: "manual_request_emp_001_2026-04-13_reviewed",
    });
    setMockSeedWorldForTests(world);

    const reviewedResponse = await patchManualAttendance(
      new Request(
        "https://example.com/api/attendance/manual/manual_request_emp_001_2026-04-13_reviewed",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            reason: "Trying to edit a reviewed request.",
          }),
        },
      ),
      {
        params: Promise.resolve({
          id: "manual_request_emp_001_2026-04-13_reviewed",
        }),
      },
    );

    expect(reviewedResponse.status).toBe(409);
    await expect(reviewedResponse.json()).resolves.toEqual({
      error: {
        code: "conflict",
        message:
          'Manual attendance request "manual_request_emp_001_2026-04-13_reviewed" is no longer pending',
      },
    });
  });
});
