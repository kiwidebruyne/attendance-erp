# App Architecture

## Purpose

This document defines the structural boundaries for the current single Next.js application.
It focuses on routing, layout, rendering boundaries, state placement, and the location of the mock API.

## Application Shape

- The repository contains one Next.js 16 App Router app at the project root.
- Keep the App Router in `app/`. Do not introduce the Pages Router.
- Keep mock REST endpoints under `app/api/**`.
- Keep the current root-level `app/` structure instead of introducing `src/` during the assignment unless a later change creates a clear need.

## Route Map

### Employee Routes

- `/attendance`
- `/attendance/leave`

### Admin Routes

- `/admin/attendance`
- `/admin/attendance/requests`

### API Routes

- `/api/attendance/me`
- `/api/attendance/me/history`
- `/api/attendance/manual`
- `/api/leave/me`
- `/api/leave/request`
- `/api/admin/attendance/today`
- `/api/admin/attendance/list`
- `/api/admin/requests`
- `/api/admin/requests/[id]`

## Recommended Route Organization

- Use route groups to separate employee and admin layout concerns without affecting the URL.
- A recommended layout shape is:

```txt
app/
  (employee)/
    attendance/
      page.tsx
      leave/
        page.tsx
  (admin)/
    admin/
      attendance/
        page.tsx
        requests/
          page.tsx
  api/
    ...
```

- Use private folders such as `_components`, `_lib`, or `_constants` for colocated implementation files that should never become routes.

## Rendering Boundaries

- Prefer Server Components for route-level data reads and initial page composition.
- Use Client Components only for browser-driven interactivity such as filters, tabs, forms, modal state, and optimistic UI.
- Keep shared table formatting, validation helpers, and mock repositories outside route files so they can be reused by both pages and Route Handlers.
- Do not colocate `page.tsx` and `route.ts` in the same route segment.

## State Placement

- Use the URL for shareable screen state such as date ranges, search text, and view tabs when that state affects data queries.
- Use local client state for ephemeral UI concerns such as open modals, draft form values, and inline filter widgets.
- Avoid introducing a global client store by default. Add one only if later issues reveal truly cross-route client state.

## Code Organization

Recommended top-level directories outside `app/`:

- `components/`: reusable UI primitives and shared composed components
- `lib/`: domain logic, formatting helpers, validation, and mock data access
- `types/`: shared TypeScript types and enums when they need a stable import surface
- `public/`: static assets
- `docs/`: project contracts and planning references

Recommended conventions inside `lib/`:

- keep mock seed data separate from request handlers
- centralize enum and label mapping used by both UI and API layers
- use small repository-like helpers for mock queries instead of embedding filtering logic in pages and handlers

## Testing Boundaries

- Use the Vitest `unit` project with the Node environment for pure helpers, schema logic, and other non-DOM utilities.
- Use the Vitest `integration` project with the JSDOM environment for interactive client components and browser-facing UI behavior.
- Do not target `async` Server Components with Vitest in this project. Cover those flows with E2E tests instead.

## Mock API Boundary

- Route Handlers are the public contract for the assignment's REST API.
- UI routes should consume the mock API contract or shared mock repositories, but they should not import handler files directly.
- Keep request and response shapes aligned with `docs/api-spec.md`.
- Keep shared vocabulary aligned with `docs/database-schema.md`.
- Default to the Node.js runtime unless a specific issue documents an Edge runtime need.

## Change Triggers

- Update this document when routes, layouts, rendering boundaries, or code organization rules change.
- Update `docs/api-spec.md` when an API route changes.
- Update `docs/feature-requirements.md` when a structural change affects the user-visible behavior of a screen.
