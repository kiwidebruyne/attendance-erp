# Attendance Operating Model

## Purpose

This document is the primary source of truth for the attendance runtime model.
It explains when attendance-related facts are created or updated, how derived attendance states are interpreted from those facts, and which cross-screen guarantees must hold for both employee and admin views.

This document does not own raw discussion history, full HTTP payload definitions, or the full conceptual entity catalog.
Those concerns remain in `docs/product-spec-context.md`, `docs/api-spec.md`, and `docs/database-schema.md`.

## Canonical Facts vs Derived Presentation

### Canonical Facts

| Concept                   | Meaning                                                                               | Created or Updated When                                                                                                               | Notes                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expectedWorkday`         | the expected work context for one employee on one calendar date                       | computed before the day starts and recalculated when approved leave changes the expected work window                                  | a workday may exist even when no attendance fact exists yet                                                                                                                       |
| `attendanceAttempt`       | one append-only check-in or check-out attempt                                         | created on every check-in or check-out button click                                                                                   | stores a target workday `date` separately from `attemptedAt`, so next-day checkout can still close the prior workday                                                              |
| `attendanceRecord`        | the canonical attendance fact for one workday                                         | created on the first successful check-in or an approved manual writeback; updated on successful checkout or later approved correction | facts only; not a stored display status                                                                                                                                           |
| `leaveCoverage`           | the approved leave interval as consumed by attendance logic                           | derived from approved leave requests                                                                                                  | shifts the adjusted expected work window for the covered date                                                                                                                     |
| `manualAttendanceRequest` | the canonical correction request submitted for missing or incomplete attendance facts | created when the employee submits a manual attendance request; updated by admin review                                                | the embedded `manualRequest` row projection is derived separately on `/api/attendance/me` and `/api/admin/attendance/today`; it does not mutate `attendanceRecord` until approval |

### Derived Presentation

| Concept              | Derived From                                     | Meaning                                                                                                                                                                |
| -------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `phase`              | expected workday plus same-day attendance record | current work progression such as `non_workday`, `before_check_in`, `working`, or `checked_out`                                                                         |
| `flags`              | expected workday plus attendance record          | coexisting attendance interpretations such as `late` and `early_leave`                                                                                                 |
| `activeExceptions`   | facts plus request state                         | visible operational exceptions such as `attempt_failed`, `not_checked_in`, `absent`, `previous_day_checkout_missing`, `leave_work_conflict`, or request-related states |
| `nextAction`         | facts plus active exceptions                     | the next recommended action for the current user context                                                                                                               |
| admin summary counts | expected workdays plus derived presentation      | aggregated same-day metrics for admin operational review                                                                                                               |

Important model rule:

- The runtime model is fact-first. Any UI label such as `working`, `normal`, `on_leave`, or a table badge is a derived presentation, not the stored canonical truth for the workday.

## Core Timeline Defaults

- Normal expected check-in time is `09:00`.
- Normal expected check-out time is `18:00`.
- A previous-day open work record may still be closed by a next-day checkout until `08:59:59` in the workday timezone carried by the attendance facts.
- Opening the app alone creates no `attendanceAttempt` and no `attendanceRecord`.
- Before the first successful same-day check-in, no `attendanceRecord` is required.
- `phase` is derived in precedence order: `checked_out` when the requested date already has a same-day checkout fact, `working` when the requested date has a same-day check-in fact without checkout, `non_workday` when no same-day attendance fact exists and `expectedWorkday.isWorkday=false`, and `before_check_in` otherwise.
- `not_checked_in` is a real-time expected-but-missing exception.
- `absent` is derived only after day close or equivalent finalization logic.
- Once `absent` is derived for a still-missing workday, the employee correction path shifts from `clock_in` to `submit_manual_request`.
- Approved leave adjusts the effective expected work window for the covered period.
- Actual attendance on a leave-covered day does not erase leave coverage. It surfaces as `leave_work_conflict`.
- Failed attendance attempts remain distinct from lateness or absence and must not be collapsed into either concept.
- Open-workday "today worked time" is a display-only calculation derived from `clockInAt` plus the current time or same-day `clockOutAt`. It does not change the stored meaning of `attendanceRecord.workMinutes`.

## Operational Flow Scenarios

### Normal Workday Without Leave

| Moment                                         | Canonical Fact Changes                                                    | Derived Result                                            | Required Surface Behavior                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Before `09:00`, no interaction                 | `expectedWorkday` exists; no `attendanceRecord`                           | `phase=before_check_in`; no absence is implied            | employee sees a pre-check-in state; admin does not treat the employee as late or absent                     |
| Successful check-in before `09:00`             | append `attendanceAttempt(success)`; create `attendanceRecord.clockInAt`  | `phase=working`; no `late` flag                           | employee and admin both show the workday as started                                                         |
| After `09:00`, still no successful check-in    | no fact change                                                            | `activeExceptions` includes `not_checked_in`              | this is a real-time exception, not a finalized absence                                                      |
| Successful check-in after `09:00`              | append `attendanceAttempt(success)`; create `attendanceRecord.clockInAt`  | `phase=working`; add `late` flag; remove `not_checked_in` | admin counts and employee card must update from missing to started-plus-late                                |
| Successful check-out before `18:00`            | append `attendanceAttempt(success)`; update `attendanceRecord.clockOutAt` | `phase=checked_out`; add `early_leave` if applicable      | `late` and `early_leave` may coexist for the same date                                                      |
| After `18:00`, still no checkout               | no fact change                                                            | workday remains open                                      | do not auto-convert this into an error or early leave; overtime and unresolved checkout are different cases |
| Day close with no successful same-day check-in | no `attendanceRecord` is created                                          | finalized `absent` may be derived                         | keep real-time `not_checked_in` separate from finalized absence                                             |

### Failed Attendance Attempt

| Case                                              | Canonical Fact Changes                                                              | Derived Result                                                                                        | Required Surface Behavior                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Failed check-in attempt before or after `09:00`   | append `attendanceAttempt(failed)` with `failureReason`                             | `activeExceptions` includes `attempt_failed`                                                          | employee and admin both see the failure and the next action immediately            |
| Failed check-out attempt on an open workday       | append `attendanceAttempt(failed)` with `failureReason`                             | open workday remains open; `attempt_failed` may coexist with the current phase                        | do not silently drop the failed attempt behind the table history                   |
| Later successful attempt after an earlier failure | append a later `attendanceAttempt(success)` and update `attendanceRecord` if needed | success changes the phase; stale failure warnings should clear if they no longer matter operationally | never leave the user with both a resolved state and a stale unresolved failure CTA |

Important rule:

- A prior-day failed checkout attempt remains operational only while that prior workday is still open. Once the prior-day `clockOutAt` exists, stale failed attempts for that date must stop driving current carry-over exception surfaces.

### No Successful Check-In After Expected Start

| Moment                                                           | Canonical Fact Changes                    | Derived Result                                        | Required Surface Behavior                                                                                    |
| ---------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `09:00` passes with no successful check-in and no covering leave | no fact change                            | `activeExceptions` includes `not_checked_in`          | employee sees a missing-record warning with the next action; admin top exception table includes the employee |
| The employee has failed attempts but still no success            | failed `attendanceAttempt` rows may exist | `attempt_failed` and `not_checked_in` may both matter | show failure context first, then the unresolved missing attendance fact                                      |
| Day closes with no successful check-in                           | still no `attendanceRecord`               | `absent` may be derived                               | use finalized absence only after the real-time operating window has ended                                    |

### Previous-Day Missing Checkout and Overnight Work

| Moment                                                                                     | Canonical Fact Changes                                                                                                                                             | Derived Result                                              | Required Surface Behavior                                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| Previous day stays open after `18:00`                                                      | previous-day `attendanceRecord` has `clockInAt` but no `clockOutAt`                                                                                                | no automatic error yet                                      | keep the prior workday open through the overnight close window           |
| Next-day checkout before `09:00`                                                           | append `attendanceAttempt(success)` with `attemptedAt` on the next calendar day and `date` on the prior workday; update previous-day `attendanceRecord.clockOutAt` | previous day is closed normally                             | treat this as closing the prior workday, not as the new day's checkout   |
| Next day reaches `09:00` in the prior workday timezone and the prior workday is still open | no automatic writeback                                                                                                                                             | `activeExceptions` includes `previous_day_checkout_missing` | employee and admin must both see the carry-over exception prominently    |
| Manual correction is approved later                                                        | update previous-day `attendanceRecord` from approved request                                                                                                       | carry-over exception clears                                 | today state and previous-day correction history must remain synchronized |

Additional history-ledger rule:

- On employee history surfaces, a missing previous-day checkout should be attached to the affected workday row itself rather than repeated on each later date that still inherits the carry-over exception context.

### Approved Leave With No Attendance

| Moment                                            | Canonical Fact Changes                                                        | Derived Result                                                          | Required Surface Behavior                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Approved full-day leave before the workday starts | `leaveCoverage` exists; `expectedWorkday` is adjusted for the covered date    | generic missing-check-in logic is suppressed for the covered period     | employee and admin both see leave coverage rather than a missing attendance warning |
| Approved half-day or hourly leave                 | `leaveCoverage` exists; `adjustedClockInAt` and/or `adjustedClockOutAt` shift | lateness and early-leave logic compare against the adjusted work window | leave-adjusted expectations must drive both employee and admin interpretation       |

### Non-Workday Or Closure

| Moment                                                             | Canonical Fact Changes                                                            | Derived Result                                                                            | Required Surface Behavior                                                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Weekend, holiday, or company-wide closure with no carry-over issue | `expectedWorkday.isWorkday=false`; no same-day attendance fact is required        | `phase=non_workday`; no generic missing-check-in exception                                | employee and admin should render this as a non-workday state rather than reusing a workday phase |
| Non-workday with a previous-day open record still unresolved       | prior-day facts remain open                                                       | `phase=non_workday`; `activeExceptions` may still include `previous_day_checkout_missing` | a non-workday must not hide a carry-over operational exception                                   |
| Non-workday with a same-day successful check-in                    | append `attendanceAttempt(success)`; create same-day `attendanceRecord.clockInAt` | `phase=working`; `non_workday` no longer applies                                          | actual attendance facts take precedence over the non-workday expectation                         |
| Non-workday with a same-day completed work record                  | same-day `attendanceRecord` already has both `clockInAt` and `clockOutAt`         | `phase=checked_out`; any leave/conflict exceptions still remain separate                  | do not force the card back into `non_workday` once the date has real work facts                  |

### Approved Leave With Actual Attendance Conflict

| Case                                                    | Canonical Fact Changes                                                     | Derived Result                                         | Required Surface Behavior                                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Successful check-in or check-out on a leave-covered day | append successful `attendanceAttempt`; create or update `attendanceRecord` | `activeExceptions` includes `leave_work_conflict`      | keep both the leave fact and the attendance fact visible; do not silently erase either one |
| Failed attendance attempt on a leave-covered day        | append failed `attendanceAttempt`                                          | leave coverage remains; `attempt_failed` still matters | show both the leave context and the failure context distinctly                             |

### Manual Correction Submission, Rejection, and Approval

| Stage                             | Canonical Fact Changes                                                               | Derived Result                                                                                                                | Required Surface Behavior                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Employee submits a manual request | create `manualAttendanceRequest(status=pending)`                                     | `activeExceptions` includes `manual_request_pending` when relevant                                                            | both employee and admin see the pending state immediately                                                       |
| Admin rejects the manual request  | update `manualAttendanceRequest.status=rejected` and store `reviewComment`           | `activeExceptions` may include `manual_request_rejected` and `nextAction` may shift to request review                         | show the review comment and the next action; the canonical attendance fact remains unchanged                    |
| Admin requests revision           | update `manualAttendanceRequest.status=revision_requested` and store `reviewComment` | `activeExceptions` may include `manual_request_rejected` and `nextAction` may shift to request review                         | show the review comment and a resubmission path; the canonical attendance fact remains unchanged                |
| Admin approves the manual request | update the target `attendanceRecord`; link the approved request when needed          | the attendance fact is corrected, the embedded `manualRequest` projection disappears, and stale request warnings should clear | approval is the point that mutates canonical attendance facts and stale warnings, badges, and CTAs should clear |

### Admin Summary, Exception Table, And Ledger Derivation

| Output                 | Derived From                                       | Rule                                                                                                                                                      |
| ---------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkedInCount`       | expected workdays plus same-day records            | count employees with a successful same-day check-in fact                                                                                                  |
| `notCheckedInCount`    | expected workdays plus records plus leave coverage | count employees whose adjusted expected start has passed, who have no successful same-day check-in fact, and who are not covered by leave for that period |
| `lateCount`            | expected workdays plus records                     | count employees whose successful check-in happened after the adjusted expected start                                                                      |
| `onLeaveCount`         | leave coverage                                     | count employees with approved leave coverage for the date                                                                                                 |
| `failedAttemptCount`   | attendance attempts in the active admin today view | count unresolved failed attempts that still matter operationally, even when their target workday is the previous date during carry-over handling          |
| `previousDayOpenCount` | prior-day attendance records                       | count prior workdays that remain open after the overnight close window                                                                                    |

Additional `/admin/attendance` today-mode projections:

- `todayExceptionTable` aggregates unresolved employee-surface exceptions for the current date from the same fact set used by the counts above.
- `todaySummaryCards` render as `근무중`, `출근 전`, `지각`, `조퇴`, `연차`, `반차`, and `시간차` from the same date-level facts.
- `ledgerViewMode` is a presentation-only grouping over the same ledger rows and must support `기본`, `근무상태별`, and `근태상태별`.
- These projections do not change the public API contract; they only reorganize the same underlying data for the admin today view.

Priority guidance for same-day admin exception review:

1. `previous_day_checkout_missing`
2. unresolved `attempt_failed`
3. `manual_request_pending`
4. simple `not_checked_in` or lateness candidates

## Shared Invariants and Forbidden Behaviors

### Shared Invariants

- Opening the app must never create attendance facts by itself.
- Employee and admin views must stay synchronized on the same date-level facts and request state.
- Important states must not stay buried in history tables when immediate action is needed.
- When the same attendance fact or request state appears on multiple employee or admin surfaces, the highest-priority operational surface owns the next action and lower-priority copies are supporting context only.
- Different causes must remain distinguishable. Failed attempts, missing check-ins, finalized absences, previous-day carry-over problems, leave conflicts, and request states are not interchangeable labels.
- Every important attendance state should preserve the current state, the reason, and the next action.
- A resolved approval, rejection, resubmission, withdrawal, or successful attendance correction must clear or replace stale warnings, badges, and CTAs.

### Forbidden Behaviors

- Do not create placeholder attendance rows at `00:00` just to represent a pre-check-in state.
- Do not collapse a failed attendance attempt into `late` or `absent`.
- Do not silently erase leave coverage when attendance facts appear on the same date.
- Do not silently erase attendance facts because approved leave already exists.
- Do not auto-close a previous-day open work record at midnight.
- Do not silently drop `previous_day_checkout_missing` when it still affects operations.

## Downstream Ownership and Open Questions

This document owns attendance flow semantics, not every downstream contract detail.

- `docs/feature-requirements.md` owns the user-visible requirements for employee and admin screens.
- `docs/ui-guidelines.md` owns UI presentation, exception priority on screen, and interaction guidance.
- `docs/api-spec.md` owns request and response shapes.
- `docs/database-schema.md` owns the conceptual entity and enum vocabulary.
- `docs/request-lifecycle-model.md` owns reviewed-request changes, follow-up-chain semantics, and shared request-state synchronization.
- `docs/leave-conflict-policy.md` owns company-event conflicts, staffing-cap policy, and leave approval warning defaults before attendance facts are interpreted.
- `docs/product-spec-context.md` keeps raw discussion history and unresolved product questions.

Open questions that remain outside this document:

- notification unread, priority, and cleanup rules beyond the attendance flow defaults defined here
