# Attendance ERP Assignment

This repository contains a single-project Next.js 16 App Router application for the beacon-based attendance management assignment.
The current repository focus is the frontend experience plus the mock REST API required by the assignment.

## Scope

- Employee attendance overview at `/attendance`
- Leave request workflow at `/attendance/leave`
- Admin attendance dashboard at `/admin/attendance`
- Admin request review at `/admin/attendance/requests`
- Mock API endpoints implemented with Next.js Route Handlers under `app/api/**`

## Development

Install dependencies and start the development server:

```bash
pnpm install
pnpm dev
```

`pnpm install` also installs the committed local Git hooks via Lefthook.

Useful commands:

```bash
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:coverage
pnpm lint
pnpm build
```

## Local Git Hooks

This repository uses Lefthook for local Git hooks. It was selected over Husky
to keep the hook setup compatible with future workspace or multi-root splits
without adding per-developer bootstrap steps.

- `pre-commit` formats and lints staged files only, then restages safe fixes.
- `pre-push` runs `pnpm lint`, `pnpm format:check`, `pnpm test`, and
  `pnpm build`.

## Documentation

The repository uses a lightweight documentation model for a single Next.js application.

- `AGENTS.md`: repository rules, project overview, and documentation workflow
- `DESIGN.md`: design-agent-readable visual system document
- `docs/AGENTS.md`: documentation catalog and ownership matrix
- `docs/feature-requirements.md`: screen scope and product-facing requirements
- `docs/ui-guidelines.md`: ERP-aligned UI guidance for implementation
- `docs/app-architecture.md`: route, layout, rendering, and code organization rules
- `docs/api-spec.md`: mock API contract
- `docs/database-schema.md`: conceptual data model and shared vocabulary

## Notes

- This repository intentionally does not use the older monorepo `project-*` or domain-prefixed contract document structure.
- Documents are intentionally lightweight. Detailed execution planning should happen in GitHub issues, not in the contract documents.
- Before changing Next.js behavior, read the matching guide under `node_modules/next/dist/docs/`.
