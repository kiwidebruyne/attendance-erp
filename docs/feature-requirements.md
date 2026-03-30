# Feature Requirements

## Purpose

This document captures the user-visible scope for the assignment.
It is a structured interpretation of `docs/raw-assignment.md`, not a verbatim copy of the raw assignment.

## Roles

- **Employee**: views personal attendance state, submits manual attendance requests, and manages leave requests.
- **Admin**: monitors team attendance and reviews pending requests.

## Shared Product Rules

- The app assumes a single signed-in user context for each route. Authentication UI is out of scope for the assignment.
- The application must use mock data that feels operationally realistic for a small team, including late, absent, and leave cases.
- The current assignment scope covers frontend pages and mock API behavior only. Real BLE integration and a production backend are out of scope.

## Employee Flow Requirements

### Attendance Overview: `/attendance`

Required UI:

- a today-status summary card that shows check-in time, check-out time, and beacon verification state
- a weekly attendance history table with date, check-in, check-out, work duration, and status
- a monthly view of the same attendance history data
- a clear call to action for manual attendance requests when automatic beacon verification is missing

Edge cases to keep visible during implementation:

- the user checked in but has not checked out yet
- the user has no attendance record for the current day
- the beacon was not detected or the user opened the app outside the beacon range
- the user has already submitted a manual request for the same day

### Leave Management: `/attendance/leave`

Required UI:

- a leave balance summary card showing total, used, and remaining leave
- a request form for annual leave, half-day AM, half-day PM, and hourly leave
- a list of the current user's previous leave requests with date, type, reason, and review state

Validation and policy topics that must be handled explicitly in later issues:

- whether past-date leave requests are allowed
- how same-day duplicate requests are prevented
- how hourly leave should be represented in the UI and payload

## Admin Flow Requirements

### Team Attendance Dashboard: `/admin/attendance`

Required UI:

- today summary cards for checked-in, not checked-in, late, and on-leave counts
- a team attendance table with name, department, check-in, check-out, and status
- search and filter controls that support reviewing records over a selected date range

Implementation concerns that should be tracked during issue creation:

- whether pagination is necessary for the assignment-sized dataset
- whether department filtering is required in the first implementation pass
- how historical and same-day views should share or split data-fetching logic

### Request Review: `/admin/attendance/requests`

Required UI:

- a request table covering manual attendance requests and leave requests
- filter tabs for pending, approved, rejected, and all
- approve and reject actions with confirmation UI
- explicit rejection-reason input when rejecting a request

Decision points for later issue planning:

- whether bulk approval is needed in the first pass
- whether approved requests can be reversed
- how much detail should be visible inline versus in a modal or side panel

## Cross-Screen UX Expectations

- Each screen should have loading, empty, and error states that match the ERP tone.
- Tables and filters should preserve clarity over decoration.
- Mutations should provide immediate feedback for success and failure.
- Desktop is the primary experience, but mobile and narrow widths must remain functional.

## Out Of Scope

- real BLE scanning or device integration
- authentication, authorization, or role-management flows
- production persistence or an external backend service
- roadmap, backlog, or implementation sequencing documents
