# Leave Conflict Policy

## Purpose

This document is the primary source of truth for leave operational conflict policy in the current product.
It defines how company events, staffing capacity, and approval-side warning behavior influence leave submission and leave review for both employee and admin surfaces.

This document does not own request lifecycle semantics, attendance fact lifecycle, full HTTP payload definitions, or company-event management workflows.
Those concerns remain in `docs/request-lifecycle-model.md`, `docs/attendance-operating-model.md`, `docs/api-spec.md`, `docs/database-schema.md`, and `docs/product-spec-context.md`.
It also does not define requestable-date eligibility, duplicate-prevention rules, or the hourly leave write payload contract; those rules are locked in the feature, API, and schema docs.

## First-Pass Policy Defaults

- Treat company-event conflicts as strong warnings, not employee-side hard blocks.
- Treat staffing-cap risk as warning plus manual admin approval, not automatic employee-side rejection.
- Evaluate full-day staffing overflow against the currently effective approved leave for the date plus the leave request being reviewed.
- Keep other pending leave requests visible as review context, but do not treat them as automatic blocking inputs.
- Keep half-day and hourly leave visible in review context, but do not promote them into first-pass automatic staffing-cap math.
- Employee surfaces may explain conflict risk qualitatively, but must not expose peer names, exact staffing counts, or other team-private rationale.
- Admin review surfaces must show company events, effective approved leave, pending leave context, and staffing-cap risk before a leave approval decision.
- Leave approvals that proceed despite a conflict warning must use explicit confirmation rather than a blind one-click action.
- Follow-up leave `change` and `cancel` requests continue to use the request-lifecycle model; this document only defines how conflict policy is interpreted around them.
- Approval, rejection, revision request, resubmission, and approved follow-up outcomes must clear or replace stale warnings, badges, queue rows, and calendar assumptions across employee and admin surfaces.

## Policy Inputs vs Derived Conflict Result

The result labels in this section are policy concepts, not promoted API fields.

| Situation                                                                       | Policy Inputs                                                                                            | Derived Conflict Result           | Required Surface Behavior                                                                                                                                             |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A leave request targets a workday with a company event                          | The date is still a normal workday, and at least one company event exists on that date                   | company-event warning             | Employees may still submit the request; employee and admin surfaces both show that the date is operationally sensitive rather than silently normal                    |
| A full-day leave request would stay within the current staffing cap if approved | Effective approved full-day leave plus the current request does not exceed the date's staffing cap       | no automatic cap overflow         | Admin review still shows the approved and pending context for the date, but no cap-overflow confirmation is required                                                  |
| A full-day leave request would exceed the current staffing cap if approved      | Effective approved full-day leave plus the current request exceeds the date's staffing cap               | staffing-cap overflow warning     | Employees may still submit; admins must see the overflow warning before deciding and must explicitly confirm if they approve anyway                                   |
| Other leave requests are still pending on the same date                         | One or more same-date leave requests are pending review, but are not yet effective approved leave        | pending-context warning only      | Pending requests stay visible to admins as context and queue pressure, but they do not become automatic blocking math for employee submission or approval             |
| A half-day or hourly leave request targets a capacity-sensitive date            | The date already has company-event sensitivity, approved leave pressure, pending leave pressure, or both | manual capacity judgment required | The employee sees a qualitative warning; the admin sees same-date context but the system does not pretend to have final automatic capacity math for partial-day cases |
| The date is a non-workday or company-wide closure                               | `expectedWorkday.isWorkday=false` or equivalent non-workday semantics apply                              | outside this document             | Submission availability and attendance interpretation continue to follow `docs/attendance-operating-model.md` rather than this conflict policy                        |

## Employee Pre-Submit Scenarios

| Moment                                                                                                     | Policy Inputs                                                                              | Policy Result                                   | Required Surface Behavior                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Employee selects a date with a company event in the leave calendar                                         | Same-day company event exists                                                              | strong warning before submission                | The calendar cell and request entry point indicate that the date is sensitive, and the request form repeats the warning with clear next-action guidance before submit                                       |
| Employee selects a full-day leave date that would exceed staffing capacity if approved                     | Current effective approved leave plus the new full-day request would exceed the cap        | submit allowed, approval risk highlighted       | The employee is warned that the date has limited staffing capacity and may require stricter review, but the form still allows submission                                                                    |
| Employee selects a date that already has other pending leave requests                                      | Same-date pending requests exist, but effective approved leave does not yet exceed the cap | context-only warning                            | The employee may be told that the date is under active review pressure, but the product must not imply that another employee has already won the slot                                                       |
| Employee selects a half-day or hourly leave on a sensitive date                                            | Company-event sensitivity, staffing pressure, or both are present                          | qualitative warning without fake precision      | The employee sees that the date needs closer review, but the surface does not expose exact staffing counts or claim a final capacity decision from partial-day math that the product does not formalize yet |
| Employee starts a leave `change` or `cancel` follow-up on an already approved request for a sensitive date | The earlier approval is still effective, and the new request is a follow-up                | earlier approval remains effective until review | The employee sees the current approved leave together with the new follow-up and any relevant conflict warning so the product never implies that the change is already approved                             |
| Employee submits despite a conflict warning                                                                | Warning state existed before submission                                                    | request enters normal pending review            | The request becomes pending review rather than being auto-rejected, and the employee sees that the next step belongs to admin review                                                                        |

## Admin Review Scenarios

| Moment                                                                                              | Policy Inputs                                                                                         | Policy Result                                                                                  | Required Surface Behavior                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin opens a leave request on a company-event date                                                 | Same-day company event exists                                                                         | company-event warning                                                                          | The review workspace shows the event context before the admin decides, and the warning is not hidden behind hover-only disclosure                                                                                     |
| Admin opens a full-day leave request that would exceed the staffing cap if approved                 | Effective approved full-day leave plus the current request exceeds the cap                            | staffing-cap overflow warning                                                                  | The workspace shows the cap risk together with the approved leave already in force, and the approval action requires explicit confirmation                                                                            |
| Admin opens a date that has multiple pending leave requests                                         | Same-date pending requests exist in addition to the current request                                   | context pressure, not automatic block                                                          | The workspace shows the pending queue pressure as review context, but the admin still evaluates the current request against the effective approved state rather than pretending pending requests are already approved |
| Admin reviews a half-day or hourly leave request on a sensitive date                                | Partial-day leave is involved on a date with staffing sensitivity, company-event sensitivity, or both | manual judgment remains necessary                                                              | The workspace shows the leave type, time context, and same-date requests, but the system does not claim a final automatic overflow calculation for the partial-day case                                               |
| Admin reviews a follow-up `change` or `cancel` request while the earlier approval remains effective | The active request is pending, but the effective status for the chain is still the earlier approval   | conflict policy applies to the active review target without hiding the current effective leave | The workspace keeps the effective approved leave visible next to the pending follow-up so the admin can judge operational impact without losing chain context                                                         |
| Admin approves a warning-bearing leave request                                                      | Company-event warning, staffing-cap warning, or both are present                                      | explicit override-style confirmation                                                           | The confirmation UI repeats the warning context before final approval, and approval immediately refreshes employee/admin surfaces so stale warnings or stale calendar assumptions do not linger                       |
| Admin rejects or requests revision on a warning-bearing leave request                               | The request carries conflict warnings and the admin decides not to approve it                         | non-approved outcome with rationale                                                            | The admin records a review comment through the existing request-lifecycle model, and the employee sees the rationale together with the next action without any stale pending-state messaging                          |

## Shared Invariants And Forbidden Behaviors

### Shared Invariants

- Leave conflict policy must never silently disagree between employee and admin surfaces for the same date and request chain.
- Conflict warnings must appear before an approval decision, not only after a decision has already been made.
- Employee conflict messaging must stay qualitative and collaborative rather than exposing peer-specific internal operations detail.
- Pending leave requests may shape admin judgment, but they are not equivalent to effective approved leave in first-pass staffing-cap policy.
- Follow-up leave requests must remain governed by the request-lifecycle model while still inheriting any relevant company-event or staffing-cap context for the reviewed date.
- A resolved review outcome must clear or replace stale conflict warnings, badges, queue states, and calendar assumptions everywhere the chain appears.

### Forbidden Behaviors

- Do not hard-block employee submission only because a company event exists on an otherwise valid workday.
- Do not hard-block employee submission only because the date is staffing-sensitive in the current first-pass product.
- Do not compute staffing-cap overflow as if pending leave requests were already approved.
- Do not present hover as the only way to access the reason for a company-event or staffing-cap warning.
- Do not expose peer names, exact staffing counts, or other team-private approval rationale on employee leave surfaces.
- Do not hide the currently effective approved leave when a pending `change` or `cancel` follow-up is under review.
- Do not leave stale conflict banners, stale queue states, or stale calendar badges behind after review or follow-up outcomes change the active state.

## Downstream Ownership And Deferred Questions

This document owns leave operational conflict policy, not every downstream contract detail.

- `docs/feature-requirements.md` owns the user-visible expectations for employee leave entry and admin review surfaces.
- `docs/ui-guidelines.md` owns presentation rules such as disclosure depth, confirmation patterns, warning placement, and message tone.
- `docs/request-lifecycle-model.md` owns follow-up request chains, review decisions, and shared employee/admin request-state synchronization.
- `docs/attendance-operating-model.md` owns non-workday semantics, leave coverage inside attendance interpretation, and leave-work conflict handling after attendance facts exist.
- `docs/api-spec.md` owns any later HTTP projections or field names that expose this policy over the mock API.
- `docs/database-schema.md` owns any later conceptual entities or vocabulary that formalize this policy in shared data terms.
- `docs/product-spec-context.md` keeps the raw discussion history and future-policy questions that remain outside this first-pass contract.

Deferred questions that remain outside this document:

- How rich future company-event ownership should become beyond the current read-only seeded inputs
- When half-day or hourly leave should graduate from admin-reviewed context into formal automatic staffing-cap math
- Whether any future approval override path should persist explicit override rationale in API or schema fields
- What notification timing or delivery rules should exist around leave conflict warnings and review outcomes
