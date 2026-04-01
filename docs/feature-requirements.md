# Feature Requirements

## Purpose

This document captures the user-visible scope for the assignment.
It is a structured interpretation of `docs/raw-assignment.md`, not a verbatim copy of the raw assignment.

## Roles

- **Employee**: views personal attendance facts and active exceptions, submits manual attendance requests, and manages leave requests.
- **Admin**: monitors team attendance, reviews current exceptions, and reviews actionable request work plus completed review history across `needs_review`, `completed`, and `all` contexts.

## Shared Product Rules

- The app assumes a single signed-in user context for each route. Authentication UI is out of scope for the assignment.
- The application must use mock data that feels operationally realistic for a small team, including late arrivals, early departures, missing records, failed attendance attempts, leave coverage, and follow-up correction requests.
- The current assignment scope covers frontend pages and mock API behavior only. Real BLE integration and a production backend are out of scope.
- `docs/attendance-operating-model.md` owns the detailed attendance fact lifecycle and derived exception timing. This document keeps only the user-visible requirements that depend on that lifecycle.
- `docs/request-lifecycle-model.md` owns reviewed-request changes, follow-up request chains, and cross-screen request-state synchronization. This document keeps only the user-visible requirements that depend on that lifecycle.
- The product should behave like a trust product rather than a passive ledger: the user should be able to understand the current state, the reason for that state, and the next action without decoding tables first.
- Employee and admin views must stay synchronized on the same facts for the same date. A date or request must not look resolved on one screen and exceptional on another.

## Shared Shell Contract

- In the first pass, `/` redirects to `/attendance`.
- The four assignment routes live inside one shared ERP shell rather than separate page-level layouts.
- The global sidebar contains exactly two route groups:
  - `Employee`: `/attendance`, `/attendance/leave`
  - `Admin`: `/admin/attendance`, `/admin/attendance/requests`
- Global navigation is limited to the four assignment routes in the current scope. Do not expand it into a broader ERP module launcher.
- `/admin/attendance/requests` owns the queue views `needs_review`, `completed`, and `all` as in-page tabs, not as global navigation items.
- `/attendance` owns week and month history switching as in-page controls, not as global navigation items.
- Each route inside the shared shell should expose a consistent page header with a page title and brief context line.

## Employee Flow Requirements

### Attendance Overview: `/attendance`

Required UI:

- a stable today card that remains visible even when active exceptions exist and shows the adjusted expected work window, the current attendance phase, the current next action, and today's active exceptions summary
- a separate top-of-screen exception stack that appears before history, keeps every current active exception visible, and uses independent exception surfaces instead of collapsing all problems into one warning
- a top-priority carry-over correction surface when the previous workday is still open because checkout is missing
- a prefilled manual-attendance correction entry for carry-over checkout recovery that targets the prior date with `clock_out` semantics
- carry-over recovery behavior that swaps duplicate-request submission CTA wording for request-status, review-reason, or resubmission CTA wording when the relevant manual request already exists
- visibility into same-day failed attendance attempts, the current derived manual attendance request summary, leave-work conflicts, and dedicated expected-but-missing check-in exception surfaces above history when they still matter operationally
- separate exception surfaces when an unresolved failed attendance attempt and a same-day expected-but-missing check-in state coexist; the page must not merge them into one generic warning
- same-day attendance action entry points that deep-link into the existing attendance action UI rather than introducing a second `/attendance`-local clock-in or clock-out owner
- a weekly attendance history table with each date's expected work window summary, recorded check-in and check-out facts, work duration, and derived exceptions
- a monthly view of the same attendance history data
- compact row-level re-entry actions in the history table that can reopen the same correction or review flows without replacing or visually competing with the top-of-screen action surfaces

Edge cases to keep visible during implementation:

- the user opens the app before the first successful check-in and should see a derived pre-check-in state instead of an absence state
- the user checked in but has not checked out yet
- the user has no successful attendance fact for the current day after the expected check-in time
- the beacon was not detected or the user opened the app outside the beacon range
- the user has already submitted a same-day or carry-over manual request that still governs the current attendance state
- the user already has a pending carry-over correction request for a previous-day missing checkout and should be led to request status instead of a duplicate submission path
- the user sees a previous-day missing checkout and should be led into correction without needing to decode the history table first
- the previous day's record is still open because checkout is missing
- the user has a rejected or `revision_requested` manual request and should see the review reason plus a resubmission path above history
- the user should be told that a reviewed non-approved manual request is no longer admin-writable on the same request record and should instead offer a clear employee-side resubmission path when correction is still needed
- the user has both an unresolved failed attendance attempt and a same-day expected-but-missing check-in state and should see those causes as separate exception surfaces
- an approved leave day later conflicts with an actual attendance fact and must surface as a visible conflict instead of silently rewriting either fact

### Leave Management: `/attendance/leave`

Required UI:

- a leave balance summary card showing total, used, and remaining leave
- a request form for annual leave, half-day AM, half-day PM, and hourly leave
- a list of the current user's leave request chains with date, type, reason, current request status, and latest review timing
- visible prior review comments and follow-up context when a leave request is `revision_requested` or `rejected`
- reviewed non-approved leave requests should read as completed admin review with a clear employee-side resubmission path; `revision_requested` should emphasize correction guidance, while `rejected` should emphasize refusal of the current version without removing the linked resubmission path
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

- a default today-first operations mode that opens in `today`, `exception-first`, and `entire team`
- today summary cards for checked-in, not checked-in, late, on-leave, failed-attempt, and previous-day-open counts
- a grouped exception-first operations queue for today rather than a full-team default table
- an exception-first team list that still includes employees with no successful attendance record for the day once their current operational state becomes relevant
- visible carry-over warnings for employees whose previous workday is still open because checkout is missing
- visibility into failed attendance attempts, leave-work conflicts, and compact current manual attendance request state where applicable
- a secondary history review mode inside the same route with page-local controls for search and selected date range
- a default history range of the last 7 days including today when the admin enters history mode without explicit URL state

Implementation concerns that must stay aligned with narrower contract documents:

- whether pagination is necessary for the assignment-sized dataset
- whether department filtering is required in the first implementation pass
- history review should remain a secondary mode inside `/admin/attendance` rather than replacing the today-first default entry behavior
- mode, date range, and search state should remain URL-shareable when they affect admin attendance queries
- action-needed summary cards and today queue rows should derive from the same date-level facts so counts never drift from the queue
- contextual summary cards such as checked-in and on-leave should use the same date-level facts as the exception queue, but they do not need 1:1 queue-row parity because the default today surface remains exception-first

Edge cases to keep visible during implementation:

- a no-record employee becomes visible in the today operations queue after the adjusted expected start passes even if no attendance row has been created yet
- a no-record employee with an unresolved failed attempt, carry-over problem, or current manual request may become queue-visible before a simple missing check-in warning would apply
- a prior-workday carry-over correction request may remain embedded on a today row when it still explains the employee's current operational state, and the target date must stay visible
- an approved manual attendance correction must clear from the today embedded request state once canonical attendance writeback finishes

### Request Review: `/admin/attendance/requests`

Required UI:

- a request table covering manual attendance requests and leave requests
- filter tabs for needs review, completed, and all
- approve, reject, and request-revision actions with confirmation UI
- explicit review-comment input when rejecting a request or requesting revision
- visible request-chain context that shows the active request, the effective status, and any earlier review comment that still explains the current state
- reviewed non-approved requests should be described as completed review history on the admin side rather than as admin-writable pending work on the same request record
- reviewed non-approved requests should appear in `completed` and `all` only, never in `needs_review`
- within `completed` and `all`, reviewed non-approved requests should remain visible as history/context rather than as a separate admin queue state
- admin-side next action for reviewed non-approved history should be treated as no further admin action on the same record, even when employee pages still expose a page-local resubmission path
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
- Narrow widths should preserve the same route information architecture by collapsing the shared sidebar into a drawer or sheet instead of introducing a separate mobile navigation tree.
- Top-of-screen warnings should take priority over buried table-only states when the user needs immediate action.
- Different causes must remain distinguishable: failed attempt, expected-but-missing check-in, finalized absence, previous-day missing checkout, leave-work conflict, and request-review state must not collapse into one vague warning.
- Every important state should include the current state, the reason, and the next action.
- Warning, badge, and CTA cleanup after approvals, rejections, or successful corrections must happen consistently across employee and admin surfaces.
- Request surfaces should expose the same active request, effective status, and review comment to both employees and admins, while employee resubmission prompting may remain page-local.
- On admin completed-history surfaces, the "next action" rule should not be interpreted as employee-resubmit guidance inside the admin workspace; those surfaces should read as no further admin action on the same record.
- Employee and admin surfaces must interpret `rejected` and `revision_requested` as locked non-approved reviewed states on the same request record until a linked follow-up exists. Employee pages may promote resubmission entry points, while admin pages should treat those reviewed outcomes as completed review history rather than active queue work.

## Out Of Scope

- real BLE scanning or device integration
- authentication, authorization, or role-management flows
- production persistence or an external backend service
- roadmap, backlog, or implementation sequencing documents
