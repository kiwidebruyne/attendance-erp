# docs/AGENTS.md

## Documentation Catalog

### Purpose

This directory contains the contract documents for the current single-project Next.js application.
These files are meant to guide implementation, issue breakdown, and later maintenance without recreating the older monorepo documentation taxonomy.

### Document Inventory

| File                                 | Primary concern                                      | Update when                                                                                                  |
| ------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `AGENTS.md`                          | human-readable repository overview and setup         | onboarding or project framing changes                                                                        |
| `docs/AGENTS.md`                     | documentation catalog and documentation workflow     | docs inventory, ownership, or documentation policy changes                                                   |
| `DESIGN.md`                          | design-agent visual system                           | design tokens, component style, or visual guardrails change                                                  |
| `docs/raw-assignment.md`             | raw assignment input and original reference material | the provided assignment text or local visual reference asset changes                                         |
| `docs/product-spec-context.md`       | living raw product-spec discussion log               | cross-screen spec discussions, locked defaults, or open product questions change                             |
| `docs/attendance-operating-model.md` | attendance runtime flow and timeline semantics       | attendance fact lifecycle, derived exception timing, or cross-screen attendance synchronization rules change |
| `docs/request-lifecycle-model.md`    | request workflow semantics and follow-up chains      | reviewed-request change rules, follow-up chains, or cross-screen request synchronization rules change        |
| `docs/feature-requirements.md`       | user-visible features, roles, and edge cases         | screen scope or product behavior changes                                                                     |
| `docs/ui-guidelines.md`              | ERP-aligned implementation UI guidance               | layout patterns, table rules, badge rules, or responsive behavior changes                                    |
| `docs/app-architecture.md`           | routing, layout, rendering, and code organization    | route map, layout boundaries, or state-placement rules change                                                |
| `docs/api-spec.md`                   | mock API contract                                    | endpoint, payload, query parameter, or error contract changes                                                |
| `docs/database-schema.md`            | conceptual data model and shared enums               | entities, relationships, or shared vocabulary change                                                         |
| `docs/assets/`                       | documentation image assets                           | a referenced local docs image is added, renamed, or replaced                                                 |

### Ownership Matrix

- `docs/feature-requirements.md` owns what the app must do.
- `docs/ui-guidelines.md` owns how the ERP-like interface should be applied in implementation.
- `DESIGN.md` owns the visual system and design-agent-facing tokens.
- `docs/raw-assignment.md` owns the raw source text and local reference artifact list, but not interpreted product contracts.
- `docs/product-spec-context.md` owns the living raw discussion log, cross-screen decision context, and open interview questions that have not yet been promoted into narrower contract documents.
- `docs/attendance-operating-model.md` owns the attendance fact lifecycle, derived attendance interpretation, and shared attendance timeline semantics.
- `docs/request-lifecycle-model.md` owns reviewed-request lifecycle semantics, follow-up-chain rules, and shared employee/admin request-state synchronization.
- `docs/app-architecture.md` owns where routes, layouts, and state boundaries live.
- `docs/api-spec.md` owns the mock HTTP contract.
- `docs/database-schema.md` owns the conceptual model and enum vocabulary behind that contract.

### Update Triggers

- If a screen or workflow changes, update `docs/feature-requirements.md`.
- If the source assignment or attached reference asset changes, update `docs/raw-assignment.md` and `docs/assets/` as needed.
- If ongoing product-spec discussions establish new cross-screen principles, preserve raw context in `docs/product-spec-context.md` before promoting final decisions into narrower source-of-truth documents.
- If the attendance fact lifecycle, exception timing, or cross-screen attendance synchronization rules change, update `docs/attendance-operating-model.md` and any affected contract documents in the same change set.
- If reviewed-request changes, follow-up-chain semantics, or request-state synchronization rules change, update `docs/request-lifecycle-model.md` and any affected contract documents in the same change set.
- If a visual rule changes, update `DESIGN.md` and `docs/ui-guidelines.md`.
- If a route or rendering boundary changes, update `docs/app-architecture.md`.
- If an API shape changes, update `docs/api-spec.md` and `docs/database-schema.md` together.
- If a terminology change affects multiple documents, update every affected file in one change set.

### Deliberate Non-Goals

- Do not treat `docs/raw-assignment.md` as the place for interpreted requirements or contracts.
- Do not duplicate full payload definitions in multiple documents. Keep one primary source and link to it from related files.
