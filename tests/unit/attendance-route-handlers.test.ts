import { afterEach, describe, expect, it } from "vitest";

import { GET as getAdminAttendanceList } from "@/app/api/admin/attendance/list/route";
import { GET as getAdminAttendanceToday } from "@/app/api/admin/attendance/today/route";
import { PATCH as patchManualAttendance } from "@/app/api/attendance/manual/[id]/route";
import { POST as createManualAttendance } from "@/app/api/attendance/manual/route";
import { GET as getAttendanceHistory } from "@/app/api/attendance/me/history/route";
import { GET as getAttendanceMe } from "@/app/api/attendance/me/route";
import {
  adminAttendanceListResponseSchema,
  adminAttendanceTodayResponseSchema,
} from "@/lib/contracts/admin-attendance";
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
    id: "manual_request_emp_001_2026-04-03_root",
    employeeId: "emp_001",
    requestType: "manual_attendance",
    action: "clock_in",
    date: "2026-04-03",
    submittedAt: "2026-04-03T10:05:00+09:00",
    requestedClockInAt: "2026-04-03T09:05:00+09:00",
    requestedClockOutAt: null,
    reason: "Beacon was unavailable during check-in.",
    status: "pending",
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: "manual_request_emp_001_2026-04-03_root",
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
      date: "2026-04-03",
      employee: {
        id: "emp_001",
      },
      todayRecord: {
        date: "2026-04-03",
        clockInSource: "beacon",
        clockOutAt: null,
      },
      manualRequest: null,
    });
  });

  it("keeps today-card manual requests scoped to the requested date", async () => {
    const world = createWorld();
    addPendingManualRequest(world, {
      id: "manual_request_emp_001_2026-04-03_root",
    });
    setMockSeedWorldForTests(world);

    const response = await getAttendanceMe();
    const body = attendanceTodayResponseSchema.parse(await response.json());

    expect(body.manualRequest).toMatchObject({
      id: "manual_request_emp_001_2026-04-03_root",
      date: "2026-04-03",
      status: "pending",
    });
  });

  it("does not embed approved or withdrawn manual requests on the attendance card", async () => {
    const approvedWorld = createWorld();
    addPendingManualRequest(approvedWorld, {
      status: "approved",
      reviewedAt: "2026-04-03T11:00:00+09:00",
      rootRequestId: "manual_request_emp_001_2026-04-03_root",
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
      rootRequestId: "manual_request_emp_001_2026-04-03_root",
    });
    setMockSeedWorldForTests(withdrawnWorld);

    const withdrawnResponse = await getAttendanceMe();
    const withdrawnBody = attendanceTodayResponseSchema.parse(
      await withdrawnResponse.json(),
    );
    expect(withdrawnBody.manualRequest).toBeNull();
  });

  it("returns facts-first history rows with an explicit nullable manualRequest projection", async () => {
    const response = await getAttendanceHistory(
      new Request(
        "https://example.com/api/attendance/me/history?from=2026-04-10&to=2026-04-13",
      ),
    );

    expect(response.status).toBe(200);
    const body = attendanceHistoryResponseSchema.parse(await response.json());

    expect(body.records).toHaveLength(4);
    expect(
      body.records.every((record) => Object.hasOwn(record, "manualRequest")),
    ).toBe(true);
    expect(body.records.every((record) => record.manualRequest === null)).toBe(
      true,
    );
  });

  it("embeds only pending manual-request projections in history rows", async () => {
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
      id: "manual_request_emp_001_2026-04-09_reviewed",
      date: "2026-04-09",
      status: "rejected",
      reviewedAt: "2026-04-13T11:00:00+09:00",
      reviewComment: "Please clarify the missing checkout details.",
      rootRequestId: "manual_request_emp_001_2026-04-09_reviewed",
    });
    addPendingManualRequest(world, {
      id: "manual_request_emp_001_2026-04-08_revision",
      date: "2026-04-08",
      status: "revision_requested",
      reviewedAt: "2026-04-13T11:30:00+09:00",
      reviewComment: "Please attach the beacon retry details.",
      rootRequestId: "manual_request_emp_001_2026-04-08_revision",
    });
    setMockSeedWorldForTests(world);

    const response = await getAttendanceHistory(
      new Request(
        "https://example.com/api/attendance/me/history?from=2026-04-08&to=2026-04-10",
      ),
    );

    expect(response.status).toBe(200);
    const body = attendanceHistoryResponseSchema.parse(await response.json());

    expect(
      body.records.find((record) => record.date === "2026-04-10")
        ?.manualRequest,
    ).toMatchObject({
      id: "manual_request_emp_001_2026-04-10_root",
      status: "pending",
      date: "2026-04-10",
    });
    expect(
      body.records.find((record) => record.date === "2026-04-09")
        ?.manualRequest,
    ).toBeNull();
    expect(
      body.records.find((record) => record.date === "2026-04-08")
        ?.manualRequest,
    ).toBeNull();
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
          date: "2026-04-03",
          action: "clock_in",
          requestedClockInAt: "2026-04-03T09:05:00+09:00",
          reason: "Beacon was unavailable during check-in.",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(
      manualAttendanceRequestResponseSchema.parse(await response.json()),
    ).toMatchObject({
      requestType: "manual_attendance",
      date: "2026-04-03",
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
          date: "2026-04-03",
          action: "both",
          requestedClockInAt: "2026-04-03T09:05:00+09:00",
          requestedClockOutAt: "2026-04-03T18:05:00+09:00",
          reason: "Submitting a duplicate request should conflict.",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "conflict",
        message:
          'A governing manual attendance chain already exists for employee "emp_001" on date "2026-04-03"',
      },
    });
  });

  it("edits and withdraws a pending request, and subsequent reads refresh accordingly", async () => {
    const world = createWorld();
    addPendingManualRequest(world);
    setMockSeedWorldForTests(world);

    const editResponse = await patchManualAttendance(
      new Request(
        "https://example.com/api/attendance/manual/manual_request_emp_001_2026-04-03_root",
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
          id: "manual_request_emp_001_2026-04-03_root",
        }),
      },
    );

    expect(editResponse.status).toBe(200);
    const editedBody = manualAttendanceRequestResponseSchema.parse(
      await editResponse.json(),
    );
    expect(editedBody).toMatchObject({
      reason: "Edited note before review.",
      submittedAt: "2026-04-03T10:05:00+09:00",
    });

    const todayAfterEdit = attendanceTodayResponseSchema.parse(
      await (await getAttendanceMe()).json(),
    );
    expect(todayAfterEdit.manualRequest).toMatchObject({
      reason: "Edited note before review.",
    });

    const withdrawResponse = await patchManualAttendance(
      new Request(
        "https://example.com/api/attendance/manual/manual_request_emp_001_2026-04-03_root",
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
          id: "manual_request_emp_001_2026-04-03_root",
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

  it("allows action edits that switch one-sided requests to the opposite action", async () => {
    const world = createWorld();
    addPendingManualRequest(world, {
      id: "manual_request_emp_001_2026-04-10_root",
      date: "2026-04-10",
      action: "clock_in",
      submittedAt: "2026-04-10T09:20:00+09:00",
      requestedClockInAt: "2026-04-10T09:03:00+09:00",
      requestedClockOutAt: null,
      reason: "The original correction used the wrong action.",
      rootRequestId: "manual_request_emp_001_2026-04-10_root",
    });
    setMockSeedWorldForTests(world);

    const response = await patchManualAttendance(
      new Request(
        "https://example.com/api/attendance/manual/manual_request_emp_001_2026-04-10_root",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "clock_out",
            requestedClockOutAt: "2026-04-10T18:10:00+09:00",
          }),
        },
      ),
      {
        params: Promise.resolve({
          id: "manual_request_emp_001_2026-04-10_root",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(
      manualAttendanceRequestResponseSchema.parse(await response.json()),
    ).toMatchObject({
      id: "manual_request_emp_001_2026-04-10_root",
      action: "clock_out",
      requestedClockInAt: null,
      requestedClockOutAt: "2026-04-10T18:10:00+09:00",
    });
  });

  it("rejects opposite-side clock fields when a patch keeps the existing one-sided action", async () => {
    const world = createWorld();
    addPendingManualRequest(world, {
      id: "manual_request_emp_001_2026-04-10_root",
      date: "2026-04-10",
      action: "clock_in",
      submittedAt: "2026-04-10T09:20:00+09:00",
      requestedClockInAt: "2026-04-10T09:03:00+09:00",
      requestedClockOutAt: null,
      reason: "The original correction used the wrong action.",
      rootRequestId: "manual_request_emp_001_2026-04-10_root",
    });
    setMockSeedWorldForTests(world);

    const response = await patchManualAttendance(
      new Request(
        "https://example.com/api/attendance/manual/manual_request_emp_001_2026-04-10_root",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            requestedClockOutAt: "2026-04-10T18:10:00+09:00",
          }),
        },
      ),
      {
        params: Promise.resolve({
          id: "manual_request_emp_001_2026-04-10_root",
        }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "validation_error",
        message:
          'Manual attendance "clock_in" does not accept "requestedClockOutAt"',
      },
    });
  });

  it("keeps admin attendance routes synchronized with employee manual-request mutations", async () => {
    const createResponse = await createManualAttendance(
      new Request("https://example.com/api/attendance/manual", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          date: "2026-04-03",
          action: "clock_in",
          requestedClockInAt: "2026-04-03T09:05:00+09:00",
          reason: "Beacon was unavailable during check-in.",
        }),
      }),
    );
    const createdRequest = manualAttendanceRequestResponseSchema.parse(
      await createResponse.json(),
    );

    expect(createResponse.status).toBe(201);

    const adminTodayAfterCreate = adminAttendanceTodayResponseSchema.parse(
      await (
        await getAdminAttendanceToday(
          new Request("https://example.com/api/admin/attendance/today"),
        )
      ).json(),
    );
    const adminTodayEmployeeRow = adminTodayAfterCreate.items.find(
      (item) => item.employee.id === "emp_001",
    );

    expect(adminTodayEmployeeRow?.manualRequest).toMatchObject({
      id: createdRequest.id,
      date: "2026-04-03",
      status: "pending",
    });

    const adminListAfterCreate = adminAttendanceListResponseSchema.parse(
      await (
        await getAdminAttendanceList(
          new Request(
            "https://example.com/api/admin/attendance/list?from=2026-04-03&to=2026-04-03&name=minji",
          ),
        )
      ).json(),
    );
    const adminListEmployeeRow = adminListAfterCreate.records.find(
      (record) =>
        record.employee.id === "emp_001" && record.date === "2026-04-03",
    );

    expect(adminListEmployeeRow?.display.activeExceptions).toContain(
      "manual_request_pending",
    );

    const withdrawResponse = await patchManualAttendance(
      new Request(
        `https://example.com/api/attendance/manual/${createdRequest.id}`,
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
          id: createdRequest.id,
        }),
      },
    );

    expect(withdrawResponse.status).toBe(200);

    const adminTodayAfterWithdraw = adminAttendanceTodayResponseSchema.parse(
      await (
        await getAdminAttendanceToday(
          new Request("https://example.com/api/admin/attendance/today"),
        )
      ).json(),
    );
    const adminTodayRowAfterWithdraw = adminTodayAfterWithdraw.items.find(
      (item) => item.employee.id === "emp_001",
    );

    expect(adminTodayRowAfterWithdraw?.manualRequest).toBeNull();

    const adminListAfterWithdraw = adminAttendanceListResponseSchema.parse(
      await (
        await getAdminAttendanceList(
          new Request(
            "https://example.com/api/admin/attendance/list?from=2026-04-03&to=2026-04-03&name=minji",
          ),
        )
      ).json(),
    );
    const adminListRowAfterWithdraw = adminListAfterWithdraw.records.find(
      (record) =>
        record.employee.id === "emp_001" && record.date === "2026-04-03",
    );

    expect(adminListRowAfterWithdraw?.display.activeExceptions).not.toContain(
      "manual_request_pending",
    );
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
      id: "manual_request_emp_001_2026-04-03_reviewed",
      status: "rejected",
      reviewedAt: "2026-04-03T11:00:00+09:00",
      reviewComment: "Please clarify the correction context.",
      rootRequestId: "manual_request_emp_001_2026-04-03_reviewed",
    });
    setMockSeedWorldForTests(world);

    const reviewedResponse = await patchManualAttendance(
      new Request(
        "https://example.com/api/attendance/manual/manual_request_emp_001_2026-04-03_reviewed",
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
          id: "manual_request_emp_001_2026-04-03_reviewed",
        }),
      },
    );

    expect(reviewedResponse.status).toBe(409);
    await expect(reviewedResponse.json()).resolves.toEqual({
      error: {
        code: "conflict",
        message:
          'Manual attendance request "manual_request_emp_001_2026-04-03_reviewed" is no longer pending',
      },
    });
  });
});
