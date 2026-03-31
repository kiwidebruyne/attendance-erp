# AGENTS.md

## Project: attendance-erp

### GOAL

Build the BLE beacon attendance management module for BestSleep's in-house ERP system.
The module automates check-in/check-out verification via BLE beacons while providing reliable fallback workflows (manual attendance requests, leave requests) for both employees and admins.

### Project Overview

This repository is a single-project Next.js 16 App Router application for the BestSleep attendance ERP frontend assignment.

- **Scope**: web UI + mock REST API via Next.js Route Handlers. No real backend or BLE hardware integration.
- **Design alignment**: the UI must match the tone of BestSleep's production ERP (reference screenshot in `docs/assets/erp-reference-dashboard.webp`). Key design keywords: left sidebar nav, card-based layout, purple/blue main color, clean and practical aesthetic.
- **Mock data expectations**: 10–20 realistic employees, ~1 month of attendance records including late arrivals, early departures, and absences.

### App Architecture (4 screens + mock API)

- **Screen 1 — My Attendance** (`app/attendance`): today's status card, weekly/monthly record table, manual check-in request button.
- **Screen 2 — Leave Request** (`app/attendance/leave`): remaining leave balance card, leave application form (annual/half-day AM/PM/hourly), personal request history list.
- **Screen 3 — Team Attendance Dashboard** (`app/admin/attendance`): today's summary card (checked-in / not-yet / late / on-leave counts), team attendance table with search/filter, date-range filter.
- **Screen 4 — Request Management** (`app/admin/attendance/requests`): pending/approved/rejected request table, approve/reject buttons with confirmation modal, rejection reason input.
- **Mock API**: 9 endpoints (5 employee, 4 admin) implemented as Next.js Route Handlers under `app/api/**`. See `docs/api-spec.md` for the full contract.

### Stack

- Next.js 16 App Router (`next.config.ts`)
- React 19
- Tailwind CSS v4 (`postcss.config.mjs`)
- Vitest + React Testing Library (Node unit tests and JSDOM integration tests)
- Lefthook for local Git hooks (`lefthook.yml` is the source of truth)
- ESLint for formatting and linting (`eslint.config.mjs`)
- pnpm for package manager. Use pnpm only.
- shadcn UI plus Radix-based primitives for reusable UI (`components.json`)

### Testing Setup

- `pnpm test` runs all configured Vitest projects once.
- `pnpm test:unit` targets pure helpers and other non-DOM logic in the Node environment.
- `pnpm test:integration` targets interactive client behavior in JSDOM with React Testing Library and shared setup from `vitest.setup.ts`.
- `async` Server Components are not a Vitest target in this repository and should be covered by E2E tests.

### Working Rules

- Treat `AGENTS.md`, `DESIGN.md`, and the files in `docs/` as the source of truth for this project.
- All repository-wide rules must be defined in the appropriate AGENTS.md.
- List files in `docs/` before starting each task, and keep `docs/` up-to-date.
- All repository-wide rules must be defined in the appropriate AGENTS.md.
- Update the relevant source-of-truth documents in the same change whenever routes, API payloads, data vocabulary, or UI rules change.
- Write code, comments, and documentation in English.
- Store repository text files with LF line endings. Reserve CRLF only for Windows-only scripts such as `.bat` and `.cmd`.
- When introducing a workaround, leave sufficient comments that explain why it exists, its scope, and the conditions for removing it.
- Prefer enum types over strings whenever possible.
- If you modified frontend code, run `pnpm test` from the frontend directory before finishing your task
- Commit your work as frequent as possible using git. Do NOT use `--no-verify` flag.
- Run `git commit` only after `git add`; once files are staged, commit without unnecessary delay so staged changes are preserved in history.
- Committing may require workspace binaries (for example, git hooks). If required binaries are missing, run `pnpm install` at the repository root and retry the commit.
- Use the committed `lefthook.yml` as the source of truth for local Git hooks. This repository uses Lefthook and does not use Husky.
- After addressing pull request review comments and pushing updates, mark the corresponding review threads as resolved.
- When no explicit scope is specified and you are currently working within a pull request scope, interpret instructions within the current pull request scope.
- Do not guess; rather search for the web.
- Debug by logging. You should write enough logging code.
- Write sufficient logs for debugging and operational troubleshooting.
- Prefer structured logging libraries for business and system logs. Reuse the repository’s existing logging stack instead of introducing a new one. (Node.js/Next.js: `pino`, Python: `structlog` with `logging`).
- Prefer React Query for frontend server-state management when it is available.
- When accessing `github.com`, use the GitHub CLI (`gh`) instead of browser-based workflows when possible.
- Run GitHub CLI (`gh`) commands outside sandbox restrictions by default; use the required approval flow when escalation is needed.
- When writing shell commands or scripts, treat backticks and command substitution carefully, prefer `$(...)` over legacy backticks, and apply strict escaping for all dynamic values.
- If an operation is blocked by sandbox restrictions, retry it without sandbox restrictions using the required approval flow.

#### This is NOT the Next.js you know

This project uses **Next.js 16.2.1**. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

#### Think Before Working

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

#### Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

#### Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

#### When Creating Or Updating Components OR UI

Always consider using the shadcn mcp and shadcn skills first. Follow the mcp and skill's CLI and registry workflow, prefer shadcn components over hand-rolled UI, and only build custom UI after checking the existing shadcn options.

### Source Of Truth Map

- `AGENTS.md`: repository rules, project overview, and documentation workflow for coding agents.
- `DESIGN.md`: design-agent-readable visual system and component styling rules.
- `docs/AGENTS.md`: documentation catalog, ownership matrix, and update triggers.
- `docs/raw-assignment.md`: raw assignment input and local ERP reference image for documentation use.
- `docs/feature-requirements.md`: user-visible scope, roles, screens, and edge cases.
- `docs/ui-guidelines.md`: implementation-oriented UI guidance that bridges the ERP reference and `DESIGN.md`.
- `docs/app-architecture.md`: route map, layout boundaries, rendering boundaries, and code organization rules.
- `docs/api-spec.md`: mock API contract for request and response shapes.
- `docs/database-schema.md`: conceptual data model and shared enum vocabulary.

### GitHub Issue Style Contract

- Apply this contract to all open/new GitHub issues.
- Use the documents listed above as the source when creating or refining GitHub issues.
- Write issue titles as `<area>: <description>`.
- `<area>` must be one of `attendance`, `leave`, `admin-attendance`, `requests`, `api`, `ui`, `docs`, and `infra`.
- `<description>` should be concise, specific, and start with a lowercase verb phrase when possible.
- Each issue should identify the source documents it depends on, the intended user-visible outcome, acceptance criteria, and explicit out-of-scope items.
- Keep issues implementation-sized. Split separate UI, API, and shared data-model work when they can land independently.
- Do not use bracket-style project prefixes like `[serde-feather]`.
- Use the following Markdown section order for issue bodies:
  - `## Summary`
  - `## Evidence`
  - `## Current Gap`
  - `## Proposed Scope`
  - `## Acceptance Criteria`
  - `## Test Scenarios`
  - `## Out of Scope`
- Optional `## Additional Notes` may be appended only when needed.

### Documentation Sync Rules

- Read the relevant files in `docs/` before making structural, UI, API, or data-model changes.
- Keep each concern defined in one primary document and cross-reference other documents instead of duplicating details.
- Treat `docs/raw-assignment.md` as a reference input, not as the place to define interpreted contracts.
- If visual direction changes, update both `DESIGN.md` and `docs/ui-guidelines.md`.
- If route structure or rendering boundaries change, update `docs/app-architecture.md` and any affected user-facing requirements.
- If payloads, query parameters, or status values change, update `docs/api-spec.md` and `docs/database-schema.md` together.
- Documentation-only phase may mark canonical paths as `planned` before creating path skeletons; create the skeleton in the same change where runtime implementation begins.

### Shell Command Safety Rules

- Use `$(...)` for command substitution; do not use legacy backticks in new scripts.
- Wrap all file paths in quotes by default in shell commands and scripts to prevent whitespace and glob-expansion bugs.
- Apply strict quoting and escaping for all dynamic shell values to prevent command injection and parsing bugs.
- Run GitHub CLI (`gh`) commands outside sandbox restrictions by default; use the required approval flow when escalation is needed.
- If an operation is blocked by sandbox restrictions, retry it without sandbox restrictions using the required approval flow.

### Logging Rules

- Write sufficient logs to support debugging, incident analysis, and operational troubleshooting.
- Prefer structured logging over ad-hoc plain text logs for business and system events.
- Node.js/Next.js code should use `pino` (or a compatible structured logger built on it).
- CLI and operator-facing logs should enable ANSI color by default; allow opt-out with documented flags or environment variables.

### Scripts & Validation

- Available scripts are defined in `package.json`.
- Run `pnpm lint` before committing to catch ESLint errors.
- Run `pnpm format:check` in CI or before pushing to ensure consistent formatting.
- Use `pnpm format` to auto-fix formatting issues locally.
