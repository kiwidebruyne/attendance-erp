# UI Guidelines

## Purpose

This document is the implementation-level UI authority for the project.
When implementing or modifying any UI component, page, or layout, agents **must**:

1. Read `DESIGN.md` first to load the project's design system - color tokens, typography scale, spacing primitives, and visual guardrails. All UI code must conform to these tokens; never hard-code values that the design system already defines.
2. Run the `web-design-guidelines` skill (`.agents/skills/web-design-guidelines/SKILL.md`) against the affected files before marking the task complete. This ensures every UI change is validated against the [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) for accessibility, usability, and interface quality.
3. Always consider using the shadcn mcp and shadcn skills first when creating components or UI. Follow the mcp and skill's CLI and registry workflow, prefer shadcn components over hand-rolled UI, and only build custom UI after checking the existing shadcn options.

The originating reference image is stored at `docs/assets/erp-reference-dashboard.webp` and is cataloged from `docs/raw-assignment.md`.

## Overall Direction

- Use a professional ERP dashboard feel, not a marketing-site feel.
- Keep the interface clean, practical, and calm.
- Prefer information clarity over animation or decoration.
- Frontend work in the root Next.js application must follow Toss Design Guidelines for UX/UI decisions across web and mobile surfaces.
- If a form has a single critical input, that input must receive focus when the form is shown.
- Dialog UIs must support closing with the `Esc` key.

## Exception Surface Rules

- Put active exceptions near the top of the screen before history tables or secondary summaries.
- Surface different causes distinctly. Failed attendance attempts, expected-but-missing check-ins, finalized absences, previous-day missing checkouts, leave-work conflicts, and request-review states must not collapse into one vague warning.
- If the same fact appears in multiple surfaces such as a summary card, badge, queue row, table row, or CTA panel, those surfaces must agree on the latest state.
- Do not make hover the primary disclosure mechanism for any important reason, exception, or next action.

## Exception Priority

- Employee attendance views should prioritize: previous-day missing checkout, unresolved failed attempt, active manual request state, same-day expected-but-missing check-in, and then lower-risk history states.
- Admin attendance views should prioritize exceptions over aggregate comfort metrics. The exception queue should make unresolved operational risk easier to notice than nominal counts.
- Approved leave must suppress generic missing-check-in warnings for the covered period, but a later actual attendance fact on the same leave-covered day must surface as a leave-work conflict.

## State Messaging Rules

- Every important state should communicate the current state, the reason, and the next action.
- Warnings should explain why the user is seeing them now, not only what label applies.
- Use state-specific surfaces for state-specific follow-up. For example, a failed attendance attempt should offer a correction path, while a pending request should offer status visibility rather than a duplicate submission path.
- After an approval, rejection, resubmission, or successful correction, stale warnings, badges, and CTAs must be replaced or cleared promptly.

## Employee And Admin Tone

- Employee screens should feel like "protect my day from silent mistakes," not "prove my innocence."
- Admin screens should feel like "help me resolve operational exceptions," not "rank problem employees."
- Event-centered language is preferred over person-centered blame.
- Keep the next action clear, but do not hide the seriousness of a real issue behind overly soft language.

## Relationship To `DESIGN.md`

- `DESIGN.md` should carry tokens, typography choices, and visual guardrails for design agents.
- This file should carry implementation guidance for layout, component usage, density, exception priority, and responsive behavior.
- If a rule belongs equally to both documents, keep the token-level statement in `DESIGN.md` and the usage rule here.
