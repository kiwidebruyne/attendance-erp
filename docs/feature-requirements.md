# Feature Requirements

## Purpose

This document captures the user-visible scope for the assignment.
It is a structured interpretation of `docs/raw-assignment.md`, not a verbatim copy of the raw assignment.

## Roles

- **Employee**: views personal attendance facts and active exceptions, submits manual attendance requests, and manages leave requests.
- **Admin**: monitors team attendance, reviews current exceptions, and reviews request work across needs-review, waiting-for-employee, and completed states.

## Shared Product Rules

- The app assumes a single signed-in user context for each route. Authentication UI is out of scope for the assignment.
- The application must use mock data that feels operationally realistic for a small team, including late arrivals, early departures, missing records, failed attendance attempts, leave coverage, and follow-up correction requests.
- The current assignment scope covers frontend pages and mock API behavior only. Real BLE integration and a production backend are out of scope.
- `docs/attendance-operating-model.md` owns the detailed attendance fact lifecycle and derived exception timing. This document keeps only the user-visible requirements that depend on that lifecycle.
- `docs/request-lifecycle-model.md` owns reviewed-request changes, follow-up request chains, and cross-screen request-state synchronization. This document keeps only the user-visible requirements that depend on that lifecycle.
- The product should behave like a trust product rather than a passive ledger: the user should be able to understand the current state, the reason for that state, and the next action without decoding tables first.
- Employee and admin views must stay synchronized on the same facts for the same date. A date or request must not look resolved on one screen and exceptional on another.

## Employee Flow Requirements

### Attendance Overview: `/attendance`

Required UI:

- a top-level attendance control panel that shows the adjusted expected work window, the current attendance phase, the current next action, and any active exceptions for today
- a visible carry-over warning when the previous workday is still open because checkout is missing
- visibility into same-day failed attendance attempts and the current manual attendance request state for the affected day
- a weekly attendance history table with each date's expected work window summary, recorded check-in and check-out facts, work duration, and derived exceptions
- a monthly view of the same attendance history data
- a clear call to action for manual attendance requests when successful attendance facts are missing or an attempt failed

Edge cases to keep visible during implementation:

- the user opens the app before the first successful check-in and should see a derived pre-check-in state instead of an absence state
- the user checked in but has not checked out yet
- the user has no successful attendance fact for the current day after the expected check-in time
- the beacon was not detected or the user opened the app outside the beacon range
- the user has already submitted a manual request for the same day
- the previous day's record is still open because checkout is missing
- an approved leave day later conflicts with an actual attendance fact and must surface as a visible conflict instead of silently rewriting either fact

### Leave Management: `/attendance/leave`

Required UI:

- a leave balance summary card showing total, used, and remaining leave
- a request form for annual leave, half-day AM, half-day PM, and hourly leave
- a list of the current user's leave request chains with date, type, reason, current request status, and latest review timing
- visible prior review comments and follow-up context when a leave request is `revision_requested` or `rejected`
- a prefilled follow-up path for leave `resubmission`, approved-state `change`, and approved-state `cancel` flows
- visible pre-submit conflict guidance for company-event-sensitive or staffing-sensitive dates without exposing team-private details; see `docs/leave-conflict-policy.md`

Validation and policy topics that must stay aligned with narrower contract documents:

- whether past-date leave requests are allowed
- how same-day duplicate requests are prevented
- how hourly leave should be represented in the UI and payload
- how approved leave should surface later attendance conflicts without silently overwriting the original leave decision
- company-event conflict policy and staffing-cap warning behavior should follow `docs/leave-conflict-policy.md`

## Admin Flow Requirements

### Team Attendance Dashboard: `/admin/attendance`

Required UI:

- today summary cards for checked-in, not checked-in, late, on-leave, failed-attempt, and previous-day-open counts
- an exception-first team list that still includes employees with no successful attendance record for the day
- visible carry-over warnings for employees whose previous workday is still open because checkout is missing
- visibility into failed attendance attempts, leave-work conflicts, and current manual attendance request state where applicable
- search and filter controls that support reviewing records over a selected date range

Implementation concerns that should be tracked during issue creation:

- whether pagination is necessary for the assignment-sized dataset
- whether department filtering is required in the first implementation pass
- how historical and same-day views should share or split data-fetching logic
- how the same date-level facts should drive both summary cards and exception-list rows so counts never drift from the table

### Request Review: `/admin/attendance/requests`

Required UI:

- a request table covering manual attendance requests and leave requests
- filter tabs for needs review, waiting for employee, completed, and all
- approve, reject, and request-revision actions with confirmation UI
- explicit review-comment input when rejecting a request or requesting revision
- visible request-chain context that shows the active request, the effective status, and any earlier review comment that still explains the current state
- post-approval adjustments should route through employee follow-up change or cancel requests rather than an admin-side reversal of the original approval
- approved-state follow-up `change` and `cancel` flows are in current scope for leave requests only; approved manual-attendance follow-up changes remain out of current scope
- visible company-event, effective approved leave, pending leave context, and staffing-cap risk before approving a leave request; see `docs/leave-conflict-policy.md`
- explicit confirmation UI when approving a leave request that still carries a company-event or staffing-cap warning

Decision points for later issue planning:

- whether bulk approval is needed in the first pass
- whether any future product phase should allow exceptional administrative revocation of approved requests beyond current scope; see issue `#53`
- how much detail should be visible inline versus in a modal or side panel
- how request review surfaces should clean up stale warnings and badges after an approval, rejection, or follow-up submission

## Cross-Screen UX Expectations

- Each screen should have loading, empty, and error states that match the ERP tone.
- Tables and filters should preserve clarity over decoration.
- Mutations should provide immediate feedback for success and failure.
- Desktop is the primary experience, but mobile and narrow widths must remain functional.
- Top-of-screen warnings should take priority over buried table-only states when the user needs immediate action.
- Different causes must remain distinguishable: failed attempt, expected-but-missing check-in, finalized absence, previous-day missing checkout, leave-work conflict, and request-review state must not collapse into one vague warning.
- Every important state should include the current state, the reason, and the next action.
- Warning, badge, and CTA cleanup after approvals, rejections, or successful corrections must happen consistently across employee and admin surfaces.
- Request surfaces should expose the same active request, effective status, review comment, and next action to both employees and admins.

## Out Of Scope

- real BLE scanning or device integration
- authentication, authorization, or role-management flows
- production persistence or an external backend service
- roadmap, backlog, or implementation sequencing documents
