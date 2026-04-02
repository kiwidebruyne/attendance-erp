import { describe, expect, it } from "vitest";

import {
  attendanceSurfaceManualRequestResourceSchema,
  manualAttendanceRequestResourceSchema,
} from "@/lib/contracts/shared";
import {
  buildManualAttendanceRequestResource,
  createManualAttendanceRequest,
  ManualAttendanceConflictError,
  resolveAttendanceSurfaceManualRequest,
  updateManualAttendanceRequest,
} from "@/lib/repositories/manual-attendance";
import { manualAttendanceRequestEntitySchema } from "@/lib/seed/entities";
import {
  buildFixedSeoulDateTime,
  fixedSeoulBaselineDate,
} from "@/lib/seed/seoul-clock";
import { type CanonicalSeedWorld, canonicalSeedWorld } from "@/lib/seed/world";

function createWorld() {
  return structuredClone(canonicalSeedWorld) as CanonicalSeedWorld;
}

function createPendingManualRequestWorld() {
  const world = createWorld();

  world.manualAttendanceRequests.push({
    id: "manual_request_emp_001_2026-04-10_root",
    employeeId: "emp_001",
    requestType: "manual_attendance",
    action: "clock_out",
    date: "2026-04-10",
    submittedAt: "2026-04-10T09:20:00+09:00",
    requestedClockInAt: null,
    requestedClockOutAt: "2026-04-10T18:05:00+09:00",
    reason:
      "The prior-day checkout recovery should stay visible on the carry-over row.",
    status: "pending",
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: "manual_request_emp_001_2026-04-10_root",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
  });

  return world;
}

function createWithdrawnManualRequestWorld() {
  const world = createWorld();

  world.manualAttendanceRequests.push({
    id: "manual_request_emp_001_2026-04-13_withdrawn",
    employeeId: "emp_001",
    requestType: "manual_attendance",
    action: "clock_in",
    date: "2026-04-13",
    submittedAt: "2026-04-13T09:20:00+09:00",
    requestedClockInAt: "2026-04-13T09:02:00+09:00",
    requestedClockOutAt: null,
    reason: "This request was withdrawn before review.",
    status: "withdrawn",
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: "manual_request_emp_001_2026-04-13_withdrawn",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
  });

  return world;
}

function createResubmissionWorld() {
  const world = createWorld();

  world.manualAttendanceRequests = world.manualAttendanceRequests.filter(
    (request) =>
      request.id !== "manual_request_emp_009_2026-04-08_resubmission",
  );

  return world;
}

function createDuplicateRootWorld() {
  const world = createWorld();

  world.manualAttendanceRequests.push({
    id: "manual_request_emp_001_2026-04-10_root",
    employeeId: "emp_001",
    requestType: "manual_attendance",
    action: "clock_in",
    date: "2026-04-10",
    submittedAt: "2026-04-10T09:18:00+09:00",
    requestedClockInAt: "2026-04-10T09:00:00+09:00",
    requestedClockOutAt: null,
    reason: "An earlier manual attendance request already governs this date.",
    status: "pending",
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: "manual_request_emp_001_2026-04-10_root",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
  });

  return world;
}

function createPatchDuplicateWorld() {
  const world = createWorld();

  world.manualAttendanceRequests.push({
    id: "manual_request_emp_001_2026-04-10_root",
    employeeId: "emp_001",
    requestType: "manual_attendance",
    action: "clock_in",
    date: "2026-04-10",
    submittedAt: "2026-04-10T09:18:00+09:00",
    requestedClockInAt: "2026-04-10T09:00:00+09:00",
    requestedClockOutAt: null,
    reason: "An earlier manual attendance request already governs this date.",
    status: "pending",
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: "manual_request_emp_001_2026-04-10_root",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
  });
  world.manualAttendanceRequests.push({
    id: "manual_request_emp_001_2026-04-13_root",
    employeeId: "emp_001",
    requestType: "manual_attendance",
    action: "clock_in",
    date: "2026-04-13",
    submittedAt: "2026-04-13T09:18:00+09:00",
    requestedClockInAt: "2026-04-13T09:05:00+09:00",
    requestedClockOutAt: null,
    reason: "This date is already occupied by a different chain.",
    status: "pending",
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: "manual_request_emp_001_2026-04-13_root",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
  });

  return world;
}

function createPendingActionSwitchWorld() {
  const world = createWorld();

  world.attendanceRecords.push({
    id: "attendance_record_emp_001_2026-04-19",
    employeeId: "emp_001",
    date: "2026-04-19",
    clockInAt: "2026-04-19T09:01:00+09:00",
    clockInSource: "beacon",
    clockOutAt: null,
    clockOutSource: null,
    workMinutes: null,
    manualRequestId: null,
  });

  world.manualAttendanceRequests.push({
    id: "manual_request_emp_001_2026-04-19_root",
    employeeId: "emp_001",
    requestType: "manual_attendance",
    action: "both",
    date: "2026-04-19",
    submittedAt: "2026-04-19T18:10:00+09:00",
    requestedClockInAt: "2026-04-19T09:01:00+09:00",
    requestedClockOutAt: "2026-04-19T18:00:00+09:00",
    reason: "Both attendance facts need correction before review.",
    status: "pending",
    reviewedAt: null,
    reviewComment: null,
    rootRequestId: "manual_request_emp_001_2026-04-19_root",
    parentRequestId: null,
    followUpKind: null,
    supersededByRequestId: null,
  });

  return world;
}

describe("manual attendance repository helpers", () => {
  it("builds a full resource with the governing review comment preserved on a pending resubmission", () => {
    const resource = buildManualAttendanceRequestResource(
      canonicalSeedWorld,
      "emp_009",
      "manual_request_emp_009_2026-04-08_resubmission",
    );

    expect(() =>
      manualAttendanceRequestResourceSchema.parse(resource),
    ).not.toThrow();
    expect(resource).toMatchObject({
      id: "manual_request_emp_009_2026-04-08_resubmission",
      requestType: "manual_attendance",
      status: "pending",
      governingReviewComment: "Please resubmit with a clearer arrival note.",
      rootRequestId: "manual_request_emp_009_2026-04-08_root",
      parentRequestId: "manual_request_emp_009_2026-04-08_root",
      followUpKind: "resubmission",
      activeRequestId: "manual_request_emp_009_2026-04-08_resubmission",
      activeStatus: "pending",
      effectiveRequestId: "manual_request_emp_009_2026-04-08_resubmission",
      effectiveStatus: "pending",
      hasActiveFollowUp: true,
      nextAction: "admin_review",
    });
  });

  it("returns the prior-day manual request on the attendance surface and hides approved or withdrawn rows", () => {
    const carryOverWorld = createPendingManualRequestWorld();

    const carryOverSummary = resolveAttendanceSurfaceManualRequest(
      carryOverWorld,
      "emp_001",
      "2026-04-13",
      {
        date: "2026-04-10",
      },
    );
    const approvedSummary = resolveAttendanceSurfaceManualRequest(
      canonicalSeedWorld,
      "emp_007",
      "2026-04-03",
      null,
    );
    const withdrawnSummary = resolveAttendanceSurfaceManualRequest(
      createWithdrawnManualRequestWorld(),
      "emp_001",
      "2026-04-13",
      null,
    );

    expect(() =>
      attendanceSurfaceManualRequestResourceSchema.parse(carryOverSummary),
    ).not.toThrow();
    expect(carryOverSummary).toMatchObject({
      id: "manual_request_emp_001_2026-04-10_root",
      date: "2026-04-10",
      status: "pending",
      governingReviewComment: null,
      activeRequestId: "manual_request_emp_001_2026-04-10_root",
      activeStatus: "pending",
      effectiveRequestId: "manual_request_emp_001_2026-04-10_root",
      effectiveStatus: "pending",
    });
    expect(approvedSummary).toBeNull();
    expect(withdrawnSummary).toBeNull();
  });

  it("creates a root request and rejects a second governing request for the same date even when the action differs", () => {
    const world = createWorld();
    const created = createManualAttendanceRequest(
      world,
      "emp_001",
      {
        date: "2026-04-19",
        action: "clock_in",
        requestedClockInAt: "2026-04-19T09:00:00+09:00",
        reason: "Beacon missed the first check-in.",
      },
      "2026-04-19T09:15:00+09:00",
    );

    expect(manualAttendanceRequestEntitySchema.parse(created)).toMatchObject({
      id: "manual_request_emp_001_2026-04-19_root",
      rootRequestId: "manual_request_emp_001_2026-04-19_root",
      parentRequestId: null,
      followUpKind: null,
      status: "pending",
      submittedAt: "2026-04-19T09:15:00+09:00",
    });

    expect(() =>
      createManualAttendanceRequest(
        createDuplicateRootWorld(),
        "emp_001",
        {
          date: "2026-04-10",
          action: "clock_out",
          requestedClockOutAt: "2026-04-10T18:05:00+09:00",
          reason: "A different action still hits the same governing chain.",
        },
        "2026-04-10T18:10:00+09:00",
      ),
    ).toThrowError(ManualAttendanceConflictError);
  });

  it("creates a resubmission only from rejected or revision-requested parents and rejects approved parents", () => {
    const world = createResubmissionWorld();

    const resubmission = createManualAttendanceRequest(
      world,
      "emp_009",
      {
        date: "2026-04-08",
        action: "clock_in",
        requestedClockInAt: "2026-04-08T09:08:00+09:00",
        reason: "Resubmitting the corrected arrival note.",
        parentRequestId: "manual_request_emp_009_2026-04-08_root",
        followUpKind: "resubmission",
      },
      "2026-04-08T16:20:00+09:00",
    );

    expect(
      manualAttendanceRequestEntitySchema.parse(resubmission),
    ).toMatchObject({
      id: "manual_request_emp_009_2026-04-08_resubmission",
      rootRequestId: "manual_request_emp_009_2026-04-08_root",
      parentRequestId: "manual_request_emp_009_2026-04-08_root",
      followUpKind: "resubmission",
      status: "pending",
    });

    expect(() =>
      createManualAttendanceRequest(
        createWorld(),
        "emp_007",
        {
          date: "2026-04-03",
          action: "clock_out",
          requestedClockOutAt: "2026-04-03T18:05:00+09:00",
          reason: "Approved manual attendance cannot be followed up in place.",
          parentRequestId: "manual_request_emp_007_2026-04-03_root",
          followUpKind: "resubmission",
        },
        "2026-04-03T18:15:00+09:00",
      ),
    ).toThrowError(ManualAttendanceConflictError);
  });

  it("falls back to the last reviewed non-approved outcome after a pending resubmission is withdrawn", () => {
    const world = createWorld();

    updateManualAttendanceRequest(
      world,
      "emp_009",
      "manual_request_emp_009_2026-04-08_resubmission",
      {
        status: "withdrawn",
      },
    );

    const resource = buildManualAttendanceRequestResource(
      world,
      "emp_009",
      "manual_request_emp_009_2026-04-08_resubmission",
    );

    expect(manualAttendanceRequestResourceSchema.parse(resource)).toMatchObject(
      {
        id: "manual_request_emp_009_2026-04-08_resubmission",
        status: "withdrawn",
        activeRequestId: null,
        activeStatus: null,
        effectiveRequestId: "manual_request_emp_009_2026-04-08_root",
        effectiveStatus: "rejected",
        governingReviewComment: "Please resubmit with a clearer arrival note.",
        nextAction: "none",
      },
    );
  });

  it("keeps follow-up manual-attendance requests on the parent chain target date", () => {
    expect(() =>
      createManualAttendanceRequest(
        createResubmissionWorld(),
        "emp_009",
        {
          date: "2026-04-09",
          action: "clock_in",
          requestedClockInAt: "2026-04-09T09:08:00+09:00",
          reason: "A resubmission must stay on the parent target date.",
          parentRequestId: "manual_request_emp_009_2026-04-08_root",
          followUpKind: "resubmission",
        },
        "2026-04-08T16:20:00+09:00",
      ),
    ).toThrowError(ManualAttendanceConflictError);

    expect(() =>
      updateManualAttendanceRequest(
        createWorld(),
        "emp_009",
        "manual_request_emp_009_2026-04-08_resubmission",
        {
          date: "2026-04-09",
        },
      ),
    ).toThrowError(ManualAttendanceConflictError);
  });

  it("patches a pending request in place, preserves submittedAt, and withdraws without reopening the request", () => {
    const editWorld = createWorld();
    const edited = updateManualAttendanceRequest(
      editWorld,
      "emp_011",
      "manual_request_emp_011_2026-04-07_root",
      {
        reason: "Beacon retry note clarified before review.",
      },
    );
    const withdrawWorld = createWorld();
    const withdrawn = updateManualAttendanceRequest(
      withdrawWorld,
      "emp_011",
      "manual_request_emp_011_2026-04-07_root",
      {
        status: "withdrawn",
      },
    );

    expect(manualAttendanceRequestEntitySchema.parse(edited)).toMatchObject({
      id: "manual_request_emp_011_2026-04-07_root",
      reason: "Beacon retry note clarified before review.",
      status: "pending",
      submittedAt: "2026-04-07T18:50:00+09:00",
    });
    expect(manualAttendanceRequestEntitySchema.parse(withdrawn)).toMatchObject({
      id: "manual_request_emp_011_2026-04-07_root",
      status: "withdrawn",
      submittedAt: "2026-04-07T18:50:00+09:00",
      reviewedAt: null,
      reviewComment: null,
    });

    expect(() =>
      updateManualAttendanceRequest(
        createWorld(),
        "emp_007",
        "manual_request_emp_007_2026-04-03_root",
        {
          reason: "Cannot edit an approved request in place.",
        },
      ),
    ).toThrowError(ManualAttendanceConflictError);
  });

  it("rejects a pending patch that moves the request onto a date already governed by another chain", () => {
    expect(() =>
      updateManualAttendanceRequest(
        createPatchDuplicateWorld(),
        "emp_001",
        "manual_request_emp_001_2026-04-10_root",
        {
          date: "2026-04-13",
        },
      ),
    ).toThrowError(ManualAttendanceConflictError);
  });

  it("drops obsolete stored clock fields when a pending patch changes action type", () => {
    const edited = updateManualAttendanceRequest(
      createPendingActionSwitchWorld(),
      "emp_001",
      "manual_request_emp_001_2026-04-19_root",
      {
        action: "clock_out",
        requestedClockOutAt: "2026-04-19T18:04:00+09:00",
      },
    );

    expect(manualAttendanceRequestEntitySchema.parse(edited)).toMatchObject({
      id: "manual_request_emp_001_2026-04-19_root",
      action: "clock_out",
      requestedClockInAt: null,
      requestedClockOutAt: "2026-04-19T18:04:00+09:00",
      status: "pending",
    });
  });

  it("rejects clock_out-only requests when the target date has no open attendance record", () => {
    expect(() =>
      createManualAttendanceRequest(
        createWorld(),
        "emp_001",
        {
          date: fixedSeoulBaselineDate,
          action: "clock_out",
          requestedClockOutAt: buildFixedSeoulDateTime(
            fixedSeoulBaselineDate,
            "18:00:00",
          ),
          reason: "Clock-out alone should require an open attendance record.",
        },
        buildFixedSeoulDateTime(fixedSeoulBaselineDate, "18:15:00"),
      ),
    ).toThrowError(ManualAttendanceConflictError);
  });
});
