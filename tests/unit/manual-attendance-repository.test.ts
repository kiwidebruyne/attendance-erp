import { describe, expect, it } from "vitest";

import {
  attendanceSurfaceManualRequestResourceSchema,
  manualAttendanceRequestResourceSchema,
} from "@/lib/contracts/shared";
import {
  buildManualAttendanceRequestResource,
  createManualAttendanceRequest,
  ManualAttendanceConflictError,
  ManualAttendanceValidationError,
  resolveAttendanceSurfaceManualRequest,
  updateManualAttendanceRequest,
} from "@/lib/repositories/manual-attendance";
import { manualAttendanceRequestEntitySchema } from "@/lib/seed/entities";
import { buildFixedSeoulDateTime } from "@/lib/seed/seoul-clock";
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

  it("returns date-scoped manual requests on the attendance surface and hides approved or withdrawn rows", () => {
    const pendingWorld = createPendingManualRequestWorld();

    const pendingSummary = resolveAttendanceSurfaceManualRequest(
      pendingWorld,
      "emp_001",
      "2026-04-10",
    );
    const approvedSummary = resolveAttendanceSurfaceManualRequest(
      canonicalSeedWorld,
      "emp_007",
      "2026-04-03",
    );
    const withdrawnSummary = resolveAttendanceSurfaceManualRequest(
      createWithdrawnManualRequestWorld(),
      "emp_001",
      "2026-04-13",
    );

    expect(() =>
      attendanceSurfaceManualRequestResourceSchema.parse(pendingSummary),
    ).not.toThrow();
    expect(pendingSummary).toMatchObject({
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

  it("sorts date-scoped chain requests before deriving the attendance surface summary", () => {
    const world = createWorld();

    world.manualAttendanceRequests.push(
      {
        id: "manual_request_emp_001_2026-04-13_resubmission",
        employeeId: "emp_001",
        requestType: "manual_attendance",
        action: "clock_in",
        date: "2026-04-13",
        submittedAt: "2026-04-13T11:30:00+09:00",
        requestedClockInAt: "2026-04-13T09:04:00+09:00",
        requestedClockOutAt: null,
        reason:
          "Approved resubmission should clear the stale rejected summary.",
        status: "approved",
        reviewedAt: "2026-04-13T12:00:00+09:00",
        reviewComment: null,
        rootRequestId: "manual_request_emp_001_2026-04-13_root",
        parentRequestId: "manual_request_emp_001_2026-04-13_root",
        followUpKind: "resubmission",
        supersededByRequestId: null,
      },
      {
        id: "manual_request_emp_001_2026-04-13_root",
        employeeId: "emp_001",
        requestType: "manual_attendance",
        action: "clock_in",
        date: "2026-04-13",
        submittedAt: "2026-04-13T10:05:00+09:00",
        requestedClockInAt: "2026-04-13T09:05:00+09:00",
        requestedClockOutAt: null,
        reason: "The root request was rejected before the approved follow-up.",
        status: "rejected",
        reviewedAt: "2026-04-13T11:00:00+09:00",
        reviewComment: "Please clarify the correction context.",
        rootRequestId: "manual_request_emp_001_2026-04-13_root",
        parentRequestId: null,
        followUpKind: null,
        supersededByRequestId: null,
      },
    );

    const summary = resolveAttendanceSurfaceManualRequest(
      world,
      "emp_001",
      "2026-04-13",
    );

    expect(summary).toBeNull();
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

  it("allows action edits to replace incompatible clock fields on one-sided pending requests", () => {
    const world = createWorld();

    world.manualAttendanceRequests.push({
      id: "manual_request_emp_001_2026-04-10_root",
      employeeId: "emp_001",
      requestType: "manual_attendance",
      action: "clock_in",
      date: "2026-04-10",
      submittedAt: "2026-04-10T09:20:00+09:00",
      requestedClockInAt: "2026-04-10T09:03:00+09:00",
      requestedClockOutAt: null,
      reason: "The original correction used the wrong action.",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: "manual_request_emp_001_2026-04-10_root",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    });

    const updated = updateManualAttendanceRequest(
      world,
      "emp_001",
      "manual_request_emp_001_2026-04-10_root",
      {
        action: "clock_out",
        requestedClockOutAt: "2026-04-10T18:10:00+09:00",
      },
    );

    expect(manualAttendanceRequestEntitySchema.parse(updated)).toMatchObject({
      id: "manual_request_emp_001_2026-04-10_root",
      action: "clock_out",
      requestedClockInAt: null,
      requestedClockOutAt: "2026-04-10T18:10:00+09:00",
    });
  });

  it("rejects opposite-side clock fields when a patch keeps the existing one-sided action", () => {
    const world = createWorld();

    world.manualAttendanceRequests.push({
      id: "manual_request_emp_001_2026-04-10_root",
      employeeId: "emp_001",
      requestType: "manual_attendance",
      action: "clock_in",
      date: "2026-04-10",
      submittedAt: "2026-04-10T09:20:00+09:00",
      requestedClockInAt: "2026-04-10T09:03:00+09:00",
      requestedClockOutAt: null,
      reason: "The original correction used the wrong action.",
      status: "pending",
      reviewedAt: null,
      reviewComment: null,
      rootRequestId: "manual_request_emp_001_2026-04-10_root",
      parentRequestId: null,
      followUpKind: null,
      supersededByRequestId: null,
    });

    expect(() =>
      updateManualAttendanceRequest(
        world,
        "emp_001",
        "manual_request_emp_001_2026-04-10_root",
        {
          requestedClockOutAt: "2026-04-10T18:10:00+09:00",
        },
      ),
    ).toThrowError(ManualAttendanceValidationError);
  });

  it("rejects repository-level create and withdraw shapes that the route contract disallows", () => {
    expect(() =>
      createManualAttendanceRequest(
        createResubmissionWorld(),
        "emp_009",
        {
          date: "2026-04-08",
          action: "clock_in",
          requestedClockInAt: "2026-04-08T09:08:00+09:00",
          reason: "Missing follow-up kind should still fail in the repository.",
          parentRequestId: "manual_request_emp_009_2026-04-08_root",
        },
        "2026-04-08T16:20:00+09:00",
      ),
    ).toThrowError(ManualAttendanceValidationError);

    expect(() =>
      updateManualAttendanceRequest(
        createWorld(),
        "emp_011",
        "manual_request_emp_011_2026-04-07_root",
        {
          status: "withdrawn",
          reason: "Withdrawal should not be combined with edits.",
        },
      ),
    ).toThrowError(ManualAttendanceValidationError);
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

  it("rejects clock_out-only requests when the target date has no open attendance record", () => {
    expect(() =>
      createManualAttendanceRequest(
        createWorld(),
        "emp_001",
        {
          date: "2026-04-09",
          action: "clock_out",
          requestedClockOutAt: buildFixedSeoulDateTime(
            "2026-04-09",
            "18:00:00",
          ),
          reason: "Clock-out alone should require an open attendance record.",
        },
        buildFixedSeoulDateTime("2026-04-09", "18:15:00"),
      ),
    ).toThrowError(ManualAttendanceConflictError);
  });
});
