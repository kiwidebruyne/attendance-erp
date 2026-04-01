# API Specification

## Purpose

This document defines the mock HTTP contract for the assignment.
It intentionally documents the assignment-facing REST API only. It does not lock in a future production backend design.
Attendance lifecycle semantics for `expectedWorkday`, `attendanceAttempt`, `attendanceRecord`, leave conflicts, and carry-over exceptions live in `docs/attendance-operating-model.md`.

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
- `previous_day_checkout_missing`
- `leave_work_conflict`
- `manual_request_pending`
- `manual_request_rejected`

### Next Action Type

- `clock_in`
- `clock_out`
- `submit_manual_request`
- `resolve_previous_day_checkout`
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
- `waiting_for_employee`
- `completed`
- `all`

### Request Next Action

- `admin_review`
- `employee_resubmit`
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

Represents the date-scoped manual attendance request that still matters to the current attendance state, including prior-workday carry-over corrections.

Fields:

- `id`
- `action`
- `date`
- `requestedAt`
- `status`
- `reviewComment`
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
Attendance endpoints surface only `pending`, `revision_requested`, or `rejected` here.
Approved manual requests do not remain embedded here after their changes are written back into the canonical attendance record.

### `Request Chain Projection`

Represents the minimum shared request-state projection that employee and admin surfaces must interpret the same way.

Fields:

- `activeRequestId`
- `activeStatus`
- `effectiveRequestId`
- `effectiveStatus`
- `hasActiveFollowUp`
- `nextAction`

`activeRequestId` and `activeStatus` are `null` when a chain has no active work.
`effectiveStatus` uses `Request Status`.
`nextAction` uses `Request Next Action`.

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

### `Previous Day Open Record`

Represents the still-open prior workday when checkout is missing.

Fields:

- `date`
- `clockInAt`
- `clockOutAt`
- `expectedClockOutAt`

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
  "previousDayOpenRecord": null,
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
- `previousDayOpenRecord` is `null` unless the prior workday is still open because checkout is missing.
- `attempts` may include any attempt that still matters for the current card state; each attempt's `date` identifies the target workday.
- `manualRequest` is `null` unless a `pending`, `revision_requested`, or `rejected` manual attendance request still matters for the current attendance state; when present it reuses the shared `Manual Attendance Request Summary` shape and may target the requested workday or the prior workday during carry-over handling.
- `display.activeExceptions` may contain multiple values at once.
- `display.phase` follows the shared attendance-phase precedence rule, so a non-workday may still render as `working` or `checked_out` when same-day attendance facts exist.
- `not_checked_in` is a real-time expected-but-missing exception, not a finalized absence.

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
- `display.activeExceptions` may include `absent` only after day-close finalization.

### `POST /api/attendance/manual`

Creates a manual attendance request for the current employee.
The request itself does not mutate the canonical attendance record until an admin approves it.

Example request body:

- `date`: required target workday
- `action`: required `clock_in`, `clock_out`, or `both`
- `requestedAt`: required employee submission time
- `reason`: required employee note
- `parentRequestId`: optional; required when creating a follow-up resubmission
- `followUpKind`: optional `resubmission` only in the current product

Current-scope rules:

- Omit `parentRequestId` and `followUpKind` for a new root request.
- `followUpKind = resubmission` is valid only when the parent manual request currently has `status = rejected` or `revision_requested`.
- Approved manual-attendance requests do not support follow-up `change` or `cancel` in the current product.

Example request body:

```json
{
  "date": "2026-03-30",
  "action": "clock_in",
  "requestedAt": "2026-03-30T09:00:00+09:00",
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
  "requestedAt": "2026-03-30T09:00:00+09:00",
  "reason": "Beacon was not detected at the office entrance.",
  "status": "pending",
  "reviewedAt": null,
  "reviewComment": null,
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
- `409 conflict` when a duplicate manual request already exists for the same employee and date
- `409 conflict` when the same chain already has another active employee follow-up
- `409 conflict` when the parent request is already approved and would require an out-of-scope manual-attendance rollback flow

### `GET /api/leave/me`

Returns leave balance plus the current employee's leave request history.

Response notes:

- each request item uses `Request Status` and includes relation fields plus the shared `Request Chain Projection`
- `reviewComment` is `null` unless the latest review event used `reject` or `request_revision`
- approved leave may later surface in attendance endpoints as `leaveCoverage`
- a later attendance fact on an approved leave-covered day should surface as a leave-work conflict in attendance APIs rather than silently rewriting the leave request
- follow-up `resubmission`, `change`, and `cancel` requests remain linked to the earlier request rather than silently replacing it

Response:

```json
{
  "balance": {
    "totalDays": 15,
    "usedDays": 4.5,
    "remainingDays": 10.5
  },
  "requests": [
    {
      "id": "req_leave_002",
      "requestType": "leave",
      "leaveType": "hourly",
      "date": "2026-04-03",
      "hours": 2,
      "reason": "Personal appointment moved later.",
      "status": "pending",
      "requestedAt": "2026-03-30T11:25:00+09:00",
      "reviewedAt": null,
      "reviewComment": null,
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
  ]
}
```

### `POST /api/leave/request`

Creates a leave request for the current employee.

Request body:

- `leaveType`: required
- `date`: required
- `hours`: required only when `leaveType` is `hourly`
- `reason`: required employee note
- `parentRequestId`: optional; required for follow-up submissions
- `followUpKind`: optional `resubmission`, `change`, or `cancel`

Current-scope rules:

- Omit `parentRequestId` and `followUpKind` for a new root leave request.
- `followUpKind = resubmission` is valid only when the parent request currently has `status = rejected` or `revision_requested`.
- `followUpKind = change` or `cancel` is valid only when the parent request currently has `effectiveStatus = approved`.
- A chain may have at most one active employee-submitted follow-up at a time.

Request body:

```json
{
  "leaveType": "hourly",
  "date": "2026-04-03",
  "hours": 2,
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
  "hours": 2,
  "reason": "Medical appointment moved later.",
  "status": "pending",
  "requestedAt": "2026-03-30T11:25:00+09:00",
  "reviewedAt": null,
  "reviewComment": null,
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

- `400 validation_error` for invalid dates or missing required fields
- `409 conflict` when a conflicting leave request already exists
- `409 conflict` when the same chain already has another active employee follow-up; include the existing active follow-up request id in the error payload
- `409 conflict` when `followUpKind` does not match the parent request's current lifecycle state

## Admin Endpoints

### `GET /api/admin/attendance/today`

Returns today's team-level summary plus employee-level fact and exception rows for same-day operations.

Response:

```json
{
  "date": "2026-03-30",
  "summary": {
    "checkedInCount": 8,
    "notCheckedInCount": 2,
    "lateCount": 1,
    "onLeaveCount": 1,
    "failedAttemptCount": 1,
    "previousDayOpenCount": 1
  },
  "items": [
    {
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
      "display": {
        "phase": "working",
        "flags": ["late"],
        "activeExceptions": [],
        "nextAction": {
          "type": "clock_out",
          "relatedRequestId": null
        }
      },
      "latestFailedAttempt": null,
      "previousDayOpenRecord": null,
      "manualRequest": null
    }
  ]
}
```

Response notes:

- `latestFailedAttempt` is `null` unless the employee has an unresolved failed attempt that still matters operationally.
- When present, `latestFailedAttempt` reuses the shared `Attendance Attempt` shape, and its `date` identifies the target workday even if `attemptedAt` falls on the next calendar date during carry-over handling.
- `previousDayOpenRecord` is `null` unless the prior workday is still open.
- `manualRequest` is `null` unless a `pending`, `revision_requested`, or `rejected` manual attendance request still matters for that employee's current attendance state; when present it reuses the shared `Manual Attendance Request Summary` shape and may target the requested workday or the prior workday during carry-over handling.
- No-record employees must still appear if they count toward today's expected workday.

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

## Request Review Endpoints

### `GET /api/admin/requests?view=`

Returns the request-review queue for admins.

Query parameters:

- `view`: optional `needs_review`, `waiting_for_employee`, `completed`, or `all`

Response notes:

- each item uses `Request Status` plus relation fields and the shared `Request Chain Projection`
- `reviewComment` is `null` unless the latest review event used `reject` or `request_revision`
- `needs_review` groups chains whose active request has `status = pending`
- `waiting_for_employee` groups chains whose effective status is `revision_requested` or `rejected` and which have no active follow-up
- `completed` groups chains whose effective status is `approved` or `withdrawn` and which have no active follow-up
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
      "requestedAt": "2026-03-30T09:10:00+09:00",
      "reviewedAt": null,
      "reviewComment": null,
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

Writes a new review event for a request.

Request body:

- `decision`: required `approve`, `reject`, or `request_revision`
- `reviewComment`: required non-empty string when `decision` is `reject` or `request_revision`; omit it when `decision` is `approve`

Response notes:

- `status` uses `Request Status`
- `reviewComment` is `null` when `status` is `approved`; required non-empty string when `status` is `rejected` or `revision_requested`
- `reviewedAt` is the timestamp of the latest review event
- approved manual attendance requests should write back into the relevant attendance record and clear stale attendance warnings in employee and admin views
- the endpoint may append a revised non-approved decision on the same request, but it must reject writes to `approved`, `withdrawn`, or superseded requests with `409 conflict`

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
  "activeRequestId": null,
  "activeStatus": null,
  "effectiveRequestId": "req_manual_001",
  "effectiveStatus": "revision_requested",
  "hasActiveFollowUp": false,
  "nextAction": "employee_resubmit"
}
```

Typical error cases:

- `400 validation_error` for invalid decision payloads
- `404 not_found` when the request id does not exist
- `409 conflict` when the request is `approved`, `withdrawn`, superseded, or otherwise not writable under the current request-lifecycle rules

## Change Triggers

- Update this document whenever an endpoint, parameter, payload field, enum, or error behavior changes.
- Update `docs/database-schema.md` in the same change whenever shared vocabulary or entity meaning changes.
