# UI Guidelines

## Purpose

This document is the implementation-level UI authority for the project.
When implementing or modifying any UI component, page, or layout, agents **must**:

1. Read `DESIGN.md` first to load the project's design system - color tokens, typography scale, spacing primitives, and visual guardrails. All UI code must conform to these tokens; never hard-code values that the design system already defines.
2. Read `docs/ux-writing-guidelines.md` before introducing or changing product copy, CTA labels, or state messaging.
3. Run the `web-design-guidelines` skill (`.agents/skills/web-design-guidelines/SKILL.md`) against the affected files before marking the task complete. This ensures every UI change is validated against the [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) for accessibility, usability, and interface quality.
4. Always consider using the shadcn mcp and shadcn skills first when creating components or UI. Follow the mcp and skill's CLI and registry workflow, prefer shadcn components over hand-rolled UI, and only build custom UI after checking the existing shadcn options.

The originating reference image is stored at `docs/assets/erp-reference-dashboard.webp` and is cataloged from `docs/raw-assignment.md`.

## Overall Direction

- Use a professional ERP dashboard feel, not a marketing-site feel.
- Keep the interface clean, practical, and calm.
- Prefer information clarity over animation or decoration.
- Frontend work in the root Next.js application must follow Toss Design Guidelines for UX/UI decisions across web and mobile surfaces.
- If a form has a single critical input, that input must receive focus when the form is shown.
- Dialog UIs must support closing with the `Esc` key.

## Shared Shell Interpretation

- Treat `docs/assets/erp-reference-dashboard.webp` as a reference for the shared ERP chrome, not as a literal module-launcher layout to duplicate.
- Reuse the reference image's persistent dark sidebar, light content canvas, restrained top utility bar, and white card surfaces.
- Keep the shared page chrome consistent: each route should present a page title and one brief context line near the top of the content area.
- Global navigation should stay limited to the four assignment routes. Do not promote request queue views or attendance history view toggles into the sidebar.
- Keep `/admin/attendance` today-versus-history switching inside the page itself rather than promoting it into separate navigation.
- Narrow-width behavior should preserve the same information architecture through a drawer or sheet version of the sidebar instead of inventing a second mobile IA.
- Keep the shell visually calm. Avoid decorative dashboards or icon clutter that does not support a real assignment workflow.

## Employee Attendance First View

- `/attendance` should use a stable today card plus a separate active-exception stack before any history table or secondary summary.
- Keep the today card visible even when multiple critical exceptions are active. The card provides the user's current context; exception surfaces should not replace it.
- The today card should summarize the adjusted expected work window, current phase, next action, and current active exceptions.
- Treat active exceptions as independent surfaces rather than a single combined warning area.
- Keep every current active exception visible in the stack. Do not collapse lower-priority active exceptions into a badge count, overflow menu, or hidden secondary area while they still matter operationally.
- Each active exception surface should own its own CTA and explanation.
- Same-day attendance action on `/attendance` should act as an entry point into the existing attendance action UI rather than a second local owner of clock-in or clock-out behavior.
- History rows may expose the same recovery or review flows, but row actions should be compact re-entry points that stay less prominent than the top-of-screen surfaces.
- Do not let users dismiss unresolved active-exception surfaces. They should clear only when the underlying state changes.
- If `previous-day missing checkout` exists, show its carry-over correction surface first and keep the correction entry prefilled for the prior date and `clock_out`.
- If the relevant carry-over manual request already exists, replace duplicate-request CTA language with status, rationale, or resubmission CTA language. For example, a `pending` request should move to status visibility, while a `rejected` or `revision_requested` request should move to review-reason and resubmission language.
- If a `leave-work conflict` is active on the employee screen, prefer a conflict-review CTA over immediate correction wording.
- Only show a beacon-range hint on page load when the product can actually detect that condition at that moment. Otherwise, explain the condition after the related attendance attempt fails.

## Exception Surface Rules

- Put active exceptions near the top of the screen before history tables or secondary summaries.
- Treat `/admin/attendance` as a today-first operations surface. Historical review should stay secondary to the same-day exception workflow.
- Surface different causes distinctly. Failed attendance attempts, expected-but-missing check-ins, finalized absences, previous-day missing checkouts, leave-work conflicts, and request-review states must not collapse into one vague warning.
- If an unresolved failed attendance attempt and a same-day expected-but-missing check-in both apply, show separate surfaces for each cause instead of merging them into one card or banner.
- If the same fact appears in multiple surfaces such as a summary card, badge, queue row, table row, or CTA panel, those surfaces must agree on the latest state.
- Action-needed admin summary cards should match the queue rows derived from the same fact set rather than drifting into approximate counts.
- Contextual admin summary cards such as checked-in and on-leave should reuse the same fact set, but they must not be turned into queue-driving pseudo-exceptions just to force 1:1 row parity on the default today surface.
- No-record employees should enter the admin queue only when their current operational state needs attention, not as all-day placeholder rows.
- Do not make hover the primary disclosure mechanism for any important reason, exception, or next action.
- Use `docs/leave-conflict-policy.md` for the severity and meaning of leave-request conflict states; this file owns only how those states are surfaced.

## Exception Priority

- Employee attendance views should prioritize: previous-day missing checkout, unresolved failed attempt, active derived manual request summary, leave-work conflict, same-day expected-but-missing check-in, and then lower-risk history states.
- Admin attendance views should prioritize exceptions over aggregate comfort metrics. The default today queue should group carry-over issues, unresolved failed attempts, request-related exceptions, and then simpler missing or late cases so unresolved operational risk is easier to notice than nominal counts.
- Approved leave must suppress generic missing-check-in warnings for the covered period, but a later actual attendance fact on the same leave-covered day must surface as a leave-work conflict.

## State Messaging Rules

- Every important state should communicate the current state, the reason, and the next action.
- Warnings should explain why the user is seeing them now, not only what label applies.
- Use state-specific surfaces for state-specific follow-up. For example, a failed attendance attempt should offer a correction path, while a pending request should offer status visibility rather than a duplicate submission path.
- On `/admin/attendance/requests`, treat reviewed `rejected` and `revision_requested` items as completed review history/context inside `completed` and `all`, not as a separate employee-waiting queue.
- Default the route to `needs_review`; initial load should not invent extra text or date filters beyond the selected tab.
- In `needs_review`, order actionable rows newest pending request first.
- In `completed`, keep approved or withdrawn results before reviewed non-approved history. Within the approved or withdrawn section, place approved rows before withdrawn rows, sort approved rows by latest review activity descending, and sort withdrawn rows by their original submission timestamp because they have no review timestamp. Within the reviewed non-approved section, sort rows by latest review activity descending.
- In the completed-history section of `all`, keep the same per-section sort keys used by `completed`.
- Give reviewed non-approved history lower visual emphasis than actionable `needs_review` work.
- Do not frame reviewed non-approved admin rows or detail surfaces as "waiting for employee".
- Do not show employee-resubmit CTA copy or guidance inside admin detail for those reviewed-history cases.
- Keep their rationale visible without implying new admin action on the same record.
- Use a queue-first workspace on `/admin/attendance/requests`: the queue is the primary entry surface, and the current queue selection should drive both selected-date context and detail.
- Treat the selected-date context calendar as a supporting surface attached to detail rather than a third equal primary column.
- Keep the same workspace grammar across `needs_review`, `completed`, and `all`, but lower the visual emphasis of `completed` so it reads as review history rather than current action pressure.
- In `all`, section actionable review work ahead of completed review history instead of mixing both into one undifferentiated list.
- In `all`, use the meaning-first section labels `검토 필요` and `완료된 검토 기록` rather than state-machine jargon.
- In `completed`, separate approved or withdrawn results from reviewed non-approved history while keeping both inside the same route-local workspace, place the approved or withdrawn section first, use the internal section labels `승인/철회 완료` and `반려·보완 요청 기록`, and keep the same per-section sort keys defined above.
- `needs_review` rows should show the employee block, request type/subtype, primary target date, current/effective state cue, one-line reason, and at most two secondary chips. Use fact-led rationale copy that reads as current state plus why it matters now, keep the default to one line, and allow at most a two-line clamp.
- Show one primary target date in a row by default, and add a secondary date only when date mismatch is important to understanding the request.
- Prioritize row chips as follows: show active/effective mismatch first when present, then one type-specific chip. Leave rows should prioritize staffing-risk, then company-event, then pending same-date pressure. Manual-attendance rows should prioritize unresolved governing-rationale signal as the second chip.
- Completed-history rows should keep the same basic row skeleton as `needs_review`, but lighter. Show the outcome plus one-line reason without adding a separate history badge.
- Lead with known facts rather than speculative questions when the product already knows what is wrong. Put any follow-up user-judgment question inside the next step only when the product genuinely needs that judgment.
- When `/admin/attendance` shows manual-request context inside a row, keep it as a compact derived projection rather than a full request detail surface. If the projection points at a prior-workday correction, show the target date explicitly.
- Keep manual-attendance and leave review structures distinct inside the same route. Manual detail should lead with correction summary, target workday, and current/effective state before showing attendance-fact comparison. Leave detail should lead with current request, effective leave, and risk summary before showing rationale and chain history.
- Order leave risk summary from effective leave to company-event, staffing-risk, and then pending same-date pressure so the current governing state is read before derived operational pressure.
- Show `governingReviewComment` as a row-level signal when earlier rationale still governs, and keep the full unresolved rationale visible in detail rather than hiding it behind hover-only disclosure.
- Use a compact chain timeline in detail instead of a full audit-log table. In completed-history detail, show the result and rationale before that timeline.
- After an approval, rejection, resubmission, or successful correction, stale warnings, badges, and CTAs must be replaced or cleared promptly.
- Let reviewed `revision_requested` history read as correction-oriented and reviewed `rejected` history read as refusal-oriented without implying an admin-side next step.
- For actionable review detail, keep review actions in a sticky footer rather than in the queue row. Hide those actions entirely on completed-history detail and replace them with quiet read-only outcome copy that owns the admin display of `nextAction = none`.
- After a review action, update the queue row, selected detail state, and calendar annotations immediately. When another actionable item remains in the current view, advance to it automatically.
- Keep selected-date context visible in every queue view, but reduce its visual emphasis in `completed` so historical annotations read as context rather than current pressure.
- Use dim or outlined historical calendar marks for completed-history items rather than the same style used for active review pressure.
- On `/attendance/leave`, the top correction tier should filter candidates to reviewed `rejected` or `revision_requested` leave requests with no active follow-up and `isTopSurfaceSuppressed = false`.
- Treat leave top-surface suppression as a candidate filter only. History must remain the required recovery surface, and the top correction detail or selected-date context may add restore or resubmission entry points without replacing history.
- A later resubmission or later reviewed outcome must be re-evaluated as a new top-correction candidate rather than inheriting an older request record's suppressed state.
- Let issue `#66` own top-candidate filtering and persistence; keep ordering, default expansion, placement, and CTA hierarchy with issue `#41`.
- On `/attendance/leave`, keep one stable top summary tier visible even when correction candidates exist. That tier should stay calm, lead with leave balance, and summarize the current leave state without pulling plain `pending` requests into the top correction surface.
- Place the conditional top correction tier directly below the stable summary tier and above the calendar so reviewed non-approved leave context reads as page-local action guidance before planning context.
- When multiple reviewed non-approved leave requests qualify for top correction surfacing, use a compact list plus one expanded detail instead of stacking multiple full correction cards. Expand the most recently reviewed eligible request by default.
- The expanded top-correction detail should keep prior request summary, current reviewed outcome, latest review reason, next action, primary `resubmit`, and the hide/show-top affordance in one visible block.
- Keep `/attendance/leave` history chain-first rather than record-first. Use one flat row per governing request chain, order rows by latest activity descending, and keep earlier chain steps as secondary timeline or detail instead of separate top-level rows by default.
- `pending` leave rows should lead with `edit` and offer `withdraw` as the secondary action. `approved` leave rows should lead with `change` and offer `cancel`. `rejected` or `revision_requested` rows should lead with `resubmit`, while suppressed reviewed rows may add `show again at top` as a secondary recovery action.
- `withdrawn` rows and fully superseded historical approvals should stay read-only in the history list and should not advertise fresh action CTAs.
- Use the calendar on `/attendance/leave` as leave-only planning and context, not as a shared attendance correction launcher.
- Keep one selected-date context area directly below the calendar. If the selected date already belongs to an existing leave request chain, show that governing context before showing a blank new-request flow.
- Selected-date context on `/attendance/leave` should be governing-context-first: show one primary governing chain card, and keep additional date-related items as compact secondary links rather than a stack of equal cards.
- If the clicked date falls inside a multi-day leave request, show the governing full leave range in the primary context card rather than reducing it to the clicked day alone.
- Keep one inline composer below the calendar as the only primary owner of new request, `resubmit`, `change`, and `cancel` flows on `/attendance/leave`.
- Top-correction and history CTAs should sync the relevant date or range, update selected-date context, and open that inline composer with the right prefilled flow instead of opening separate modal or sheet owners.
- New request flow should seed the inline composer from the selected date, while final date-range and leave-type refinement remain inside the composer itself.
- Treat `pending` edit or withdraw and approved-state `change` or `cancel` as history-led actions. Selected-date context may mirror them as supporting actions, but history should remain the primary discovery surface.
- When approved leave has a pending `change` or `cancel` follow-up, show the current effective approval first and the pending follow-up second so the employee reads the follow-up as requested-but-not-effective-yet.
- If an employee edits or withdraws a pending request before review, the admin row summary should refresh promptly from the latest projection rather than lingering as stale request state.
- Employee leave-conflict warnings should communicate operational sensitivity without exposing peer identities or exact staffing counts.
- Leave approvals that proceed despite a company-event or staffing-cap warning must use explicit confirmation rather than a blind single-click action.

## Shell Ownership Rules

- The shared shell owns navigation, overall page framing, and the ERP tone of the application chrome.
- Attendance and request pages own the active exception state, review state, and next-action messaging that appears inside the shell.
- Do not use the shell to collapse distinct attendance or request states into one vague global status indicator. Keep those states in each page's top-priority content area.

## Employee And Admin Tone

- Employee screens should feel like "protect my day from silent mistakes," not "prove my innocence."
- Admin screens should feel like "help me resolve operational exceptions," not "rank problem employees."
- Event-centered language is preferred over person-centered blame.
- Keep the next action clear, but do not hide the seriousness of a real issue behind overly soft language.

## Relationship To `DESIGN.md`

- `DESIGN.md` should carry tokens, typography choices, and visual guardrails for design agents.
- This file should carry implementation guidance for layout, component usage, density, exception priority, and responsive behavior.
- `docs/ux-writing-guidelines.md` should carry copy tone, CTA wording, and question-versus-fact rules for in-product text.
- `docs/leave-conflict-policy.md` should carry leave-specific conflict severity, staffing-cap policy, and approval-warning defaults.
- If a rule belongs equally to both documents, keep the token-level statement in `DESIGN.md` and the usage rule here.
