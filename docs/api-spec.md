# API Specification

## Purpose

This document defines the mock HTTP contract for the assignment.
It intentionally documents the assignment-facing REST API only. It does not lock in a future production backend design.
Attendance lifecycle semantics for `expectedWorkday`, `attendanceAttempt`, `attendanceRecord`, leave conflicts, and row-local open-checkout issues live in `docs/attendance-operating-model.md`.

## Common Conventions

- Base path: `/api`
- Content type: `application/json`
- Dates use `YYYY-MM-DD`
- Date-time values use ISO 8601 strings with timezone offsets
- Responses return resource-shaped JSON without a global `data` wrapper
- Errors return the shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Human-readable summary"
  }
}
```

- Some endpoint-specific error cases may append extra documented fields inside `error`, such as `activeRequestId` when a leave follow-up conflict needs to point at the already-active request.

## Shared Enums

### Attendance Phase

- `non_workday`
- `before_check_in`
- `working`
- `checked_out`

### Attendance Flag

- `late`
- `early_leave`

### Attendance Attempt Action

- `clock_in`
- `clock_out`

### Attendance Attempt Status

- `success`
- `failed`

### Attendance Exception Type

- `attempt_failed`
- `not_checked_in`
- `absent`
- `leave_work_conflict`
- `manual_request_pending`
- `manual_request_rejected`

### Next Action Type

- `clock_in`
- `clock_out`
- `submit_manual_request`
- `review_request_status`
- `review_leave_conflict`
- `wait`

### Request Status

- `pending`
- `revision_requested`
- `withdrawn`
- `approved`
- `rejected`

The exact lifecycle semantics for reviewed-request changes, follow-up chains, and revision-requested flows are defined in `docs/request-lifecycle-model.md`.
This document owns endpoint shapes and final field names, not the broader workflow rationale.

### Follow-Up Kind

- `resubmission`
- `change`
- `cancel`

### Request Review Decision

- `approve`
- `reject`
- `request_revision`

### Request Queue View

- `needs_review`
- `completed`
- `all`

### Request Next Action

- `admin_review`
- `none`

### Manual Attendance Action

- `clock_in`
- `clock_out`
- `both`

### Leave Type

- `annual`
- `half_am`
- `half_pm`
- `hourly`

### Request Type

- `manual_attendance`
- `leave`

## Shared Attendance Objects

### `Expected Workday`

Represents the work expectation for the requested calendar date before any attendance fact is derived into UI state.

Fields:

- `isWorkday`
- `expectedClockInAt`
- `expectedClockOutAt`
- `adjustedClockInAt`
- `adjustedClockOutAt`
- `countsTowardAdminSummary`
- `leaveCoverage`

`leaveCoverage` is either `null` or:

- `requestId`
- `leaveType`
- `startAt`
- `endAt`

### `Attendance Attempt`

Represents one append-only user attempt to clock in or clock out.

Fields:

- `id`
- `date`
- `action`
- `attemptedAt`
- `status`
- `failureReason`

`date` is the target workday for the attempt.
It may differ from the calendar date portion of `attemptedAt` when a next-day checkout still closes the prior workday.

### `Attendance Record`

Represents the canonical attendance fact for one workday after a successful event or an approved manual correction exists.

Fields:

- `id`
- `date`
- `clockInAt`
- `clockInSource`
- `clockOutAt`
- `clockOutSource`
- `workMinutes`

Allowed source values:

- `beacon`
- `manual`

### `Manual Attendance Request Summary`

Represents the date-scoped manual attendance request that still matters to the current attendance state.

Fields:

- `id`
- `action`
- `date`
- `submittedAt`
- `requestedClockInAt`
- `requestedClockOutAt`
- `status`
- `reviewComment`
- `governingReviewComment`
- `rootRequestId`
- `parentRequestId`
- `followUpKind`
- `activeRequestId`
- `activeStatus`
- `effectiveRequestId`
- `effectiveStatus`
- `hasActiveFollowUp`
- `nextAction`

`status` uses `Request Status`.
`reviewComment` is `null` unless the latest review event used `reject` or `request_revision`.
`governingReviewComment` is the latest unresolved `reject` or `request_revision` rationale that must remain visible while a linked follow-up has not yet resolved that reviewed outcome; otherwise it is `null`.
Attendance endpoints surface only `pending`, `revision_requested`, or `rejected` here.
Approved manual requests do not remain embedded here after their changes are written back into the canonical attendance record.

### `Request Chain Projection`

Represents the minimum shared request-state projection that employee and admin surfaces must interpret the same way.

Fields:

- `activeRequestId`
- `activeStatus`
- `effectiveRequestId`
- `effectiveStatus`
- `governingReviewComment`
- `hasActiveFollowUp`
- `nextAction`

`activeRequestId` and `activeStatus` are `null` when a chain has no active work.
`effectiveStatus` uses `Request Status`.
When a chain is `rejected` or `revision_requested` with no active follow-up, `activeRequestId` and `activeStatus` are `null`, while `effectiveRequestId` and `effectiveStatus` still point to the latest reviewed outcome and `nextAction = none`.
After an employee submits a linked `resubmission`, `active*` and `effective*` move to the new pending follow-up while the earlier review rationale remains visible through linked chain history or parent-request context.
`governingReviewComment` stays populated only while the latest non-approved reviewed outcome has not yet been resolved by a linked follow-up; otherwise it is `null`.
`nextAction` uses `Request Next Action`.
Employee pages may still expose linked `resubmission` entry points from request status and relation fields even though the shared projection no longer treats the reviewed non-approved step as active work.

### `Request Relation Fields`

These fields appear on leave-request and manual-attendance-request resources.

- `rootRequestId`
- `parentRequestId`
- `followUpKind`
- `supersededByRequestId`

`rootRequestId` points to the first request in the chain.
`parentRequestId` is `null` on the root request.

### `Attendance Display`

Represents derived presentation state rather than canonical stored state.

Fields:

- `phase`
- `flags`
- `activeExceptions`
- `nextAction`

`nextAction` is an object with:

- `type`
- `relatedRequestId`

`phase` is derived in precedence order: `checked_out` when the requested date already has a same-day checkout fact, `working` when the requested date has a same-day check-in fact without checkout, `non_workday` when no same-day attendance fact exists and `expectedWorkday.isWorkday` is `false`, and `before_check_in` otherwise.

## Employee Endpoints

### `GET /api/attendance/me`

Returns the current employee context, today's expected work window, current-day facts, operationally relevant attempts, and the derived display state for today.

Response:

```json
{
  "date": "2026-03-30",
  "employee": {
    "id": "emp_001",
    "name": "Alex Kim",
    "department": "Product"
  },
  "expectedWorkday": {
    "isWorkday": true,
    "expectedClockInAt": "2026-03-30T09:00:00+09:00",
    "expectedClockOutAt": "2026-03-30T18:00:00+09:00",
    "adjustedClockInAt": "2026-03-30T09:00:00+09:00",
    "adjustedClockOutAt": "2026-03-30T18:00:00+09:00",
    "countsTowardAdminSummary": true,
    "leaveCoverage": null
  },
  "todayRecord": {
    "id": "att_20260330_emp_001",
    "date": "2026-03-30",
    "clockInAt": "2026-03-30T09:03:00+09:00",
    "clockInSource": "beacon",
    "clockOutAt": null,
    "clockOutSource": null,
    "workMinutes": null
  },
  "attempts": [
    {
      "id": "attempt_001",
      "date": "2026-03-30",
      "action": "clock_in",
      "attemptedAt": "2026-03-30T09:03:00+09:00",
      "status": "success",
      "failureReason": null
    }
  ],
  "manualRequest": null,
  "display": {
    "phase": "working",
    "flags": ["late"],
    "activeExceptions": [],
    "nextAction": {
      "type": "clock_out",
      "relatedRequestId": null
    }
  }
}
```

Response notes:

- `todayRecord` is `null` until a successful attendance fact exists or an approved manual correction writes one back.
- `attempts` may include any attempt that still matters for the current card state; each attempt's `date` identifies the target workday.
- `manualRequest` is `null` unless a `pending`, `revision_requested`, or `rejected` manual attendance request still matters for the same requested date's attendance state.
- Consumers should treat `manualRequest` as a compact row-level projection rather than a full request detail payload. It appears on `GET /api/attendance/me`, `GET /api/attendance/me/history`, and `GET /api/admin/attendance/today`, but history rows restrict it to same-date `pending` requests only.
- If an employee edits or withdraws a pending manual request before review, the row should refresh from the latest projection. Approved manual requests should disappear from this embedded surface once canonical attendance writeback completes.
- `display.activeExceptions` may contain multiple values at once.
- `display.phase` follows the shared attendance-phase precedence rule, so a non-workday may still render as `working` or `checked_out` when same-day attendance facts exist.
- `not_checked_in` is a real-time expected-but-missing exception, not a finalized absence.
- When `display.activeExceptions` includes `absent`, `display.nextAction.type` must be `submit_manual_request` rather than `clock_in`.
- When `manualRequest.effectiveStatus` is `rejected` or `revision_requested`, `display.nextAction.type` must stay `review_request_status` so the employee lands on rationale and resubmission guidance instead of a fresh root submission path.

### `GET /api/attendance/me/history?from=&to=`

Returns date-level attendance facts plus derived display state over a selected range.

Query parameters:

- `from`: required start date
- `to`: required end date

Response:

```json
{
  "from": "2026-03-24",
  "to": "2026-03-30",
  "records": [
    {
      "date": "2026-03-30",
      "expectedWorkday": {
        "isWorkday": true,
        "expectedClockInAt": "2026-03-30T09:00:00+09:00",
        "expectedClockOutAt": "2026-03-30T18:00:00+09:00",
        "adjustedClockInAt": "2026-03-30T09:00:00+09:00",
        "adjustedClockOutAt": "2026-03-30T18:00:00+09:00",
        "countsTowardAdminSummary": true,
        "leaveCoverage": null
      },
      "record": {
        "id": "att_20260330_emp_001",
        "date": "2026-03-30",
        "clockInAt": "2026-03-30T09:03:00+09:00",
        "clockInSource": "beacon",
        "clockOutAt": null,
        "clockOutSource": null,
        "workMinutes": null
      },
      "manualRequest": null,
      "display": {
        "phase": "working",
        "flags": ["late"],
        "activeExceptions": [],
        "nextAction": {
          "type": "clock_out",
          "relatedRequestId": null
        }
      }
    }
  ]
}
```

Response notes:

- Each row keeps facts and derived display separate.
- `record` may be `null`.
- `manualRequest` is `null` unless the same history row currently has a `pending` manual attendance request that still governs that row's date.
- When present, `manualRequest` reuses the shared `Manual Attendance Request Summary` field set but narrows `status`, `activeStatus`, and `effectiveStatus` to `pending`.
- `display.activeExceptions` may include `absent` only after day-close finalization.
- A missing checkout from an earlier workday should remain a row-local issue on the affected date rather than appearing as a later-day exception.

### `POST /api/attendance/manual`

Creates a manual attendance request for the current employee.
The request itself does not mutate the canonical attendance record until an admin approves it.

Example request body:

- `date`: required target workday
- `action`: required `clock_in`, `clock_out`, or `both`
- `requestedClockInAt`: required when `action` is `clock_in` or `both`
- `requestedClockOutAt`: required when `action` is `clock_out` or `both`
- `reason`: required employee note
- `parentRequestId`: optional; required when creating a follow-up resubmission
- `followUpKind`: optional `resubmission` only in the current product
- `submittedAt` is not a client input on create; the server records it when the request is created and returns it in response payloads

Current-scope rules:

- Omit `parentRequestId` and `followUpKind` for a new root request.
- A new root request conflicts when the employee already has a governing manual-attendance chain for the same target date, even if the earlier request used a different `action`.
- `clock_out` is valid only when the target day already has an open attendance record; otherwise the employee must use `both`.
- `followUpKind = resubmission` is valid only when the parent manual request currently has `status = rejected` or `revision_requested`.
- `followUpKind = resubmission` creates a new pending follow-up and does not reopen the parent reviewed request in place.
- Approved manual-attendance requests do not support follow-up `change` or `cancel` in the current product.

Example request body:

```json
{
  "date": "2026-03-30",
  "action": "clock_in",
  "requestedClockInAt": "2026-03-30T09:00:00+09:00",
  "reason": "Beacon was not detected at the office entrance."
}
```

Response:

```json
{
  "id": "req_manual_001",
  "requestType": "manual_attendance",
  "action": "clock_in",
  "date": "2026-03-30",
  "submittedAt": "2026-03-30T09:10:00+09:00",
  "requestedClockInAt": "2026-03-30T09:00:00+09:00",
  "requestedClockOutAt": null,
  "reason": "Beacon was not detected at the office entrance.",
  "status": "pending",
  "reviewedAt": null,
  "reviewComment": null,
  "governingReviewComment": null,
  "rootRequestId": "req_manual_001",
  "parentRequestId": null,
  "followUpKind": null,
  "supersededByRequestId": null,
  "activeRequestId": "req_manual_001",
  "activeStatus": "pending",
  "effectiveRequestId": "req_manual_001",
  "effectiveStatus": "pending",
  "hasActiveFollowUp": false,
  "nextAction": "admin_review"
}
```

Typical error cases:

- `400 validation_error` for malformed payloads
- `409 conflict` when a governing manual-attendance chain already exists for the same employee and target date
- `409 conflict` when the same chain already has another active employee follow-up
- `409 conflict` when the parent request is already approved and would require an out-of-scope manual-attendance rollback flow

### `PATCH /api/attendance/manual/[id]`

Edits a pending manual attendance request in place or withdraws it before review.

Request body:

- `date`: optional when editing the pending request
- `action`: optional when editing the pending request
- `requestedClockInAt`: optional when editing the pending request
- `requestedClockOutAt`: optional when editing the pending request
- `reason`: optional when editing the pending request
- `status`: optional; the only writable status value is `withdrawn`

Current-scope rules:

- The request must currently have `status = pending`.
- If `status = withdrawn`, omit the other editable fields.
- If `status` is omitted, provide at least one employee-editable field.
- `submittedAt` remains immutable after creation; edits update the pending request payload but do not replace the original submission timestamp.
- The resulting payload must still satisfy the action-specific clock rules: `clock_in` requires `requestedClockInAt`, `clock_out` requires `requestedClockOutAt`, and `both` requires both fields.
- If the resulting action is `clock_out`, the target day must already have an open attendance record; otherwise the employee must use `both`.
- This endpoint never creates a follow-up request; it only mutates the current pending request in place.

Example request body:

```json
{
  "reason": "Beacon failed again; correcting the note before review."
}
```

Example withdrawal body:

```json
{
  "status": "withdrawn"
}
```

Response:

```json
{
  "id": "req_manual_001",
  "requestType": "manual_attendance",
  "action": "clock_in",
  "date": "2026-03-30",
  "submittedAt": "2026-03-30T09:10:00+09:00",
  "requestedClockInAt": "2026-03-30T09:00:00+09:00",
  "requestedClockOutAt": null,
  "reason": "Beacon failed again; correcting the note before review.",
  "status": "pending",
  "reviewedAt": null,
  "reviewComment": null,
  "governingReviewComment": null,
  "rootRequestId": "req_manual_001",
  "parentRequestId": null,
  "followUpKind": null,
  "supersededByRequestId": null,
  "activeRequestId": "req_manual_001",
  "activeStatus": "pending",
  "effectiveRequestId": "req_manual_001",
  "effectiveStatus": "pending",
  "hasActiveFollowUp": false,
  "nextAction": "admin_review"
}
```

Typical error cases:

- `400 validation_error` when the payload mixes `status = withdrawn` with editable fields or otherwise violates the pending-edit contract
- `404 not_found` when the request id does not exist
- `409 conflict` when the request is no longer `pending`

### `GET /api/leave/me`

Returns leave balance plus the current employee's leave request history.

Query parameters:

- `date`: optional selected calendar date for employee leave-entry context; when supplied, the response may include `selectedDateContext.leaveConflict` using the shared `Leave Conflict Projection` shape even before a new leave request exists

Response notes:

- each request item uses `Request Status` and includes relation fields plus the shared `Request Chain Projection`
- `reviewComment` is `null` unless the latest review event used `reject` or `request_revision`
- a prior non-approved review rationale may remain visible through linked request history or parent-request context even after a resubmission is pending
- approved leave may later surface in attendance endpoints as `leaveCoverage`
- a later attendance fact on an approved leave-covered day should surface as a leave-work conflict in attendance APIs rather than silently rewriting the leave request
- follow-up `resubmission`, `change`, and `cancel` requests remain linked to the earlier request rather than silently replacing it
- hourly leave request items expose `startAt` and `endAt` as the authoritative interval fields, with `hours` derived for display/output only
- existing leave request items may also carry `leaveConflict` using the shared `Leave Conflict Projection` when active pending review or approved-state `change`/`cancel` follow-up review needs the same conflict context
- when `date` is supplied for employee leave entry and no new request exists yet, the same projection may appear at `selectedDateContext.leaveConflict` for pre-submit warning surfaces
- each leave request item in this `GET /api/leave/me` employee aggregate also includes `isTopSurfaceSuppressed`, an employee-specific derived flag for `/attendance/leave` top correction auto-surfacing only
- `isTopSurfaceSuppressed` is not a guaranteed field on every leave-request response shape; it is part of this employee aggregate response because this endpoint backs the leave page's history plus top-correction projection
- when `isTopSurfaceSuppressed = true`, the reviewed request remains available in history and date-relevant selected-date context surfaces but is excluded from top correction auto-surfacing until restored
- top-surface suppression persists across sessions and browser instances for the owning employee account
- admin request endpoints do not expose `isTopSurfaceSuppressed`

Response:

```json
{
  "balance": {
    "totalDays": 15,
    "usedDays": 4.5,
    "remainingDays": 10.5
  },
  "selectedDateContext": {
    "date": "2026-04-08",
    "leaveConflict": {
      "companyEventContext": [],
      "effectiveApprovedLeaveContext": [],
      "pendingLeaveContext": [],
      "staffingRisk": "warning",
      "requiresApprovalConfirmation": true
    }
  },
  "requests": [
    {
      "id": "req_leave_002",
      "requestType": "leave",
      "leaveType": "hourly",
      "date": "2026-04-03",
      "startAt": "2026-04-03T13:00:00+09:00",
      "endAt": "2026-04-03T15:00:00+09:00",
      "hours": 2,
      "reason": "Personal appointment moved later.",
      "status": "pending",
      "requestedAt": "2026-03-30T11:25:00+09:00",
      "reviewedAt": null,
      "reviewComment": null,
      "governingReviewComment": null,
      "rootRequestId": "req_leave_001",
      "parentRequestId": "req_leave_001",
      "followUpKind": "change",
      "supersededByRequestId": null,
      "activeRequestId": "req_leave_002",
      "activeStatus": "pending",
      "effectiveRequestId": "req_leave_001",
      "effectiveStatus": "approved",
      "hasActiveFollowUp": true,
      "nextAction": "admin_review",
      "isTopSurfaceSuppressed": false
    }
  ]
}
```

### `Leave Conflict Projection`

Represents the read-only conflict context shared by employee leave entry and admin leave review consumers.

Fields:

- `companyEventContext`
- `effectiveApprovedLeaveContext`
- `pendingLeaveContext`
- `staffingRisk`
- `requiresApprovalConfirmation`

Response notes:

- leave-request resources that expose this projection use the field name `leaveConflict`
- when no leave-request resource exists yet, `GET /api/leave/me?date=YYYY-MM-DD` may expose the same shape at `selectedDateContext.leaveConflict` for employee pre-submit warning flow
- the projection is derived from read-only seeded company-event inputs plus the current leave-chain state
- it applies to employee leave-entry warnings and admin review or approval surfaces, including active pending review and approved-state `change`/`cancel` follow-up review
- `pendingLeaveContext` stays context only and does not become automatic blocking math
- `staffingRisk = warning` means manual admin approval is required; employee-facing surfaces still allow submission
- `requiresApprovalConfirmation = true` whenever a warning-bearing approval still carries company-event or staffing-risk context
- when `requiresApprovalConfirmation = true`, admins must use the explicit confirmation path before approving
- employee-facing consumers must keep the projection qualitative and must not expose peer names or exact staffing counts
- employee-only top-surface suppression metadata does not belong in this projection

### `POST /api/leave/request`

Creates a leave request for the current employee.

Request body:

- `leaveType`: required
- `date`: required
- `startAt`: required only when `leaveType` is `hourly`
- `endAt`: required only when `leaveType` is `hourly`
- `reason`: required employee note
- `parentRequestId`: optional; required for follow-up submissions
- `followUpKind`: optional `resubmission`, `change`, or `cancel`

Current-scope rules:

- Omit `parentRequestId` and `followUpKind` for a new root leave request.
- `date` may target only today or a future workday in the first pass.
- `followUpKind = resubmission` is valid only when the parent request currently has `status = rejected` or `revision_requested`.
- `followUpKind = resubmission` creates a new pending follow-up and does not reopen the parent reviewed request in place.
- `followUpKind = change` or `cancel` is valid only when the parent request itself currently has `status = approved` and `supersededByRequestId = null`.
- Hourly leave uses explicit `startAt` and `endAt` interval fields. `hours` is derived output data and is not accepted as write input.
- Duplicate prevention is overlap-based, not type-label-based: the same employee cannot create a second unsuperseded root leave chain whose effective leave interval overlaps another unsuperseded root chain.
- A chain may have at most one active employee-submitted follow-up at a time.

Request body:

```json
{
  "leaveType": "hourly",
  "date": "2026-04-03",
  "startAt": "2026-04-03T13:00:00+09:00",
  "endAt": "2026-04-03T15:00:00+09:00",
  "reason": "Medical appointment moved later.",
  "parentRequestId": "req_leave_001",
  "followUpKind": "change"
}
```

Response:

```json
{
  "id": "req_leave_002",
  "requestType": "leave",
  "leaveType": "hourly",
  "date": "2026-04-03",
  "startAt": "2026-04-03T13:00:00+09:00",
  "endAt": "2026-04-03T15:00:00+09:00",
  "hours": 2,
  "reason": "Medical appointment moved later.",
  "status": "pending",
  "requestedAt": "2026-03-30T11:25:00+09:00",
  "reviewedAt": null,
  "reviewComment": null,
  "governingReviewComment": null,
  "rootRequestId": "req_leave_001",
  "parentRequestId": "req_leave_001",
  "followUpKind": "change",
  "supersededByRequestId": null,
  "activeRequestId": "req_leave_002",
  "activeStatus": "pending",
  "effectiveRequestId": "req_leave_001",
  "effectiveStatus": "approved",
  "hasActiveFollowUp": true,
  "nextAction": "admin_review"
}
```

Typical error cases:

- `400 validation_error` for invalid dates, missing required fields, or invalid hourly intervals
- `409 conflict` when an overlapping leave request already exists for the same employee
- `409 conflict` when the same chain already has another active employee follow-up; include the existing active follow-up request id in the error payload
- `409 conflict` when `followUpKind` does not match the parent request's current lifecycle state

Example follow-up conflict payload:

```json
{
  "error": {
    "code": "conflict",
    "message": "Leave request chain \"req_leave_001\" already has an active follow-up request",
    "activeRequestId": "req_leave_002"
  }
}
```

### `PATCH /api/leave/request/[id]`

Edits a pending leave request in place or withdraws it before review.

Request body:

- `leaveType`: optional when editing the pending request
- `date`: optional when editing the pending request
- `startAt`: optional when editing the pending hourly request
- `endAt`: optional when editing the pending hourly request
- `reason`: optional when editing the pending request
- `status`: optional; the only writable status value is `withdrawn`

Current-scope rules:

- The request must currently have `status = pending`.
- If `status = withdrawn`, omit the other editable fields.
- If `status` is omitted, provide at least one employee-editable field.
- If `date` is provided, the resulting request must still target today or a future workday in the first pass.
- Hourly leave edits must still produce a valid `startAt`/`endAt` interval, and `hours` remains derived output rather than writable input.
- The resulting request must still avoid overlap with another unsuperseded root leave chain for the same employee.
- This endpoint never creates a follow-up request; approved-state leave change or cancel still requires `POST /api/leave/request` with `followUpKind`.

Example request body:

```json
{
  "startAt": "2026-04-03T12:00:00+09:00",
  "endAt": "2026-04-03T15:00:00+09:00",
  "reason": "The appointment window expanded."
}
```

Example withdrawal body:

```json
{
  "status": "withdrawn"
}
```

Response:

```json
{
  "id": "req_leave_001",
  "requestType": "leave",
  "leaveType": "hourly",
  "date": "2026-04-03",
  "startAt": "2026-04-03T12:00:00+09:00",
  "endAt": "2026-04-03T15:00:00+09:00",
  "hours": 3,
  "reason": "The appointment window expanded.",
  "status": "pending",
  "requestedAt": "2026-03-30T11:25:00+09:00",
  "reviewedAt": null,
  "reviewComment": null,
  "governingReviewComment": null,
  "rootRequestId": "req_leave_001",
  "parentRequestId": null,
  "followUpKind": null,
  "supersededByRequestId": null,
  "activeRequestId": "req_leave_001",
  "activeStatus": "pending",
  "effectiveRequestId": "req_leave_001",
  "effectiveStatus": "pending",
  "hasActiveFollowUp": false,
  "nextAction": "admin_review"
}
```

Typical error cases:

- `400 validation_error` when the payload mixes `status = withdrawn` with editable fields, provides an invalid hourly interval, or otherwise violates the pending-edit contract
- `404 not_found` when the request id does not exist
- `409 conflict` when the edited request would overlap another unsuperseded root leave chain for the same employee
- `409 conflict` when the request is no longer `pending`

### `PUT /api/leave/request/[id]/top-surface-suppression`

Persists top-surface suppression for one reviewed non-approved leave request owned by the current employee.

Current-scope rules:

- The request must belong to the current employee.
- The request must currently have `requestType = leave`.
- The request must currently have `status = rejected` or `revision_requested`.
- The request must currently have `hasActiveFollowUp = false`.
- The endpoint creates or preserves an `Employee Leave Top Surface Suppression` relation and does not reopen, rewrite, or re-review the request.
- Repeating the same `PUT` is idempotent.

Response:

- `204 no content`

Typical error cases:

- `404 not_found` when the request id does not exist for the current employee
- `409 conflict` when the request is not currently suppressible under the leave request lifecycle rules

### `DELETE /api/leave/request/[id]/top-surface-suppression`

Restores top correction auto-surfacing for one previously suppressed reviewed non-approved leave request owned by the current employee.

Current-scope rules:

- The request must belong to the current employee.
- Restoring does not change the request record, review rationale, or request-chain projection.
- Repeating the same `DELETE` is idempotent, even when no suppression relation currently exists.

Response:

- `204 no content`

Typical error cases:

- `404 not_found` when the request id does not exist for the current employee

## Admin Endpoints

### `GET /api/admin/attendance/today`

Returns today's team-level summary plus employee-level fact and exception rows for same-day operations.
The seeded example below assumes the deterministic Monday-noon snapshot, so most same-day records are already present while a small set of operational exceptions remains visible.

Response:

```json
{
  "date": "2026-04-13",
  "summary": {
    "checkedInCount": 9,
    "notCheckedInCount": 2,
    "lateCount": 1,
    "onLeaveCount": 1,
    "failedAttemptCount": 1
  },
  "items": [
    {
      "employee": {
        "id": "emp_001",
        "name": "Minji Park",
        "department": "Operations"
      },
      "expectedWorkday": {
        "isWorkday": true,
        "expectedClockInAt": "2026-04-13T09:00:00+09:00",
        "expectedClockOutAt": "2026-04-13T18:00:00+09:00",
        "adjustedClockInAt": "2026-04-13T09:00:00+09:00",
        "adjustedClockOutAt": "2026-04-13T18:00:00+09:00",
        "countsTowardAdminSummary": true,
        "leaveCoverage": null
      },
      "todayRecord": {
        "id": "attendance_record_emp_001_2026-04-13",
        "date": "2026-04-13",
        "clockInAt": "2026-04-13T08:58:00+09:00",
        "clockInSource": "beacon",
        "clockOutAt": null,
        "clockOutSource": null,
        "workMinutes": null
      },
      "display": {
        "phase": "working",
        "flags": [],
        "activeExceptions": [],
        "nextAction": {
          "type": "clock_out",
          "relatedRequestId": null
        }
      },
      "latestFailedAttempt": null,
      "manualRequest": null
    }
  ]
}
```

Response notes:

- This endpoint is the default same-day operations surface for `/admin/attendance`, not a general-purpose historical ledger.
- `latestFailedAttempt` is `null` unless the employee has an unresolved failed attempt that still matters operationally.
- When present, `latestFailedAttempt` reuses the shared `Attendance Attempt` shape but must keep `status = failed` and a non-empty `failureReason`; its `date` identifies the target workday even if `attemptedAt` falls on the next calendar date during overnight prior-workday writeback.
- `manualRequest` is `null` unless a `pending`, `revision_requested`, or `rejected` manual attendance request still matters for that employee's same-date attendance state.
- Consumers should treat `manualRequest` as a compact row-level projection rather than a full request detail payload. It appears on `GET /api/attendance/me`, `GET /api/attendance/me/history`, and `GET /api/admin/attendance/today`, but history rows restrict it to same-date `pending` requests only.
- If an employee edits or withdraws a pending manual request before review, the row should refresh from the latest projection. Approved manual requests should disappear from this embedded surface once canonical attendance writeback completes.
- No-record employees must still appear when they count toward today's expected workday and their current operational state already needs attention, such as after the adjusted expected start or when a failed attempt or current manual request is still active.

### `GET /api/admin/attendance/list?from=&to=&name=`

Returns date-level attendance facts plus derived display state across employees for a selected range.

Query parameters:

- `from`: required start date
- `to`: required end date
- `name`: optional employee-name filter

Response:

```json
{
  "from": "2026-03-01",
  "to": "2026-03-30",
  "filters": {
    "name": "alex"
  },
  "total": 22,
  "records": [
    {
      "date": "2026-03-30",
      "employee": {
        "id": "emp_001",
        "name": "Alex Kim",
        "department": "Product"
      },
      "expectedWorkday": {
        "isWorkday": true,
        "expectedClockInAt": "2026-03-30T09:00:00+09:00",
        "expectedClockOutAt": "2026-03-30T18:00:00+09:00",
        "adjustedClockInAt": "2026-03-30T09:00:00+09:00",
        "adjustedClockOutAt": "2026-03-30T18:00:00+09:00",
        "countsTowardAdminSummary": true,
        "leaveCoverage": null
      },
      "record": {
        "id": "att_20260330_emp_001",
        "date": "2026-03-30",
        "clockInAt": "2026-03-30T09:03:00+09:00",
        "clockInSource": "beacon",
        "clockOutAt": null,
        "clockOutSource": null,
        "workMinutes": null
      },
      "display": {
        "phase": "working",
        "flags": ["late"],
        "activeExceptions": [],
        "nextAction": {
          "type": "clock_out",
          "relatedRequestId": null
        }
      },
      "latestFailedAttempt": null
    }
  ]
}
```

Response notes:

- This endpoint backs the secondary history review mode for `/admin/attendance`, not the default today-first operations surface.
- When present, `latestFailedAttempt` still represents a failed attempt only, so `status` must be `failed`.
- Historical rows stay date-scoped and do not embed the compact `manualRequest` projection used by `GET /api/admin/attendance/today`.

## Request Review Endpoints

### `GET /api/admin/requests?view=`

Returns the request-review queue for admins.

Query parameters:

- `view`: optional `needs_review`, `completed`, or `all`; defaults to `needs_review` when omitted

Response notes:

- each item uses `Request Status` plus relation fields and the shared `Request Chain Projection`
- leave request items also expose nullable `startAt` and `endAt` interval fields; hourly leave items populate them and non-hourly leave items keep them `null`
- leave request items may also carry `leaveConflict` using the shared `Leave Conflict Projection` when the active review still has company-event or staffing-risk context; employee-only suppression metadata must not appear in admin items
- `reviewComment` is `null` unless the latest review event used `reject` or `request_revision`
- `governingReviewComment` stays populated while the latest non-approved reviewed outcome has not yet been resolved by a linked follow-up
- `needs_review` groups chains whose active request has `status = pending` and should be ordered newest pending request first
- `completed` groups chains whose effective status is `approved`, `withdrawn`, `revision_requested`, or `rejected` and which have no active follow-up; reviewed non-approved items with no active follow-up remain completed history only. Keep approved/withdrawn results ahead of reviewed non-approved history, place approved rows before withdrawn rows inside that first section, order approved items by latest review activity descending, order withdrawn items by their original submission timestamp (`submittedAt` for manual-attendance items, `requestedAt` for leave items), and order reviewed non-approved items by latest review activity descending
- `all` includes both actionable review work and completed review history; keep the same approved/withdrawn-before-reviewed-non-approved section order inside the completed portion, using the same per-section sort keys as `completed`
- admin clients may visually separate reviewed non-approved items from approved or withdrawn results inside `completed` and `all`
- `governingReviewComment` should remain visible in row and detail projections while unresolved rationale still governs
- request-chain semantics, reviewed-request immutability, and follow-up workflow rules are defined in `docs/request-lifecycle-model.md`

Response:

```json
{
  "viewFilter": "needs_review",
  "items": [
    {
      "id": "req_manual_001",
      "employee": {
        "id": "emp_001",
        "name": "Alex Kim",
        "department": "Product"
      },
      "requestType": "manual_attendance",
      "subtype": "clock_in",
      "targetDate": "2026-03-30",
      "reason": "Beacon was not detected at the office entrance.",
      "status": "pending",
      "submittedAt": "2026-03-30T09:10:00+09:00",
      "reviewedAt": null,
      "reviewComment": null,
      "governingReviewComment": null,
      "rootRequestId": "req_manual_001",
      "parentRequestId": null,
      "followUpKind": null,
      "supersededByRequestId": null,
      "activeRequestId": "req_manual_001",
      "activeStatus": "pending",
      "effectiveRequestId": "req_manual_001",
      "effectiveStatus": "pending",
      "hasActiveFollowUp": false,
      "nextAction": "admin_review"
    }
  ]
}
```

### `PATCH /api/admin/requests/[id]`

Writes the review event for the current pending active request in a chain.

Request body:

- `decision`: required `approve`, `reject`, or `request_revision`
- `reviewComment`: required non-empty string when `decision` is `reject` or `request_revision`; omit it when `decision` is `approve`

Response notes:

- `status` uses `Request Status`
- `reviewComment` is `null` when `status` is `approved`; required non-empty string when `status` is `rejected` or `revision_requested`
- `reviewedAt` is the timestamp of the latest review event
- only the current pending active unsuperseded request in a chain is writable
- once a request is `rejected` or `revision_requested`, that same request record is locked until the employee submits a linked `resubmission` follow-up
- approved manual attendance requests should write back into the relevant attendance record and clear stale attendance warnings in employee and admin views
- the endpoint must reject writes to `rejected`, `revision_requested`, `approved`, `withdrawn`, or superseded requests with `409 conflict`

```json
{
  "decision": "request_revision",
  "reviewComment": "Please clarify the missing clock-out time."
}
```

Response:

```json
{
  "id": "req_manual_001",
  "requestType": "manual_attendance",
  "status": "revision_requested",
  "reviewedAt": "2026-03-30T13:15:00+09:00",
  "reviewComment": "Please clarify the missing clock-out time.",
  "governingReviewComment": "Please clarify the missing clock-out time.",
  "activeRequestId": null,
  "activeStatus": null,
  "effectiveRequestId": "req_manual_001",
  "effectiveStatus": "revision_requested",
  "hasActiveFollowUp": false,
  "nextAction": "none"
}
```

Typical error cases:

- `400 validation_error` for invalid decision payloads
- `404 not_found` when the request id does not exist
- `409 conflict` when the request is `rejected`, `revision_requested`, `approved`, `withdrawn`, superseded, or otherwise not writable under the current request-lifecycle rules
- `409 conflict` should explain when a reviewed request remains locked on the same record and that any later resubmission must use a linked follow-up rather than reopening the reviewed request in place

## Change Triggers

- Update this document whenever an endpoint, parameter, payload field, enum, or error behavior changes.
- Update `docs/database-schema.md` in the same change whenever shared vocabulary or entity meaning changes.
