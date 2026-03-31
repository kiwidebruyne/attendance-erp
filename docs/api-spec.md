# API Specification

## Purpose

This document defines the mock HTTP contract for the assignment.
It intentionally documents the assignment-facing REST API only. It does not lock in a future production backend design.

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

### Attendance Status

- `working`
- `normal`
- `late`
- `early_leave`
- `absent`
- `on_leave`

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

## Employee Endpoints

### `GET /api/attendance/me`

Returns the current employee context and today's attendance state.

Response:

```json
{
  "date": "2026-03-30",
  "employee": {
    "id": "emp_001",
    "name": "Alex Kim",
    "department": "Product"
  },
  "today": {
    "clockInAt": "2026-03-30T09:03:00+09:00",
    "clockOutAt": null,
    "workMinutes": null,
    "status": "working",
    "beaconVerified": true,
    "verificationMethod": "beacon",
    "manualRequest": null
  }
}
```

### `GET /api/attendance/me/history?from=&to=`

Returns attendance history for the signed-in employee over a date range.

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
      "clockInAt": "2026-03-30T09:03:00+09:00",
      "clockOutAt": null,
      "workMinutes": null,
      "status": "working",
      "beaconVerified": true,
      "verificationMethod": "beacon"
    }
  ]
}
```

### `POST /api/attendance/manual`

Creates a manual attendance request for the current employee.

Request body:

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
  "status": "pending"
}
```

Typical error cases:

- `400 validation_error` for malformed payloads
- `409 conflict` when a duplicate manual request already exists for the same employee and date

### `GET /api/leave/me`

Returns leave balance plus the current employee's leave request history.

Response notes:

- `rejectionReason`: `null` unless `status` is `rejected`; required non-empty string when `status` is `rejected`

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
      "id": "req_leave_001",
      "requestType": "leave",
      "leaveType": "annual",
      "date": "2026-04-02",
      "hours": null,
      "reason": "Personal appointment",
      "status": "pending",
      "requestedAt": "2026-03-30T11:10:00+09:00",
      "reviewedAt": null,
      "rejectionReason": null
    }
  ]
}
```

### `POST /api/leave/request`

Creates a leave request for the current employee.

Request body:

```json
{
  "leaveType": "hourly",
  "date": "2026-04-03",
  "hours": 2,
  "reason": "Medical appointment"
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
  "reason": "Medical appointment",
  "status": "pending",
  "requestedAt": "2026-03-30T11:25:00+09:00",
  "reviewedAt": null,
  "rejectionReason": null
}
```

Typical error cases:

- `400 validation_error` for invalid dates or missing required fields
- `409 conflict` when a conflicting leave request already exists

## Admin Endpoints

### `GET /api/admin/attendance/today`

Returns today's team-level summary and same-day attendance rows.

Response:

```json
{
  "date": "2026-03-30",
  "summary": {
    "checkedInCount": 8,
    "notCheckedInCount": 2,
    "lateCount": 1,
    "onLeaveCount": 1
  },
  "items": [
    {
      "employeeId": "emp_001",
      "name": "Alex Kim",
      "department": "Product",
      "clockInAt": "2026-03-30T09:03:00+09:00",
      "clockOutAt": null,
      "status": "working",
      "verificationMethod": "beacon"
    }
  ]
}
```

### `GET /api/admin/attendance/list?from=&to=&name=`

Returns attendance rows across employees for a selected date range.

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
      "employeeId": "emp_001",
      "name": "Alex Kim",
      "department": "Product",
      "clockInAt": "2026-03-30T09:03:00+09:00",
      "clockOutAt": null,
      "workMinutes": null,
      "status": "working",
      "verificationMethod": "beacon"
    }
  ]
}
```

### `GET /api/admin/requests?status=`

Returns the request-review queue for admins.

Query parameters:

- `status`: optional `pending`, `approved`, or `rejected`

Response notes:

- `rejectionReason`: `null` unless an item `status` is `rejected`; required non-empty string when an item `status` is `rejected`

Response:

```json
{
  "statusFilter": "pending",
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
      "rejectionReason": null
    }
  ]
}
```

### `PATCH /api/admin/requests/[id]`

Approves or rejects a request.

Request body:

- `decision`: required `approve` or `reject`
- `rejectionReason`: required non-empty string when `decision` is `reject`; omit it when `decision` is `approve`

Response notes:

- `status`: finalized `approved` or `rejected`
- `rejectionReason`: `null` when `status` is `approved`; required non-empty string when `status` is `rejected`

```json
{
  "decision": "reject",
  "rejectionReason": "Please clarify the missing clock-out time."
}
```

Response:

```json
{
  "id": "req_manual_001",
  "requestType": "manual_attendance",
  "status": "rejected",
  "reviewedAt": "2026-03-30T13:15:00+09:00",
  "rejectionReason": "Please clarify the missing clock-out time."
}
```

Typical error cases:

- `400 validation_error` for invalid decision payloads
- `404 not_found` when the request id does not exist
- `409 conflict` when the request has already been finalized

## Change Triggers

- Update this document whenever an endpoint, parameter, payload field, enum, or error behavior changes.
- Update `docs/database-schema.md` in the same change whenever shared vocabulary or entity meaning changes.
