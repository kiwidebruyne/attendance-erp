# Database Schema

## Purpose

This document defines the conceptual data model for the assignment.
It is not a physical database schema. Its job is to keep mock data, API contracts, and UI terminology aligned.
The runtime meaning of those concepts over time lives in `docs/attendance-operating-model.md`.

## Modeling Conventions

- IDs are stable strings.
- Local calendar dates use `YYYY-MM-DD`.
- Event timestamps use ISO 8601 strings with timezone offsets.
- Canonical facts should stay separate from derived presentation state.
- API-visible derived concepts should stay aligned with `docs/api-spec.md`.
- Time-sequenced attendance lifecycle and exception timing should stay aligned with `docs/attendance-operating-model.md`.

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

### Approval Status

- `pending`
- `approved`
- `rejected`

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

## Entities

### Employee

| Field        | Type   | Notes                                            |
| ------------ | ------ | ------------------------------------------------ |
| `id`         | string | stable employee identifier                       |
| `name`       | string | display name used in employee and admin views    |
| `department` | string | team grouping shown in admin tables              |
| `role`       | string | minimal role label such as `employee` or `admin` |

### Expected Workday

Represents the attendance expectation for one employee on one calendar date before any success or failure is interpreted into UI state.

| Field                      | Type           | Notes                                                                        |
| -------------------------- | -------------- | ---------------------------------------------------------------------------- |
| `id`                       | string         | stable expectation identifier                                                |
| `employeeId`               | string         | relation to `Employee.id`                                                    |
| `date`                     | string         | target workday                                                               |
| `isWorkday`                | boolean        | false for non-working dates such as weekends or company-wide closures        |
| `expectedClockInAt`        | string or null | baseline start time before leave adjustment                                  |
| `expectedClockOutAt`       | string or null | baseline end time before leave adjustment                                    |
| `adjustedClockInAt`        | string or null | expected start time after approved leave coverage is applied                 |
| `adjustedClockOutAt`       | string or null | expected end time after approved leave coverage is applied                   |
| `countsTowardAdminSummary` | boolean        | whether this employee-date should appear in same-day admin attendance counts |

### Attendance Attempt

Represents one append-only clock-in or clock-out attempt.

| Field           | Type           | Notes                                                                                                                       |
| --------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `id`            | string         | stable attempt identifier                                                                                                   |
| `employeeId`    | string         | relation to `Employee.id`                                                                                                   |
| `date`          | string         | intended workday for the attempt; may differ from the calendar date of `attemptedAt` during overnight carry-over resolution |
| `action`        | enum           | `Attendance Attempt Action`                                                                                                 |
| `attemptedAt`   | string         | actual timestamp of the button click                                                                                        |
| `status`        | enum           | `Attendance Attempt Status`                                                                                                 |
| `failureReason` | string or null | non-empty string when the attempt failed                                                                                    |

### Attendance Record

Represents the canonical attendance fact for one employee on one calendar date.
Unlike the previous single-status model, this entity stores facts only. Derived display state lives elsewhere.

| Field             | Type           | Notes                                                             |
| ----------------- | -------------- | ----------------------------------------------------------------- |
| `id`              | string         | stable record identifier                                          |
| `employeeId`      | string         | relation to `Employee.id`                                         |
| `date`            | string         | target workday                                                    |
| `clockInAt`       | string or null | null until a successful or approved clock-in fact exists          |
| `clockInSource`   | string or null | `beacon` or `manual`                                              |
| `clockOutAt`      | string or null | null while the workday is still open or checkout is missing       |
| `clockOutSource`  | string or null | `beacon` or `manual`                                              |
| `workMinutes`     | number or null | derived from completed in/out facts when available                |
| `manualRequestId` | string or null | link to the approved manual request that last changed this record |

### Manual Attendance Request Summary

Represents the date-scoped manual attendance request that remains visible in attendance endpoints until an admin finalizes or clears it through approval.

| Field             | Type           | Notes                                                                            |
| ----------------- | -------------- | -------------------------------------------------------------------------------- |
| `id`              | string         | stable request identifier                                                        |
| `action`          | enum           | `Manual Attendance Action`                                                       |
| `date`            | string         | target workday                                                                   |
| `requestedAt`     | string         | employee submission timestamp                                                    |
| `status`          | enum           | `Approval Status`; attendance endpoints only surface pending or rejected entries |
| `rejectionReason` | string or null | non-empty string when `status` is `rejected`; otherwise `null`                   |

### Leave Balance

Represents the employee-level leave summary used by the leave page.

| Field           | Type   | Notes                      |
| --------------- | ------ | -------------------------- |
| `employeeId`    | string | relation to `Employee.id`  |
| `totalDays`     | number | available yearly allowance |
| `usedDays`      | number | already consumed allowance |
| `remainingDays` | number | derived remaining balance  |

### Leave Request

Represents a submitted leave application.

| Field             | Type           | Notes                                          |
| ----------------- | -------------- | ---------------------------------------------- |
| `id`              | string         | stable request identifier                      |
| `employeeId`      | string         | relation to `Employee.id`                      |
| `requestType`     | enum           | always `leave`                                 |
| `leaveType`       | enum           | `Leave Type`                                   |
| `date`            | string         | target leave date                              |
| `hours`           | number or null | required only when `leaveType` is `hourly`     |
| `reason`          | string         | employee-provided note                         |
| `status`          | enum           | `Approval Status`                              |
| `requestedAt`     | string         | submission time                                |
| `reviewedAt`      | string or null | admin decision time                            |
| `rejectionReason` | string or null | non-empty string when rejected; null otherwise |

### Leave Coverage

Represents the approved leave interval as it is consumed by attendance modeling.
This is a derived attendance input rather than a separate employee-facing workflow object.

| Field        | Type   | Notes                                      |
| ------------ | ------ | ------------------------------------------ |
| `requestId`  | string | relation to an approved `Leave Request.id` |
| `employeeId` | string | relation to `Employee.id`                  |
| `date`       | string | covered calendar date                      |
| `leaveType`  | enum   | `Leave Type`                               |
| `startAt`    | string | covered interval start time                |
| `endAt`      | string | covered interval end time                  |

### Manual Attendance Request

Represents a manual correction request when successful attendance facts are missing or incomplete.

| Field             | Type           | Notes                                          |
| ----------------- | -------------- | ---------------------------------------------- |
| `id`              | string         | stable request identifier                      |
| `employeeId`      | string         | relation to `Employee.id`                      |
| `requestType`     | enum           | always `manual_attendance`                     |
| `action`          | enum           | `Manual Attendance Action`                     |
| `date`            | string         | target workday                                 |
| `requestedAt`     | string         | requested correction time                      |
| `reason`          | string         | employee-provided note                         |
| `status`          | enum           | `Approval Status`                              |
| `reviewedAt`      | string or null | admin decision time                            |
| `rejectionReason` | string or null | non-empty string when rejected; null otherwise |

## Derived Views

### Attendance Display

This is not a persisted canonical entity.
It is the derived presentation layer that combines `Expected Workday`, `Attendance Attempt`, `Attendance Record`, `Leave Coverage`, and request state into a UI-friendly answer.

Expected fields:

- `phase`
- `flags`
- `activeExceptions`
- `nextAction`

Important rules:

- `status` is no longer the canonical stored attendance field.
- `non_workday` is the derived phase only when `Expected Workday.isWorkday` is `false` and the same date still has no attendance facts.
- `working` and `checked_out` may still appear on non-workdays when same-day attendance facts exist.
- `late` and `early_leave` may coexist for the same date.
- `not_checked_in` is a real-time expected-but-missing exception, not a finalized absence.
- `absent` is a finalized derived interpretation after day-close.

### Previous Day Open Record Summary

Represents the prior workday that remains open because checkout is still missing.
This summary is derived from `Attendance Record` and `Expected Workday`, then surfaced as a high-priority operational exception.

Expected fields:

- previous work date
- prior clock-in fact
- missing checkout state
- expected checkout time

### Admin Attendance Summary

The admin attendance dashboard derives counts from canonical facts plus current expectations.

Expected fields:

- `checkedInCount`
- `notCheckedInCount`
- `lateCount`
- `onLeaveCount`
- `failedAttemptCount`
- `previousDayOpenCount`

### Admin Request Queue Item

The admin review screen combines `Leave Request` and `Manual Attendance Request` into one derived list.
This should be treated as a query or view model rather than a separate persisted entity.

The admin review action itself is an API command rather than a persisted entity field:

- `approve` moves a request into the `approved` status
- `reject` moves a request into the `rejected` status and stores a non-empty `rejectionReason`

Expected fields:

- request id
- employee identity block
- `requestType`
- subtype detail such as leave type or manual attendance action
- target date
- reason
- approval status
- `rejectionReason`, which is `null` unless approval status is `rejected`, where it must be a non-empty string
- submission and review timestamps

## Relationships

- One `Employee` has many `Expected Workday` rows.
- One `Employee` has many `Attendance Attempt` rows.
- One `Employee` has many `Attendance Record` rows.
- One `Employee` has one `Leave Balance`.
- One `Employee` has many `Leave Request` rows.
- One `Employee` has many derived `Leave Coverage` intervals from approved leave requests.
- One `Employee` has many `Manual Attendance Request` rows.
- A `Manual Attendance Request` may be linked back to one `Attendance Record` after approval.
- Attendance display state is derived from expected workdays, attempts, records, leave coverage, and request state.
- The admin request queue is derived from both request entities.

## Change Triggers

- Update this document whenever entity meaning, enum values, or relationships change.
- Update `docs/api-spec.md` in the same change when those changes affect the API contract.
