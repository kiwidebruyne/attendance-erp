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
- All shipped in-product copy in the current assignment scope should be written in Korean. Repository documentation may remain English unless a source-of-truth document explicitly defines a Korean-language exception.
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
- Each route inside the shared shell should expose a consistent page header with a page title. A brief context line is optional when the first page surface already explains the route clearly enough.

## Employee Flow Requirements

### Attendance Overview: `/attendance`

Required UI:

- a stable today card that remains visible even when active exceptions exist and shows the current attendance phase, today's check-in and check-out facts, beacon-auth state, and a display-only current worked-time value when it can be calculated
- a separate top-of-screen exception stack that appears before history, keeps every current active exception visible, and may append selected-window historical issue cards so older problem rows are also visible before the table
- a top-priority carry-over correction surface when the previous workday is still open because checkout is missing
- a prefilled manual-attendance correction entry for carry-over checkout recovery that targets the prior date with `clock_out` semantics
- carry-over recovery behavior that swaps same-date duplicate-request submission CTA wording for request-status, review-reason, or resubmission CTA wording when the relevant manual request already exists
- one shared in-page correction or review sheet that owns carry-over correction, pending edit or withdraw, review-reason visibility, and reviewed-request resubmission for `/attendance`
- same-date manual-attendance duplicate prevention must treat `clock_in`, `clock_out`, and `both` as one governing chain per target date rather than separate action buckets
- manual-attendance correction entry must collect explicit requested attendance times per action: `clock_in` requires only the requested clock-in time, `clock_out` requires only the requested clock-out time, and `both` requires both
- clock-out-only correction must be available only when the target date already has an open attendance record; otherwise the flow must steer the employee to `both`
- visibility into same-day failed attendance attempts, the current derived manual attendance request summary, leave-work conflicts, and dedicated expected-but-missing check-in exception surfaces above history when they still matter operationally
- separate exception surfaces when an unresolved failed attendance attempt and a same-day expected-but-missing check-in state coexist; the page must not merge them into one generic warning
- same-day attendance action entry points that deep-link into the existing attendance action UI rather than introducing a second `/attendance`-local clock-in or clock-out owner
- a rolling 7-day attendance history table ending at the page date, sorted newest first, with each date's special notes, leave usage, recorded check-in and check-out facts, work duration, limited status chips, and row action
- a rolling 30-day view of the same attendance history data, also ending at the page date and keeping the same newest-first ordering
- compact row-level `정정하기` re-entry actions on every history row so the same correction flow can reopen from any date without replacing or visually competing with the top-of-screen action surfaces

Edge cases to keep visible during implementation:

- the user opens the app before the first successful check-in and should see a derived pre-check-in state instead of an absence state
- the user checked in but has not checked out yet
- the user has no successful attendance fact for the current day after the expected check-in time
- the beacon was not detected or the user opened the app outside the beacon range
- the user has already submitted a same-day or carry-over manual request that still governs the current attendance state, even if they are switching between `clock_in`, `clock_out`, and `both`
- the user already has a pending carry-over correction request for a previous-day missing checkout and should be led to request status instead of a duplicate submission path
- the user sees a previous-day missing checkout and should be led into correction without needing to decode the history table first
- the previous day's record is still open because checkout is missing
- the user has a rejected or `revision_requested` manual request and should see the review reason plus a resubmission path above history
- the user should be told that a reviewed non-approved manual request is no longer admin-writable on the same request record and should instead offer a clear employee-side resubmission path when correction is still needed
- the user has both an unresolved failed attendance attempt and a same-day expected-but-missing check-in state and should see those causes as separate exception surfaces
- an approved leave day later conflicts with an actual attendance fact and must surface as a visible conflict instead of silently rewriting either fact

### Leave Management: `/attendance/leave`

Required UI:

- a stable top summary tier that always shows one combined leave-balance card plus calm current-state counts for `revision_requested`, `approved`, `pending`, and `rejected` chains rather than escalating plain pending requests into the top correction surface
- a conditional top correction tier for reviewed non-approved leave requests that still need employee attention without treating them as a shared queue state, rendered as a table-style recovery surface rather than an expanded detail card
- a full-width leave history row below the planning workspace so planning stays calendar-first while history remains the required recovery surface
- a lower planning workspace that keeps the leave-only calendar, selected-date context, and inline composer adjacent on desktop and stacked in the same order on narrow widths
- one inline leave composer in that planning workspace that supports annual leave, half-day AM, half-day PM, and hourly leave; hourly leave uses explicit `startAt`/`endAt` interval input and shows derived `hours` output rather than accepting `hours` as input, and the composer owns new leave request, `resubmission`, approved-state `change`, and approved-state `cancel` flows
- a bottom leave history table with columns centered on `유형`, `날짜`, `세부사항`, `상태`, `사유`, and `작업`, with no separate `최근 활동` column
- the leave history table should keep state cells as badge-only values without extra descriptive text, and long reason text should wrap naturally instead of clamping
- the leave history table should remain chain-aware, but the visible row structure should stay anchored to the governing request rather than splitting earlier chain steps into separate top-level rows
- visible prior review comments and follow-up context when a leave request is `revision_requested` or `rejected`
- reviewed non-approved leave requests should read as completed admin review with a clear employee-side resubmission path; `revision_requested` should emphasize correction guidance, while `rejected` should emphasize refusal of the current version without removing the linked resubmission path
- a prefilled follow-up path for leave `resubmission`, approved-state `change`, and approved-state `cancel` flows
- when multiple reviewed non-approved leave requests qualify for top correction surfacing, show them together in one table so the user can compare request, status, review note, and action without switching cards
- top correction rows should keep the prior request summary, reviewed outcome, review reason, and primary `resubmit` action visible together
- reviewed non-approved leave requests may be hidden from top correction auto-surfacing one reviewed request at a time without removing history, rationale, or linked resubmission context
- history must remain the required recovery surface for a previously suppressed reviewed leave request, while the top correction table or selected-date context may add optional restore or resubmission entry points without replacing history
- employees may restore a previously suppressed reviewed leave request from history or selected-date context surfaces when they want it back in the top correction tier
- suppressing one reviewed leave request must not hide a different request that only shares the same date, leave type, or root chain history
- selecting a date with existing leave context must show the governing chain context before offering a blank new-request flow, and the selected-date panel remains the entry point for starting a new request
- if a clicked date belongs to a multi-day leave range, the selected-date context must show the governing full range rather than only the clicked date
- selected-date context should lead with one governing chain card and keep other date-related items as compact secondary links rather than a stack of equal full cards
- the calendar panel header should show only the month label and prev/next month controls, removing the calendar title, explanatory description, and `새 요청 시작` button
- top-correction and history CTAs should converge on the same inline composer so the write-flow owner stays unambiguous across new request, `resubmit`, `change`, and `cancel`
- when top-correction, history, or selected-date CTAs open the inline composer, the page may scroll to that composer area so the write flow stays in view
- pending leave actions should stay history-led with `edit` primary and `withdraw` secondary; approved leave actions should stay history-led with `change` primary and `cancel` secondary
- suppressed reviewed non-approved rows should keep `resubmit` as the primary action and may add `show again at top` as a secondary recovery action where relevant
- approved leave with a pending `change` or `cancel` follow-up must show both the current effective approval and the pending follow-up context together so the employee does not misread the follow-up as already effective
- visible pre-submit conflict guidance for company-event-sensitive or staffing-sensitive dates without exposing team-private details; see `docs/leave-conflict-policy.md`

Validation and policy topics that must stay aligned with narrower contract documents:

- in the first pass, leave requests may target only today or a future workday
- duplicate prevention is overlap-based, not type-label-based: the same employee cannot create a second unsuperseded root leave chain whose effective leave interval overlaps another unsuperseded root chain
- hourly leave uses explicit `startAt` and `endAt` payload fields, and `hours` is derived display/output data rather than authoritative input
- approved leave surfacing later attendance conflicts without silently overwriting the original leave decision stays owned by `docs/attendance-operating-model.md`
- company-event conflict policy and staffing-cap warning behavior should follow `docs/leave-conflict-policy.md`

## Admin Flow Requirements

### Team Attendance Dashboard: `/admin/attendance`

Required UI:

- a default today-first operations mode that renders the page in this order: exception table, one-row summary cards, then full team ledger
- a top exception table that aggregates unresolved employee-surface exceptions for the day instead of using a left rail
- one horizontal row of summary cards labeled `근무중`, `출근 전`, `지각`, `조퇴`, `연차`, `반차`, and `시간차`
- a full team ledger with selectable `기본`, `근무상태별`, and `근태상태별` views using the same underlying data
- an exception-table-first team list that still includes employees with no successful attendance record for the day once their current operational state becomes relevant
- visible carry-over warnings for employees whose previous workday is still open because checkout is missing
- visibility into failed attendance attempts, leave-work conflicts, and compact current manual attendance request state where applicable
- a secondary history review mode inside the same route with page-local controls for search and selected date range
- a default history range of the last 7 days including today when the admin enters history mode without explicit URL state

Implementation concerns that must stay aligned with narrower contract documents:

- whether pagination is necessary for the assignment-sized dataset
- whether department filtering is required in the first implementation pass
- history review should remain a secondary mode inside `/admin/attendance` rather than replacing the today-first default entry behavior
- mode, date range, and search state should remain URL-shareable when they affect admin attendance queries
- the today exception table, one-row summary cards, and ledger view groupings should all derive from the same date-level facts so counts and group membership never drift
- these are presentation-only projections; the public API contract remains unchanged

Edge cases to keep visible during implementation:

- a no-record employee becomes visible in the top exception table after the adjusted expected start passes even if no attendance row has been created yet
- a no-record employee with an unresolved failed attempt, carry-over problem, or current manual request may become table-visible before a simple missing check-in warning would apply
- a prior-workday carry-over correction request may remain embedded on a today row when it still explains the employee's current operational state, and the target date must stay visible
- an approved manual attendance correction must clear from the today embedded request state once canonical attendance writeback finishes

### Request Review: `/admin/attendance/requests`

Required UI:

- a request table covering manual attendance requests and leave requests
- filter tabs for needs review, completed, and all
- default landing tab is `needs_review`; initial load uses the tab only and does not imply additional default text or date filters
- a queue-first review workspace where the request table is the primary entry surface and the selected request drives supporting selected-date context plus detail
- `needs_review` rows are ordered newest pending request first
- approve, reject, and request-revision actions anchored in actionable request detail rather than queue rows
- explicit review-comment input when rejecting a request or requesting revision
- visible request-chain context that shows the active request, the effective status, and any earlier review comment that still explains the current state
- `governingReviewComment` remains visible as a row/detail signal when unresolved rationale still governs
- minimum row context before opening detail includes employee block, request type/subtype, primary target date, current/effective state cue, one-line reason, and at most two compact chips
- queue rows that explain why the request matters before detail is opened, while final review actions remain detail-only
- reviewed non-approved requests should be described as completed review history on the admin side rather than as admin-writable pending work on the same request record
- reviewed non-approved requests should appear in `completed` and `all` only, never in `needs_review`
- within `completed` and `all`, reviewed non-approved requests should remain visible as history/context rather than as a separate admin queue state
- `completed` should keep the same workspace grammar as `needs_review`, but with lower emphasis and history-first reading
- `all` should section actionable review work ahead of completed review history rather than mixing both into one undifferentiated list
- within `completed`, approved or withdrawn results should remain visually distinct from reviewed non-approved history, should appear ahead of that history section, approved rows should appear before withdrawn rows inside the first completed-history section, approved rows should sort by latest review activity descending, withdrawn rows should sort by their original submission timestamp because they have no review timestamp, and reviewed non-approved history should sort by latest review activity descending
- the completed section inside `all` should preserve the same approved/withdrawn-before-reviewed-non-approved section order and the same per-section sort keys
- admin-side next action for reviewed non-approved history should be treated as no further admin action on the same record, even when employee pages still expose a page-local resubmission path
- admin completed-history detail should remain read-only, use quiet outcome footing, and should not show employee-resubmit CTA copy or employee-only suppression metadata
- post-approval adjustments should route through employee follow-up change or cancel requests rather than an admin-side reversal of the original approval
- approved-state follow-up `change` and `cancel` flows are in current scope for leave requests only; approved manual-attendance follow-up changes remain out of current scope
- manual attendance and leave requests should share the route but use different review summaries: manual review should lead with correction summary, target workday, and current/effective state, while leave review should lead with the current request, effective leave, and risk summary
- visible company-event, effective approved leave, pending leave context, and staffing-cap risk before approving a leave request; see `docs/leave-conflict-policy.md`
- a second confirmation surface only when approving a leave request that still carries a company-event or staffing-cap warning
- selected-date context should stay available across `needs_review`, `completed`, and `all`, while completed-history context uses lower-emphasis historical treatment rather than the same pressure styling as actionable review work

Decision points for later issue planning:

- bulk approve/reject stays out of scope for v1
- whether any future product phase should allow exceptional administrative revocation of approved requests beyond current scope; see issue `#53`

## Cross-Screen UX Expectations

- Each screen should have loading, empty, and error states that match the ERP tone.
- Tables and filters should preserve clarity over decoration.
- Mutations should provide immediate feedback for success and failure.
- Desktop is the primary experience, but mobile and narrow widths must remain functional.
- Narrow widths should preserve the same route information architecture by collapsing the shared sidebar into a drawer or sheet instead of introducing a separate mobile navigation tree.
- Top-of-screen warnings should take priority over buried table-only states when the user needs immediate action.
- Different causes must remain distinguishable: failed attempt, expected-but-missing check-in, finalized absence, previous-day missing checkout, leave-work conflict, and request-review state must not collapse into one vague warning.
- Every important state should include the current state, the reason, and the next action.
- Notification surfaces should be layered and deduplicated: summary cards, exception stacks, queue rows, detail panels, selected-date context, and history rows may repeat the same state only as supporting context; the highest-priority visible surface owns the primary next action.
- Warning, badge, and CTA cleanup after approvals, rejections, resubmissions, withdrawals, or successful corrections must happen consistently across employee and admin surfaces, and stale lower-priority copies should disappear when the governing state changes.
- Request surfaces should expose the same active request, effective status, and review comment to both employees and admins, while employee resubmission prompting may remain page-local.
- On admin completed-history surfaces, the "next action" rule should not be interpreted as employee-resubmit guidance inside the admin workspace; those surfaces should read as no further admin action on the same record.
- Employee and admin surfaces must interpret `rejected` and `revision_requested` as locked non-approved reviewed states on the same request record until a linked follow-up exists. Employee pages may promote resubmission entry points, while admin pages should treat those reviewed outcomes as completed review history rather than active queue work.

## Out Of Scope

- real BLE scanning or device integration
- authentication, authorization, or role-management flows
- production persistence or an external backend service
- roadmap, backlog, or implementation sequencing documents
