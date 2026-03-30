# UI Guidelines

## Purpose

This document is the implementation-level UI authority for the project.
When implementing or modifying any UI component, page, or layout, agents **must**:

1. Read `DESIGN.md` first to load the project's design system — color tokens, typography scale, spacing primitives, and visual guardrails. All UI code must conform to these tokens; never hard-code values that the design system already defines.
2. Run the `web-design-guidelines` skill (`.agents/skills/web-design-guidelines/SKILL.md`) against the affected files before marking the task complete. This ensures every UI change is validated against the [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) for accessibility, usability, and interface quality.

The originating reference image is stored at `docs/assets/erp-reference-dashboard.webp` and is cataloged from `docs/raw-assignment.md`.

## Overall Direction

- Use a professional ERP dashboard feel, not a marketing-site feel.
- Keep the interface clean, practical, and calm.
- Prefer information clarity over animation or decoration.
- Frontend work in the root Next.js application must follow Toss Design Guidelines for UX/UI decisions across web and mobile surfaces.
- If a form has a single critical input, that input must receive focus when the form is shown.
- Dialog UIs must support closing with the `Esc` key.

## Relationship To `DESIGN.md`

- `DESIGN.md` should carry tokens, typography choices, and visual guardrails for design agents.
- This file should carry implementation guidance for layout, component usage, density, and responsive behavior.
- If a rule belongs equally to both documents, keep the token-level statement in `DESIGN.md` and the usage rule here.
