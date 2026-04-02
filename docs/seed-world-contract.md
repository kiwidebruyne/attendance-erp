# Deterministic Seed World Contract

## Purpose

This document is the primary source of truth for the deterministic mock seed world used by the shared attendance, leave, and request surfaces.
It defines one fixed Asia/Seoul baseline timestamp, one deterministic calendar window, and the minimum seeded scenario mix that the mock API and screens must share.

This document does not redefine attendance, request, or leave semantics.
Those contracts remain owned by `docs/attendance-operating-model.md`, `docs/request-lifecycle-model.md`, `docs/leave-conflict-policy.md`, `docs/feature-requirements.md`, `docs/api-spec.md`, and `docs/database-schema.md`.

## Baseline

| Setting            | Value                                       | Notes                                                                                                 |
| ------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Timezone           | `Asia/Seoul`                                | All seeded datetimes use `+09:00`.                                                                    |
| Baseline timestamp | `2026-04-13T12:00:00+09:00`                 | Monday-noon snapshot anchor for the seed world.                                                       |
| Baseline date      | `2026-04-13`                                | The baseline day reads as a realistic workday already in progress.                                    |
| Baseline weekday   | Monday                                      | The seed world stays aligned to a workweek start.                                                     |
| Calendar window    | `2026-03-23` through `2026-04-20` inclusive | Deterministic date range that gives about one month of attendance facts around the baseline snapshot. |

## Seed Composition

- Seed exactly 12 employees.
- Keep the employee set fixed across runs.
- Seed roughly one month of attendance facts inside the calendar window.
- Include a realistic mix of normal days, late arrivals, early departures, missing records, failed attendance attempts, leave coverage, and carry-over handling.
- Keep pre-baseline unresolved issues intentionally sparse so the world does not read like a backlog dump.
- Keep most pre-baseline workdays populated with normal attendance facts so the admin today exception table does not inflate from synthetic historical absences.
- Keep the baseline-day same-day attendance mostly populated so the noon snapshot looks like an active Monday rather than an empty fallback table.
- The intended baseline-day admin summary example is `checkedInCount 9`, `notCheckedInCount 2`, `lateCount 1`, `onLeaveCount 1`, `failedAttemptCount 1`, and `previousDayOpenCount 1`.
- The intended baseline-day admin today exception table should stay sparse and resolve to at most 10 rows without UI-only truncation.
- Keep the default `/attendance` employee's rolling week and month history visibly populated across most seeded workdays so the ledger does not read like a mostly empty fallback table.
- Keep all company-event records read-only seeded inputs.

## Required Scenario Coverage

The seed world must include each of the following concrete cases at least once:

| Scenario                               | Required fixed date or shape                                                                                                                             | Contract meaning                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Previous-day missing checkout          | `2026-04-13` must surface `previous_day_checkout_missing` from the prior workday so the baseline date itself proves the carry-over case.                 | The carry-over state must be visible on both employee and admin surfaces.                             |
| Next-day checkout                      | `2026-04-15` must include a next-day checkout that closes the prior workday before `09:00` in Asia/Seoul time.                                           | The prior workday is closed by writeback instead of turning into a new workday checkout.              |
| Failed attendance attempt              | At least one failed attendance attempt must remain visible on its target date, including a case that still matters after the baseline date.              | The seed world proves unresolved attempt-failed coverage instead of relying only on successful facts. |
| Leave-work conflict                    | One seeded attendance fact on a leave-covered date, such as `2026-04-18`, must produce `leave_work_conflict`.                                            | Attendance and leave facts stay visible together instead of erasing one another.                      |
| Company-event-sensitive leave date     | At least one leave request on `2026-04-16` must overlap a read-only seeded company event.                                                                | Leave conflict policy can read the seeded event without mutating it.                                  |
| Staffing-sensitive full-day leave date | At least one full-day leave request on `2026-04-17` must hit staffing-sensitive warning context.                                                         | Admin approval coverage can exercise the staffing-risk path.                                          |
| Manual-attendance request chain        | At least one manual-attendance chain must cover a root request, a review outcome, and a linked `resubmission` follow-up.                                 | The seed world proves request-chain synchronization for manual attendance.                            |
| Manual-attendance edit and withdraw    | At least one pending manual-attendance request must be editable before review and at least one pending request must be withdrawable before review.       | The seed world proves the employee-side pre-review request flows that remain in scope.                |
| Approved manual writeback              | At least one approved manual-attendance request must write back into the canonical `attendanceRecord` and clear the embedded `manualRequest` projection. | Approval must mutate the canonical attendance fact, not just the request row.                         |
| Leave request chain                    | At least one leave chain must cover a root request plus a live follow-up such as `change` or `cancel`.                                                   | The seed world proves leave follow-up behavior on the same chain.                                     |
| Reviewed non-approved leave history    | At least one reviewed non-approved leave request must keep `governingReviewComment` visible until a linked follow-up resolves it.                        | Completed-history treatment stays aligned with the request lifecycle model.                           |

## Vocabulary Guardrails

- Use only terms that already exist in the promoted docs.
- Do not introduce new request statuses, new attendance exception names, or new leave categories in the seed contract.
- Do not add a second timezone, a floating baseline date, or a seed-only calendar interpretation.
- Do not treat company-event records as mutable workflow data.

## Downstream Consumers

This contract feeds the same mock world used by employee attendance, leave, and admin request surfaces.

- `docs/attendance-operating-model.md` consumes the attendance fact coverage.
- `docs/request-lifecycle-model.md` consumes the request-chain coverage.
- `docs/leave-conflict-policy.md` consumes the company-event and staffing-sensitive leave inputs.
- `docs/feature-requirements.md`, `docs/api-spec.md`, and `docs/database-schema.md` consume the shared seed vocabulary and deterministic date context.
