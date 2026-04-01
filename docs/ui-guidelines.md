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
- Lead with known facts rather than speculative questions when the product already knows what is wrong. Put any follow-up user-judgment question inside the next step only when the product genuinely needs that judgment.
- When `/admin/attendance` shows manual-request context inside a row, keep it as a compact derived projection rather than a full request detail surface. If the projection points at a prior-workday correction, show the target date explicitly.
- After an approval, rejection, resubmission, or successful correction, stale warnings, badges, and CTAs must be replaced or cleared promptly.
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
