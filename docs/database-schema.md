# Database Schema

## Purpose

This document defines the conceptual data model for the assignment.
It is not a physical database schema. Its job is to keep mock data, API contracts, and UI terminology aligned.

## Modeling Conventions

- IDs are stable strings.
- Local calendar dates use `YYYY-MM-DD`.
- Event timestamps use ISO 8601 strings with timezone offsets.
- Enum names should stay aligned with `docs/api-spec.md`.

## Shared Enums

### Attendance Status

- `working`: checked in, not yet checked out
- `normal`: completed workday without exception
- `late`: late arrival
- `early_leave`: early departure
- `absent`: no valid attendance record for the day
- `on_leave`: approved leave covers the day

### Verification Method

- `beacon`
- `manual`
- `none`

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

### Attendance Record

Represents one employee's attendance state for one calendar date.

| Field                | Type           | Notes                                             |
| -------------------- | -------------- | ------------------------------------------------- |
| `id`                 | string         | stable record identifier                          |
| `employeeId`         | string         | relation to `Employee.id`                         |
| `date`               | string         | target workday                                    |
| `clockInAt`          | string or null | null when the employee has not checked in         |
| `clockOutAt`         | string or null | null when the workday is still open or missing    |
| `workMinutes`        | number or null | derived from in and out times when complete       |
| `status`             | enum           | `Attendance Status`                               |
| `beaconVerified`     | boolean        | whether beacon verification succeeded             |
| `verificationMethod` | enum           | `Verification Method`                             |
| `manualRequestId`    | string or null | link to a manual correction request if one exists |

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

| Field             | Type           | Notes                                      |
| ----------------- | -------------- | ------------------------------------------ |
| `id`              | string         | stable request identifier                  |
| `employeeId`      | string         | relation to `Employee.id`                  |
| `requestType`     | enum           | always `leave`                             |
| `leaveType`       | enum           | `Leave Type`                               |
| `date`            | string         | target leave date                          |
| `hours`           | number or null | required only when `leaveType` is `hourly` |
| `reason`          | string         | employee-provided note                     |
| `status`          | enum           | `Approval Status`                          |
| `requestedAt`     | string         | submission time                            |
| `reviewedAt`      | string or null | admin decision time                        |
| `rejectionReason` | string or null | populated only when rejected               |

### Manual Attendance Request

Represents a manual correction request when beacon-based verification is missing or incomplete.

| Field             | Type           | Notes                        |
| ----------------- | -------------- | ---------------------------- |
| `id`              | string         | stable request identifier    |
| `employeeId`      | string         | relation to `Employee.id`    |
| `requestType`     | enum           | always `manual_attendance`   |
| `action`          | enum           | `Manual Attendance Action`   |
| `date`            | string         | target workday               |
| `requestedAt`     | string         | requested correction time    |
| `reason`          | string         | employee-provided note       |
| `status`          | enum           | `Approval Status`            |
| `reviewedAt`      | string or null | admin decision time          |
| `rejectionReason` | string or null | populated only when rejected |

## Derived Views

### Admin Request Queue Item

The admin review screen combines `Leave Request` and `Manual Attendance Request` into one derived list.
This should be treated as a query or view model rather than a separate persisted entity.

Expected fields:

- request id
- employee identity block
- `requestType`
- subtype detail such as leave type or manual attendance action
- target date
- reason
- approval status
- submission and review timestamps

## Relationships

- One `Employee` has many `Attendance Record` rows.
- One `Employee` has one `Leave Balance`.
- One `Employee` has many `Leave Request` rows.
- One `Employee` has many `Manual Attendance Request` rows.
- A `Manual Attendance Request` may be linked back to one `Attendance Record` after approval.
- The admin request queue is derived from both request entities.

## Change Triggers

- Update this document whenever entity meaning, enum values, or relationships change.
- Update `docs/api-spec.md` in the same change when those changes affect the API contract.
