# Design System

## Working Agreement
- Use this file for visual identity, tokens, component styling, and design guardrails.
- Keep implementation-oriented layout behavior in `docs/ui-guidelines.md`.
- Keep feature scope in `docs/feature-requirements.md`.
- Keep route, API, and data-model contracts out of this file.
- Refine this file when ERP reference images or Stitch-generated updates become available.

## Overview
A practical, professional ERP interface for comprehensive enterprise management (HR, Sales, Accounting, etc.).
The product features a clean, light-mode main content area paired with a high-contrast dark sidebar to anchor the navigation. It should feel operational, structured, and information-dense without becoming visually heavy.

## Colors
- **Primary** (#5c59e8): CTAs, active states, key interactive elements
- **Secondary** (#64748b): Supporting UI, secondary text, and descriptions
- **Surface** (#f8f9fa): Main page backgrounds (Light mode)
- **On-surface** (#1e293b): Primary text on light backgrounds
- **Sidebar Surface** (#2e3856): Dark navy background for the left global navigation
- **Card Surface** (#ffffff): White background for content and dashboard cards
- **Chip/Tag Background** (#f1f5f9): Soft gray backgrounds for sub-menu tags within cards
- **Error** (#ffb4ab): Validation errors, destructive actions
*(Note: Cards use various semantic colors for icons like light blue, teal, purple, and orange to distinguish departments).*

## Typography
- **Headlines**: Pretendard (or Noto Sans KR) & Inter, semi-bold
- **Body**: Pretendard & Inter, regular, 14–16px
- **Labels**: Pretendard & Inter, medium, 12px

Headlines should read as stable and professional rather than expressive.
Body text should remain compact and highly legible for dense dashboard content.
Labels should support tables, filters, status summaries, and inner-card navigation chips without visual noise.

## Elevation

Use low elevation.
Depth should come primarily from surface contrast, subtle borders, and restrained shadows instead of large floating panels.

## Components
- **Sidebar Navigation**: Persistent dark vertical navigation with categorized dropdowns and a high-contrast active state.
- **Cards**: Medium radius (approx. 8-12px), low elevation with a very subtle border (`#e2e8f0`), containing a header icon, title, description, and a flex-wrapped list of sub-menu chips.
- **Tables**: compact rows, clear column hierarchy, strong header contrast, and readable hover or selected states
- **Buttons**: primary fill for the main action, outline or soft variants for secondary actions
- **Inputs**: compact spacing, explicit labels, and visible validation states
- **Tags/Chips**: Simple pill or rounded-rect treatment with very light gray backgrounds and dark text, used for quick links inside cards.
- **Modals**: centered confirmation flows with minimal ornament and explicit primary and secondary actions

## Do's and Don'ts
- Do use the primary color sparingly, only for the most important action so dashboards remain calm.
- Do maintain accessible contrast and visible focus states.
- Don't mix multiple corner-radius systems or inconsistent shadow styles.
