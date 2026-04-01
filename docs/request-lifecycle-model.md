# Request Lifecycle Model

## Purpose

This document is the primary source of truth for request workflow semantics across manual attendance requests and leave requests.
It explains when a request may be edited, withdrawn, revised, resubmitted, changed, canceled, or decision-revised, and which cross-screen guarantees must hold for both employee and admin views.

This document does not own raw discussion history, full HTTP payload definitions, or final UI layout decisions.
Those concerns remain in `docs/product-spec-context.md`, `docs/api-spec.md`, `docs/database-schema.md`, `docs/feature-requirements.md`, and `docs/ui-guidelines.md`.

## Workflow Defaults

- Treat reviewed request content as immutable. Later changes must not silently overwrite that reviewed submission.
- A request chain starts with one root request and may later gain employee-submitted follow-up requests.
- A pending request may still be edited or withdrawn in place before admin review.
- A reviewed outcome that asks the employee to act again must keep the prior review comment visible together with the next action.
- A chain may have at most one active employee-submitted follow-up at a time.
- Employee and admin views must stay synchronized on the same active request, effective status, review rationale, and next action.
- The current product does not allow a manager to directly reverse an already approved request.
- Approved-state follow-up `change` and `cancel` flows are currently formalized only for leave requests.
- Manual attendance requests currently support pre-review edit and withdrawal plus post-review resubmission, but not approved-state follow-up `change` or `cancel`.

## Promoted Contract Vocabulary

### Request Status

- `pending`
- `revision_requested`
- `withdrawn`
- `approved`
- `rejected`

`status` keeps its existing field name.
The promoted enum vocabulary is now `Request Status`, not `Approval Status`.

### Follow-Up Kind

- `resubmission`
- `change`
- `cancel`

Root requests use `followUpKind = null`.

### Request Review Decision

- `approve`
- `reject`
- `request_revision`

`reviewComment` is required for `reject` and `request_revision`.

### Request Queue View

- `needs_review`
- `waiting_for_employee`
- `completed`
- `all`

These are derived queue groupings, not stored request statuses.

### Request Next Action

- `admin_review`
- `employee_resubmit`
- `none`

These values are shared request-surface projections, not attendance-display actions.

### Relation Fields

- `rootRequestId`
- `parentRequestId`
- `followUpKind`
- `supersededByRequestId`

Use these fields to encode request-chain identity.
Do not add a separate `chainId` in the current product.

### Shared Request Projection Fields

- `activeRequestId`
- `activeStatus`
- `effectiveRequestId`
- `effectiveStatus`
- `governingReviewComment`
- `hasActiveFollowUp`
- `nextAction`

`active*` points to the request that currently awaits employee or admin action and becomes `null` when a chain has no active work.
`effective*` points to the request state that currently governs the chain, including pre-review `withdrawn`.
`governingReviewComment` is the latest unresolved `reject` or `request_revision` rationale that must stay visible while the employee still owes a response; otherwise it is `null`.

## Lifecycle Concepts

| Concept           | Meaning                                                                    | Notes                                                                  |
| ----------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| root request      | the first submitted request in a lifecycle chain                           | preserved as history even when later requests supersede it             |
| follow-up request | a later employee-submitted request linked to an earlier request            | used for resubmission, leave change, or leave cancel flows             |
| active request    | the request that currently awaits action from either employee or admin     | there may be at most one active employee-submitted follow-up per chain |
| effective status  | the request state that currently governs what the product should show      | may differ from latest activity while a follow-up is still pending     |
| review comment    | the admin rationale attached to `reject` or `request_revision`             | must stay visible until the employee resolves that outcome             |
| review event      | an append-only admin review record                                         | used for the first review on a request record                          |
| supersession      | the relationship by which a newer approved follow-up replaces an older one | stored as request-to-request linkage, not as deleted history           |

## Contract Decisions

| Question                                                     | Decision                                                                                                                                                | Why                                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Can a pending request be edited directly?                    | Yes.                                                                                                                                                    | Review has not happened yet, so employee convenience should win over chain expansion.                        |
| Can a pending request be withdrawn directly?                 | Yes. Use `status = withdrawn` on the same request.                                                                                                      | Pre-review withdrawal is simpler than creating another lifecycle object.                                     |
| How do employee clients mutate a pending request over HTTP?  | Use `PATCH /api/attendance/manual/[id]` or `PATCH /api/leave/request/[id]` to edit fields in place or set `status = withdrawn`.                         | The API contract must expose the same pre-review edit and withdraw behavior that the lifecycle model allows. |
| Can a reviewed request be edited directly?                   | No.                                                                                                                                                     | Silent overwrite would break auditability and employee-admin trust.                                          |
| How should an admin ask for corrections?                     | Use `status = revision_requested` through a `request_revision` review event.                                                                            | Both sides need one shared current state and next action.                                                    |
| How should an employee reapply after a non-approved outcome? | Submit a prefilled follow-up request with `followUpKind = resubmission`.                                                                                | This preserves history while keeping resubmission easy.                                                      |
| How should an employee modify an approved leave request?     | Submit a follow-up leave request with `followUpKind = change`.                                                                                          | The current approval must remain effective until the new request is reviewed.                                |
| How should an employee cancel an approved leave request?     | Submit a follow-up leave request with `followUpKind = cancel`.                                                                                          | Pre-review withdrawal and post-approval cancellation are different contracts.                                |
| How should manual attendance behave after approval?          | Approved manual attendance currently does not support follow-up `change` or `cancel`.                                                                   | Approval already writes canonical attendance facts, so post-approval rollback is deferred.                   |
| How should an admin change a past non-approved decision?     | Do not change it on the same request record. A reviewed non-approved request stays locked until the employee submits a linked `resubmission` follow-up. | Both sides need one stable rule for who acts next after a non-approved review.                               |
| Can an approved request transition directly to rejected?     | No.                                                                                                                                                     | Retroactive rejection would break trust and obscure the already-effective approval.                          |
| Are manager-initiated post-approval changes in scope?        | No. Use employee-submitted follow-up leave change or cancel requests instead.                                                                           | The first-pass product keeps approved-request reversal out of scope.                                         |
| How should supersession work?                                | As a relationship inside the chain via `supersededByRequestId`.                                                                                         | The product must show both the latest effective result and the previous reviewed steps.                      |
| How many active employee follow-ups may exist per chain?     | One. Any second follow-up attempt must fail with `409 conflict` and point to the existing follow-up.                                                    | Parallel branches would make the chain ambiguous.                                                            |

## Operational Flow Scenarios

### Employee Edits A Pending Request Before Review

| Moment                                   | Lifecycle Fact Changes                                                      | Effective Status                                     | Required Surface Behavior                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| Employee submits a first request         | create a new root request; no review history exists yet                     | `effectiveStatus = pending`                          | employee and admin both see one pending request                                   |
| Employee notices a mistake before review | update the same pending request in place; do not create a follow-up request | `effectiveStatus = pending` on the edited request    | the admin queue and employee history must both reflect the latest pending payload |
| Admin opens the request after the edit   | no new lifecycle change                                                     | the edited pending request is the only review target | stale copies of the older pending values must not remain visible anywhere         |

### Employee Withdraws A Pending Request Before Review

| Moment                                         | Lifecycle Fact Changes                                       | Effective Status                                        | Required Surface Behavior                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| A pending request exists with no admin outcome | chain contains one active pending request                    | `effectiveStatus = pending`                             | employee can still withdraw without creating a follow-up request                                                         |
| Employee withdraws the request                 | mark the same request as `withdrawn`; preserve it in history | `effectiveStatus = withdrawn`; `activeRequestId = null` | default pending queues and badges clear immediately; history still shows that the request once existed and was withdrawn |
| Employee returns to the screen later           | no new lifecycle change                                      | the withdrawn request remains governing history         | the UI must not keep offering the withdrawn request as if it were still under review                                     |

### Admin Requests Revision Instead Of Rejecting Immediately

| Moment                                                | Lifecycle Fact Changes                                                         | Effective Status                                                            | Required Surface Behavior                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Admin reviews a pending request that needs correction | append a `request_revision` review event and set `status = revision_requested` | `effectiveStatus = revision_requested`; `nextAction = employee_resubmit`    | employee and admin both see the same current state, the same rationale, and the same next action               |
| Employee opens the request detail                     | no new lifecycle change                                                        | revision request remains the governing state until a follow-up is submitted | the prior input, review comment, and correction path must appear together rather than in separate hidden views |
| Admin checks the queue later                          | no new lifecycle change                                                        | the request is no longer untouched review work                              | the workspace must distinguish revision-requested items from untouched pending submissions                     |

### Employee Resubmits After A Non-Approved Outcome

| Moment                                                        | Lifecycle Fact Changes                                                                                       | Effective Status                                                                                                                                                               | Required Surface Behavior                                                                                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Employee starts from a rejected or revision-requested request | load the prior request as the source for a prefilled follow-up form                                          | the current non-approved status remains governing until the new follow-up is submitted                                                                                         | the employee should not have to re-enter the whole request from scratch                                                                                                               |
| Employee submits the corrected version                        | create a follow-up request with `followUpKind = resubmission` and `parentRequestId` set to the prior request | `activeRequestId`, `activeStatus`, `effectiveRequestId`, and `effectiveStatus` move to the new pending follow-up; the previous review comment remains visible as chain context | employee and admin both see that this is a resubmission of an earlier request, not an unrelated new request, and the prior non-approved outcome stops being the current review target |
| Admin opens the new follow-up                                 | no new lifecycle change                                                                                      | the active and effective request is the new resubmission, while the prior non-approved outcome remains historical context                                                      | the workspace must keep the previous review reason visible beside the new payload                                                                                                     |

### Employee Requests A Leave Change After Approval

| Moment                                              | Lifecycle Fact Changes                                                                                          | Effective Status                                                          | Required Surface Behavior                                                                                    |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A leave request is already approved                 | the chain has an approved reviewed result that currently governs leave interpretation                           | `effectiveStatus = approved` on the prior leave request                   | employee and admin both see the approval as the current effective result                                     |
| Employee wants to modify the approved leave details | create a follow-up leave request with `followUpKind = change` and `parentRequestId` set to the approved request | the prior approval remains effective until the change request is reviewed | the UI must show approved leave plus pending change request rather than silently replacing the approved data |
| Admin approves the change request                   | append an `approve` review event on the follow-up and set the earlier approval's `supersededByRequestId`        | the new approved follow-up becomes the effective result                   | both sides see the new approved state and the old approval as superseded history rather than deleted history |

### Employee Requests Leave Cancellation After Approval

| Moment                                                      | Lifecycle Fact Changes                                                                                          | Effective Status                                                      | Required Surface Behavior                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A leave request is already approved and currently effective | no new lifecycle change yet                                                                                     | the approval remains in force                                         | employee may ask to cancel, but cannot silently erase the existing approval                         |
| Employee submits a cancel request                           | create a follow-up leave request with `followUpKind = cancel` and `parentRequestId` set to the approved request | the prior approval remains effective until cancel review is complete  | employee and admin both see that cancellation is requested but not yet effective                    |
| Admin approves the cancel request                           | append the cancel approval to the follow-up request and supersede the earlier approval in the chain             | the effective status changes to the approved cancel follow-up outcome | stale approved-state CTAs, badges, and calendar assumptions must clear promptly across all surfaces |

### Approved Manual Attendance Requests Stay Out Of Post-Approval Follow-Up Scope

| Moment                                                            | Lifecycle Fact Changes                                   | Effective Status                                         | Required Surface Behavior                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A manual attendance request is already approved                   | approval has already written canonical attendance facts  | the approved manual request remains the governing record | employee and admin both see the correction as already applied                                    |
| Someone wants to change or cancel that approved manual correction | no new current-product follow-up request flow is created | the approved manual request stays effective              | the product must not offer manual-attendance follow-up `change` or `cancel` in the current scope |
| A future policy discussion happens                                | still no current-product lifecycle change                | no approved manual-attendance override exists today      | treat this as later product work, not current implementation guidance                            |

### Manager Encounters An Approved Request That Needs Adjustment

| Moment                                                                       | Lifecycle Fact Changes                                                | Effective Status                                                       | Required Surface Behavior                                                                             |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A request is already approved, but the manager now believes it should change | no new lifecycle change in the current product                        | the existing approval remains effective                                | the product must not offer a direct `approved -> rejected` or manager-driven overwrite path           |
| The manager needs an approved leave request to change                        | ask the employee to submit a follow-up leave change or cancel request | the earlier approval remains effective until the follow-up is reviewed | employee and admin should both understand that the next action belongs to the employee follow-up flow |
| A true emergency override is discussed                                       | still no current-product lifecycle change                             | no exceptional admin override exists in the current scope              | treat this as future policy work tracked in issue `#53`, not as behavior to implement now             |

### Admin Tries To Re-Review A Non-Approved Request On The Same Record

| Moment                                                                                              | Lifecycle Fact Changes                                              | Effective Status                                                                    | Required Surface Behavior                                                                                            |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Admin attempts to review a previously `rejected` or `revision_requested` request on the same record | no lifecycle change; reject the write with `409 conflict`           | the prior non-approved outcome remains governing until an employee follow-up exists | both sides must keep seeing the prior outcome, rationale, and `nextAction = employee_resubmit` as the current rule   |
| The employee has not submitted a linked follow-up yet                                               | no new lifecycle change                                             | the non-approved reviewed step still governs the chain                              | the product must not look like the admin can reopen the same request record or silently change the earlier decision  |
| The employee later submits a linked `resubmission` follow-up                                        | create a new follow-up request linked to the prior reviewed request | the new pending follow-up becomes the active and effective review target            | the old rationale remains visible as historical context, but the new pending follow-up becomes the only admin target |

### Latest Activity Versus Effective Status

| Situation                                                               | Lifecycle Interpretation                                                                                                              | Required Surface Behavior                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A pending root request awaits first review                              | latest activity and effective status both point to the root pending request                                                           | show one pending item with `nextAction = admin_review`                                 |
| A withdrawn root request has no follow-up                               | latest activity and effective status both point to the withdrawn request                                                              | keep it historical only; do not surface it as active work                              |
| A rejected or revision-requested request has no follow-up yet           | latest activity and effective status both point to the non-approved reviewed step                                                     | show the review comment and the submit-corrected-follow-up action together             |
| A rejected or revision-requested request has a new pending resubmission | latest activity and effective status both point to the resubmission, while the previous non-approved outcome remains relevant history | keep the previous review comment visible until the resubmission is reviewed            |
| An approved leave request has a pending change request                  | latest activity is the pending follow-up, but effective status is still the earlier approval                                          | show both facts together so the employee does not think the change is already approved |
| A follow-up approval supersedes an earlier approval                     | latest activity and effective status both point to the new approved follow-up                                                         | the older approval remains visible only as superseded history                          |

### Stale State Cleanup

| Trigger                                                                 | Cleanup Expectation                                                                                                                       |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| employee edits a pending request                                        | older pending payload snapshots disappear from active surfaces                                                                            |
| employee withdraws a pending request                                    | pending queue badges and review CTAs clear immediately                                                                                    |
| admin requests revision                                                 | simple pending indicators are replaced by revision-requested messaging and correction guidance                                            |
| employee submits a resubmission                                         | old revision or rejection warnings stop being the active state and become historical context                                              |
| admin approves a leave change or cancel follow-up                       | prior effective approvals become superseded history and stop driving active CTAs                                                          |
| admin attempts a same-record rewrite of a reviewed non-approved request | no lifecycle change occurs; current banners, badges, queue states, and next actions remain unchanged while the API returns `409 conflict` |

## Shared Invariants And Forbidden Behaviors

### Shared Invariants

- A reviewed request must never be silently overwritten by a later employee change.
- A reviewed `rejected` or `revision_requested` request stays locked to same-record admin review writes until an employee submits a linked `resubmission` follow-up.
- Employee and admin views must agree on the same active request, effective status, review rationale, and next action for a chain.
- A resubmission, leave change request, or leave cancel request must stay visibly linked to the earlier request that it follows.
- Resubmission flows must start from a prefilled copy of the earlier request rather than a blank form.
- Pre-review withdrawal must remain distinguishable from post-approval cancellation.
- An already approved request must not transition directly to `rejected` in the current product.
- Approved manual-attendance requests must not advertise post-approval follow-up `change` or `cancel` in the current scope.
- Latest activity and effective status must both be explainable from the same visible chain history.
- Important request-state changes must clear or replace stale warnings, badges, queue states, and CTAs promptly.

### Forbidden Behaviors

- Do not let admins edit employee-submitted request content in place after review.
- Do not let admins append a new review outcome to a `rejected` or `revision_requested` request on the same request record.
- Do not treat a `revision_requested` item as if it were an untouched pending request.
- Do not delete or hide the prior review comment when a resubmission is created.
- Do not mark an approved leave request as changed or canceled before the follow-up request is actually reviewed and approved.
- Do not let a manager directly reverse an already approved request in the current product.
- Do not allow the same chain to accumulate multiple active employee-submitted follow-up requests at once.
- Do not let employee and admin screens disagree about whether a request is pending review, awaiting employee correction, still effectively approved, or already superseded.

## Downstream Ownership And Follow-Up

This document owns request workflow semantics, not every downstream contract detail.

- `docs/feature-requirements.md` owns user-visible screen requirements for employee and admin request surfaces.
- `docs/ui-guidelines.md` owns layout, copy, and interaction guidance for request-related UI.
- `docs/leave-conflict-policy.md` owns company-event conflicts, staffing-cap policy, and leave approval warning defaults that apply around leave request review.
- `docs/api-spec.md` owns endpoint shapes, query parameters, and final field names for request lifecycle data.
- `docs/database-schema.md` owns the conceptual request entities, relations, review-event model, and final enum names.
- `docs/product-spec-context.md` keeps the raw discussion history and higher-level product rationale that led here.
