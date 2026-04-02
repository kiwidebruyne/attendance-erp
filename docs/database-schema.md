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

### Request Status

- `pending`
- `revision_requested`
- `withdrawn`
- `approved`
- `rejected`

The exact lifecycle semantics for reviewed-request changes, follow-up chains, and revision-requested flows are defined in `docs/request-lifecycle-model.md`.
This document owns the conceptual entities and final enum names, not the broader workflow rationale.

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

| Field             | Type           | Notes                                                                |
| ----------------- | -------------- | -------------------------------------------------------------------- |
| `id`              | string         | stable record identifier                                             |
| `employeeId`      | string         | relation to `Employee.id`                                            |
| `date`            | string         | target workday                                                       |
| `clockInAt`       | string or null | null until a successful or approved clock-in fact exists             |
| `clockInSource`   | string or null | `beacon` or `manual`                                                 |
| `clockOutAt`      | string or null | null while the workday is still open or checkout is missing          |
| `clockOutSource`  | string or null | `beacon` or `manual`                                                 |
| `workMinutes`     | number or null | derived from completed in/out facts when available                   |
| `manualRequestId` | string or null | link to the approved manual request that last wrote back this record |

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

| Field                   | Type           | Notes                                                                             |
| ----------------------- | -------------- | --------------------------------------------------------------------------------- |
| `id`                    | string         | stable request identifier                                                         |
| `employeeId`            | string         | relation to `Employee.id`                                                         |
| `requestType`           | enum           | always `leave`                                                                    |
| `leaveType`             | enum           | `Leave Type`                                                                      |
| `date`                  | string         | target leave date                                                                 |
| `startAt`               | string or null | required only when `leaveType` is `hourly`                                        |
| `endAt`                 | string or null | required only when `leaveType` is `hourly`                                        |
| `reason`                | string         | employee-provided note                                                            |
| `status`                | enum           | `Request Status`                                                                  |
| `requestedAt`           | string         | submission time                                                                   |
| `reviewedAt`            | string or null | timestamp of the latest review event                                              |
| `reviewComment`         | string or null | non-empty string when the latest review event used `reject` or `request_revision` |
| `rootRequestId`         | string         | self for the root request; same root id for every follow-up in the chain          |
| `parentRequestId`       | string or null | immediate earlier request for a follow-up; `null` on the root request             |
| `followUpKind`          | enum or null   | `Follow-Up Kind` for follow-up requests; `null` on the root request               |
| `supersededByRequestId` | string or null | later approved follow-up that supersedes this request                             |

Hourly leave durations are derived from `startAt` and `endAt` and may be exposed in API and UI output as `hours`, but `hours` is not authoritative input on the canonical request entity.

Important rules:

- In the first pass, leave requests may target only today or a future workday.
- Duplicate prevention is overlap-based, not type-label-based: the same employee cannot create a second unsuperseded root leave chain whose effective leave interval overlaps another unsuperseded root chain.
- When `leaveType = hourly`, `startAt` and `endAt` are the authoritative interval fields and `hours` is derived output only.

### Employee Leave Top Surface Suppression

Represents employee-specific persistent suppression of one reviewed non-approved leave request from top correction auto-surfacing on `/attendance/leave`.

| Field        | Type   | Notes                                                                                      |
| ------------ | ------ | ------------------------------------------------------------------------------------------ |
| `employeeId` | string | relation to `Employee.id`                                                                  |
| `requestId`  | string | relation to `Leave Request.id`                                                             |
| `createdAt`  | string | timestamp when the employee chose to suppress the reviewed request from top auto-surfacing |

Important rules:

- This relation is valid only for a reviewed leave request whose `status` is `rejected` or `revision_requested` and which currently has no active follow-up.
- The relation may remain readable through employee history even after the request no longer qualifies for top auto-surfacing.
- This relation does not change `Leave Request.status` or the shared request-chain projection.

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

### Company Event

Represents a seeded read-only company calendar input that can make a date operationally sensitive for leave review.

| Field   | Type   | Notes                                   |
| ------- | ------ | --------------------------------------- |
| `id`    | string | stable company-event identifier         |
| `date`  | string | calendar date on which the event exists |
| `title` | string | display label for the company event     |

Important rules:

- Company events are read-only seeded inputs in the mock world.
- Leave conflict policy may read them for warnings, but leave endpoints do not mutate them.

### Manual Attendance Request

Represents a manual correction request when successful attendance facts are missing or incomplete.

| Field                   | Type           | Notes                                                                             |
| ----------------------- | -------------- | --------------------------------------------------------------------------------- |
| `id`                    | string         | stable request identifier                                                         |
| `employeeId`            | string         | relation to `Employee.id`                                                         |
| `requestType`           | enum           | always `manual_attendance`                                                        |
| `action`                | enum           | `Manual Attendance Action`                                                        |
| `date`                  | string         | target workday                                                                    |
| `submittedAt`           | string         | employee submission timestamp                                                     |
| `requestedClockInAt`    | string or null | required when `action` is `clock_in` or `both`                                    |
| `requestedClockOutAt`   | string or null | required when `action` is `clock_out` or `both`                                   |
| `reason`                | string         | employee-provided note                                                            |
| `status`                | enum           | `Request Status`                                                                  |
| `reviewedAt`            | string or null | timestamp of the latest review event                                              |
| `reviewComment`         | string or null | non-empty string when the latest review event used `reject` or `request_revision` |
| `rootRequestId`         | string         | self for the root request; same root id for every follow-up in the chain          |
| `parentRequestId`       | string or null | immediate earlier request for a follow-up; `null` on the root request             |
| `followUpKind`          | enum or null   | only `resubmission` is in current scope for manual attendance follow-ups          |
| `supersededByRequestId` | string or null | later request that supersedes this request when current-product rules allow it    |

Important rules:

- One governing manual-attendance chain exists per employee per target date.
- Root duplicate policy is date-scoped, not action-scoped. A second root request conflicts even when the action differs, as long as the employee already has a governing manual-attendance chain for that date.
- `clock_out` requests are valid only when the target day already has an open attendance record; otherwise the employee must submit `both`.
- `submittedAt` is separate from the requested clock timestamps and should not be overloaded with the target attendance time.

Approved manual-attendance requests currently do not support post-approval follow-up `change` or `cancel`.

### Request Review Event

Represents one append-only admin review record for either a leave request or a manual attendance request.
In the current product, a request record gets at most one review event because reviewed non-approved requests stay locked and approved requests are not administratively reopened.

| Field           | Type           | Notes                                                                         |
| --------------- | -------------- | ----------------------------------------------------------------------------- |
| `id`            | string         | stable review-event identifier                                                |
| `requestId`     | string         | relation to one leave or manual attendance request                            |
| `decision`      | enum           | `Request Review Decision`                                                     |
| `reviewComment` | string or null | required non-empty string for `reject` and `request_revision`; otherwise null |
| `reviewedAt`    | string         | review timestamp                                                              |
| `reviewerId`    | string         | relation to `Employee.id` for the acting admin                                |

## Derived Views

### Manual Attendance Request Summary

Represents the endpoint-facing attendance projection for the manual request that still matters to the current attendance state, including prior-workday carry-over corrections.
This is derived from `Manual Attendance Request` rather than persisted as a second source of truth.

| Field                    | Type           | Notes                                                                                                                                                   |
| ------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | string         | stable request identifier                                                                                                                               |
| `action`                 | enum           | `Manual Attendance Action`                                                                                                                              |
| `date`                   | string         | target workday                                                                                                                                          |
| `submittedAt`            | string         | employee submission timestamp                                                                                                                           |
| `requestedClockInAt`     | string or null | required when `action` is `clock_in` or `both`                                                                                                          |
| `requestedClockOutAt`    | string or null | required when `action` is `clock_out` or `both`                                                                                                         |
| `status`                 | enum           | `Request Status`; attendance endpoints surface only `pending`, `revision_requested`, or `rejected`                                                      |
| `reviewComment`          | string or null | non-empty string when the latest review event used `reject` or `request_revision`                                                                       |
| `governingReviewComment` | string or null | latest unresolved `reject` or `request_revision` rationale that must remain visible while a linked follow-up has not yet resolved that reviewed outcome |
| `rootRequestId`          | string         | root request in the chain                                                                                                                               |
| `parentRequestId`        | string or null | immediate prior request for a follow-up                                                                                                                 |
| `followUpKind`           | enum or null   | only `resubmission` is in current scope for manual attendance follow-ups                                                                                |
| `activeRequestId`        | string or null | chain-level active request                                                                                                                              |
| `activeStatus`           | enum or null   | chain-level active status                                                                                                                               |
| `effectiveRequestId`     | string         | request whose current status governs the chain                                                                                                          |
| `effectiveStatus`        | enum           | chain-level effective status                                                                                                                            |
| `hasActiveFollowUp`      | boolean        | whether an employee-submitted follow-up is currently active                                                                                             |
| `nextAction`             | enum           | `Request Next Action`                                                                                                                                   |

This projection is returned only through `GET /api/attendance/me` and `GET /api/admin/attendance/today`. It is not a full request detail payload and is not persisted as a second source of truth.

### Request Chain Projection

Represents the minimum request-state projection that employee and admin surfaces must interpret the same way.

Expected fields:

- `activeRequestId`
- `activeStatus`
- `effectiveRequestId`
- `effectiveStatus`
- `governingReviewComment`
- `hasActiveFollowUp`
- `nextAction`

Important rules:

- When a chain is `rejected` or `revision_requested` with no active follow-up, `activeRequestId` and `activeStatus` are `null`, while `effectiveRequestId` and `effectiveStatus` still point to that reviewed request and `nextAction = none`.
- When an employee submits a linked `resubmission`, `activeRequestId`, `activeStatus`, `effectiveRequestId`, and `effectiveStatus` move to the new pending follow-up while the earlier non-approved rationale may remain visible through linked request history or parent-request context.
- `governingReviewComment` stays populated only while the latest non-approved reviewed outcome has not yet been resolved by a linked follow-up; otherwise it is `null`.
- Employee pages may still expose linked `resubmission` entry points from request status and relation fields even though the shared projection no longer treats the reviewed non-approved step as active work.
- Employee-only leave top-surface suppression is separate visibility metadata and must not change `active*`, `effective*`, `governingReviewComment`, or `nextAction`.

### Leave Conflict Projection

Represents the read-only leave conflict context shared by employee leave entry and admin leave review surfaces.

Expected fields:

- `companyEventContext`
- `effectiveApprovedLeaveContext`
- `pendingLeaveContext`
- `staffingRisk`
- `requiresApprovalConfirmation`

Important rules:

- API resources that expose this projection use the field name `leaveConflict`.
- Employee pre-submit warning flow may expose the same projection through selected-date entry context before a leave-request record exists.
- The projection is derived from read-only seeded company-event inputs plus the current leave-chain state, and it is shared by employee leave entry pre-submit warnings and admin leave review surfaces.
- It applies to employee pre-submit warning flow and to active pending review and approved-state `change`/`cancel` follow-up review.
- `pendingLeaveContext` stays context only and does not become automatic blocking math.
- `staffingRisk = warning` means manual admin approval is required; employee-facing surfaces still allow submission.
- The projection does not include employee-only top-surface suppression metadata.

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
- Once `absent` is finalized for a still-missing workday, the next employee attendance action becomes `submit_manual_request` instead of `clock_in`.
- `previous_day_checkout_missing` uses the `09:00` carry-over cutoff in the workday timezone carried by the attendance facts.
- `previous_day_checkout_missing` applies only while the prior workday still has no `clockOutAt`.

### Previous Day Open Record Summary

Represents the prior workday that remains open because checkout is still missing.
This summary is derived from `Attendance Record` and `Expected Workday`, then surfaced as a high-priority operational exception.

Expected fields:

- previous work date
- prior clock-in fact
- missing checkout state
- expected checkout time

Important rule:

- This summary only drives `previous_day_checkout_missing` while the prior workday remains open, meaning `clockOutAt` is still `null`.

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
- `reject` moves a request into the `rejected` status and stores a non-empty `reviewComment`
- `request_revision` moves a request into the `revision_requested` status and stores a non-empty `reviewComment`

In the current product, an admin review action is valid only for the current pending active unsuperseded request in a chain.

Expected fields:

- request id
- employee identity block
- `requestType`
- subtype detail such as leave type or manual attendance action
- target date
- reason
- request status
- `reviewComment`, which is `null` unless the latest review event used `reject` or `request_revision`
- relation fields: `rootRequestId`, `parentRequestId`, `followUpKind`, `supersededByRequestId`
- `Request Chain Projection`
- submission and review timestamps

Manual attendance queue items use `submittedAt` for the submission timestamp; leave queue items continue to use `requestedAt`.

## Relationships

- One `Employee` has many `Expected Workday` rows.
- One `Employee` has many `Attendance Attempt` rows.
- One `Employee` has many `Attendance Record` rows.
- One `Employee` has one `Leave Balance`.
- One `Employee` has many `Leave Request` rows.
- One `Employee` has many `Employee Leave Top Surface Suppression` rows.
- One `Employee` has many derived `Leave Coverage` intervals from approved leave requests.
- One `Employee` has many `Manual Attendance Request` rows.
- One `Employee` acting as an admin may author many `Request Review Event` rows.
- One `Leave Request` may have zero or one `Request Review Event` in the current product.
- One `Leave Request` may have zero or one `Employee Leave Top Surface Suppression` row for its owning employee in the current product.
- One `Manual Attendance Request` may have zero or one `Request Review Event` in the current product.
- `rootRequestId`, `parentRequestId`, and `followUpKind` link requests into a chain without a separate `chainId`.
- `supersededByRequestId` links an older request to the later approved follow-up that replaced it.
- A `Manual Attendance Request` may be linked back to one `Attendance Record` after approval writeback.
- Attendance display state is derived from expected workdays, attempts, records, leave coverage, and request state.
- The admin request queue is derived from both request entities plus chain projection rules.

## Change Triggers

- Update this document whenever entity meaning, enum values, or relationships change.
- Update `docs/api-spec.md` in the same change when those changes affect the API contract.
