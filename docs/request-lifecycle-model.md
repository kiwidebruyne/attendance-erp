# Request Lifecycle Model

## Purpose

This document is the primary source of truth for request workflow semantics across manual attendance requests and leave requests.
It explains when a request may be edited, withdrawn, revised, resubmitted, changed, canceled, or decision-revised, and which cross-screen guarantees must hold for both employee and admin views.

This document does not own raw discussion history, full HTTP payload definitions, or final UI layout decisions.
Those concerns remain in `docs/product-spec-context.md`, `docs/api-spec.md`, `docs/database-schema.md`, `docs/feature-requirements.md`, and `docs/ui-guidelines.md`.

## Workflow Defaults

- Treat a reviewed request as immutable request content. Later changes must not silently overwrite that reviewed submission.
- A request chain starts with one root request and may later gain follow-up requests such as a resubmission, change request, or cancel request.
- A pending request may still be edited or withdrawn in place before admin review.
- A reviewed outcome that asks the employee to act again must keep the prior review reason visible together with the next action.
- A chain may have at most one active employee-submitted follow-up at a time.
- The latest activity in a chain and the currently effective reviewed result are related but not always identical.
- Employee and admin views must stay synchronized on the same active request, effective result, review rationale, and next action.
- The current product does not allow a manager to directly reverse an already approved request. Normal post-approval changes continue through employee-submitted follow-up change or cancel requests.

## Lifecycle Concepts

| Concept                        | Meaning                                                                              | Notes                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| root request                   | the first submitted request in a lifecycle chain                                     | preserved as history even when later requests supersede it                        |
| pending request                | a request that has not yet been reviewed by an admin                                 | may still be edited or withdrawn by the employee                                  |
| reviewed request               | a request that already received an admin outcome                                     | request content is no longer edited in place                                      |
| follow-up request              | a later employee-submitted request linked to an earlier reviewed request             | used for resubmission, approved-state change, or approved-state cancel flows      |
| active request                 | the request that currently awaits action from either employee or admin               | there should be at most one active employee-submitted follow-up in the same chain |
| effective result               | the latest reviewed result that currently governs attendance or leave interpretation | may remain the prior approval while a follow-up request is still pending          |
| review comment                 | the admin-provided rationale that explains a rejection or revision request           | must stay visible until the employee resolves that outcome                        |
| non-approved decision revision | an admin-side change to a previous non-approved review outcome                       | recorded as append-only review history, not a silent rewrite of employee input    |

## Contract Decisions

| Question                                                 | Decision                                                                              | Why                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Can a pending request be edited directly?                | Yes.                                                                                  | Review has not happened yet, so employee convenience should win over chain expansion.   |
| Can a reviewed request be edited directly?               | No.                                                                                   | Silent overwrite would break auditability and employee-admin trust.                     |
| How should an admin ask for corrections?                 | Use a distinct revision-requested outcome rather than treating it as generic pending. | Both sides need one shared current state and next action.                               |
| How should an employee reapply after a reviewed outcome? | Submit a new follow-up request that is prefilled from the prior request.              | This preserves history while keeping resubmission easy.                                 |
| How should an employee modify an approved request?       | Submit a follow-up change request.                                                    | The current approval must remain effective until the new request is reviewed.           |
| How should an employee cancel an approved request?       | Submit a follow-up cancel request.                                                    | Pre-review withdrawal and post-approval cancellation are different contracts.           |
| How should an admin change a past non-approved decision? | Append a new review event rather than rewriting employee-submitted request content.   | Decision history should stay explainable to both sides without reopening approved data. |
| Can an approved request transition directly to rejected? | No.                                                                                   | Retroactive rejection would break trust and obscure the already-effective approval.     |
| Are manager-initiated post-approval changes in scope?    | No. Use employee-submitted follow-up change or cancel requests instead.               | The first-pass product keeps approved-request reversal out of scope.                    |
| How should supersession work?                            | As a relationship inside the chain, not as a replacement of history.                  | The product must show both the latest effective result and the previous reviewed steps. |

## Operational Flow Scenarios

### Employee Edits A Pending Request Before Review

| Moment                                   | Lifecycle Fact Changes                                                      | Effective Result                                                  | Required Surface Behavior                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Employee submits a first request         | create a new root request; no review history exists yet                     | no reviewed result exists yet; the chain is awaiting admin review | employee and admin both see one pending request                                   |
| Employee notices a mistake before review | update the same pending request in place; do not create a follow-up request | still no reviewed result exists yet                               | the admin queue and employee history must both reflect the latest pending payload |
| Admin opens the request after the edit   | no new lifecycle change                                                     | the edited pending request is the only review target              | stale copies of the older pending values must not remain visible anywhere         |

### Employee Withdraws A Pending Request Before Review

| Moment                                         | Lifecycle Fact Changes                                     | Effective Result                                         | Required Surface Behavior                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| A pending request exists with no admin outcome | chain contains one active pending request                  | no reviewed result exists yet                            | employee can still withdraw without creating a follow-up request                                                         |
| Employee withdraws the request                 | mark the same request as withdrawn; preserve it in history | there is no longer any active review target in the chain | default pending queues and badges clear immediately; history still shows that the request once existed and was withdrawn |
| Employee returns to the screen later           | no new lifecycle change                                    | the withdrawn request remains historical only            | the UI must not keep offering the withdrawn request as if it were still under review                                     |

### Admin Requests Revision Instead Of Rejecting Immediately

| Moment                                                | Lifecycle Fact Changes                                                     | Effective Result                                                                             | Required Surface Behavior                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Admin reviews a pending request that needs correction | append a review outcome that requests revision and stores a review comment | the chain now has a reviewed revision-requested outcome                                      | employee and admin both see the same current state, the same rationale, and the same next action               |
| Employee opens the request detail                     | no new lifecycle change                                                    | revision request remains the current reviewed outcome until a follow-up is submitted         | the prior input, review comment, and correction path must appear together rather than in separate hidden views |
| Admin checks the queue later                          | no new lifecycle change                                                    | the request is no longer simple pending and should not be mistaken for untouched review work | the workspace must distinguish revision-requested items from untouched pending submissions                     |

### Employee Resubmits After A Revision Request

| Moment                                            | Lifecycle Fact Changes                                                                             | Effective Result                                                                                                  | Required Surface Behavior                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Employee starts from a revision-requested request | load the prior reviewed request as the source for a prefilled follow-up form                       | the current reviewed outcome is still revision requested until the new follow-up is submitted                     | the employee should not have to re-enter the whole request from scratch                                     |
| Employee submits the corrected version            | create a follow-up request linked to the earlier reviewed request; categorize it as a resubmission | the new follow-up becomes the active review target; the earlier review comment remains part of the chain history  | employee and admin both see that this is a resubmission of an earlier request, not an unrelated new request |
| Admin opens the new follow-up                     | no new lifecycle change                                                                            | the active request is the new resubmission, while the prior revision-requested outcome remains historical context | the workspace must keep the previous review reason visible beside the new payload                           |

### Employee Resubmits After A Rejection

| Moment                               | Lifecycle Fact Changes                                                                 | Effective Result                                                             | Required Surface Behavior                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A request was rejected with a reason | append a rejection outcome with a required review comment                              | the current reviewed outcome is rejected                                     | employee sees the rejection reason and a clear resubmission path                                                                   |
| Employee chooses to try again        | create a new follow-up request linked to the rejected request; prefill the prior input | the rejected outcome stays in history while the new follow-up becomes active | the UI must show both the pending resubmission and the earlier rejection rationale without pretending the rejection never happened |
| Admin reviews the resubmission       | no new lifecycle change yet                                                            | the active request is the new follow-up, not the old rejected request        | the queue should not split the chain into two unrelated items                                                                      |

### Employee Requests A Change After Approval

| Moment                                        | Lifecycle Fact Changes                                                                                        | Effective Result                                                          | Required Surface Behavior                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A request is already approved                 | the chain has an approved reviewed result that currently governs attendance or leave interpretation           | the approved request is still effective                                   | employee and admin both see the approval as the current effective result                                         |
| Employee wants to modify the approved details | create a follow-up change request linked to the approved request                                              | the prior approval remains effective until the change request is reviewed | the UI must show "approved request plus pending change request" rather than silently replacing the approved data |
| Admin approves the change request             | append the new approval to the follow-up request and mark the earlier approval as superseded inside the chain | the new approval becomes the effective result                             | both sides see the new approved state and the old approval as superseded history rather than deleted history     |

### Employee Requests Cancellation After Approval

| Moment                                                | Lifecycle Fact Changes                                                                              | Effective Result                                                     | Required Surface Behavior                                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A request is already approved and currently effective | no new lifecycle change yet                                                                         | the approval remains in force                                        | employee may ask to cancel, but cannot silently erase the existing approval                         |
| Employee submits a cancel request                     | create a follow-up cancel request linked to the approved request                                    | the prior approval remains effective until cancel review is complete | employee and admin both see that cancellation is requested but not yet effective                    |
| Admin approves the cancel request                     | append the cancel approval to the follow-up request and supersede the earlier approval in the chain | the effective result changes from approved to canceled-by-follow-up  | stale approved-state CTAs, badges, and calendar assumptions must clear promptly across all surfaces |

### Manager Encounters An Approved Request That Needs Adjustment

| Moment                                                                       | Lifecycle Fact Changes                                          | Effective Result                                                       | Required Surface Behavior                                                                             |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A request is already approved, but the manager now believes it should change | no new lifecycle change in the current product                  | the existing approval remains effective                                | the product must not offer a direct `approved -> rejected` or manager-driven overwrite path           |
| The manager needs the request to change                                      | ask the employee to submit a follow-up change or cancel request | the earlier approval remains effective until the follow-up is reviewed | employee and admin should both understand that the next action belongs to the employee follow-up flow |
| A true emergency override is discussed                                       | still no current-product lifecycle change                       | no exceptional admin override exists in the current scope              | treat this as future policy work tracked in issue `#53`, not as behavior to implement now             |

### Admin Revises A Non-Approved Decision

| Moment                                                          | Lifecycle Fact Changes                                                                                     | Effective Result                                                                        | Required Surface Behavior                                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Admin decides a previous review outcome was wrong or incomplete | append a new review history event to the existing chain; do not rewrite employee-submitted request content | the effective result changes only if the new admin review outcome changes it            | both sides must be able to see that the admin changed the decision and why                                          |
| The prior outcome had already driven downstream UI state        | no new lifecycle change beyond the appended review event                                                   | the new review event becomes the current effective result when applicable               | old badges, warnings, and next actions must be replaced so the employee does not keep seeing the overturned outcome |
| Another admin inspects the chain later                          | no new lifecycle change                                                                                    | the chain should explain the full decision path from original review to revised outcome | the product must not look like the first decision never existed                                                     |

### Latest Activity Versus Effective Result

| Situation                                                  | Lifecycle Interpretation                                                                                        | Required Surface Behavior                                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| An approved request has a pending follow-up change request | latest activity is the pending follow-up, but the effective result is still the earlier approval                | show both facts together so the employee does not think the change is already approved |
| A revision-requested request has no follow-up yet          | latest activity and effective result both point to the revision-requested reviewed step                         | show the review comment and the "submit corrected follow-up" action together           |
| A rejected request has a new pending resubmission          | latest activity is the resubmission, while the prior rejection remains the most recent completed review outcome | keep the previous rejection reason visible until the resubmission is reviewed          |
| A follow-up approval supersedes an earlier approval        | latest activity and effective result both point to the new approved follow-up                                   | the older approval remains visible only as superseded history                          |

### Stale State Cleanup

| Trigger                                        | Cleanup Expectation                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| employee edits a pending request               | older pending payload snapshots disappear from active surfaces                                            |
| employee withdraws a pending request           | pending queue badges and review CTAs clear immediately                                                    |
| admin requests revision                        | simple pending indicators are replaced by revision-requested messaging and correction guidance            |
| employee submits a resubmission                | old "please revise" or rejection-only warnings stop being the active state and become historical context  |
| admin approves a change or cancel follow-up    | prior effective approvals become superseded history and stop driving active CTAs                          |
| admin revises an earlier non-approved decision | overturned non-approved outcomes stop driving active banners, badges, or warnings anywhere in the product |

## Shared Invariants And Forbidden Behaviors

### Shared Invariants

- A reviewed request must never be silently overwritten by a later employee change.
- Employee and admin views must agree on the same active request, effective result, review rationale, and next action for a chain.
- A resubmission, change request, or cancel request must stay visibly linked to the earlier request that it follows.
- Resubmission flows must start from a prefilled copy of the earlier request rather than a blank form.
- Pre-review withdrawal must remain distinguishable from post-approval cancellation.
- An already approved request must not transition directly to `rejected` in the current product.
- Latest activity and effective result must both be explainable from the same visible chain history.
- Important request-state changes must clear or replace stale warnings, badges, queue states, and CTAs promptly.

### Forbidden Behaviors

- Do not let admins edit employee-submitted request content in place after review.
- Do not treat a revision-requested item as if it were an untouched pending request.
- Do not delete or hide the prior rejection or revision reason when a resubmission is created.
- Do not mark an approved request as changed or canceled before the follow-up request is actually reviewed and approved.
- Do not let a manager directly reverse an already approved request in the current product.
- Do not allow the same chain to accumulate multiple active employee-submitted follow-up requests at once.
- Do not let employee and admin screens disagree about whether a request is pending review, awaiting employee correction, still effectively approved, or already superseded.

## Downstream Ownership And Follow-Up

This document owns request workflow semantics, not every downstream contract detail.

- `docs/feature-requirements.md` owns user-visible screen requirements for employee and admin request surfaces.
- `docs/ui-guidelines.md` owns layout, copy, and interaction guidance for request-related UI.
- `docs/api-spec.md` owns endpoint shapes, query parameters, and final field names for request lifecycle data.
- `docs/database-schema.md` owns the conceptual request entities, relations, and final enum names.
- `docs/product-spec-context.md` keeps the raw discussion history and higher-level product rationale that led here.

The next synchronized documentation pass should use this document to settle:

- exact API and schema naming for revision-requested and pre-review-withdrawn outcomes
- exact queue and history projections for follow-up requests
- exact employee-facing and admin-facing payload fields needed to expose chain context without ambiguity
