# Design System

## Working Agreement

- Use this file for visual identity, tokens, component styling, and design guardrails.
- Keep implementation-oriented layout behavior in `docs/ui-guidelines.md`.
- Keep feature scope in `docs/feature-requirements.md`.
- Keep route, API, and data-model contracts out of this file.
- When the provided attendance Figma frame conflicts with `docs/assets/erp-reference-dashboard.webp`, use the Figma frame as the higher-priority source of truth for shell chrome, spacing, and tokens.

## Overview

A practical ERP interface grounded in the provided attendance Figma frame.
The product should feel calm, operational, and polished: a pale canvas, a precise dark sidebar, a restrained white top utility bar, and white content cards with soft borders and low shadow. Purple is an accent, not the default fill for every control.

## Colors

- **Primary Accent** (#4f46e5): metric panels, focused state, key emphasis, and selected accents
- **Strong Action** (#162847): default high-emphasis buttons and avatar fills
- **Secondary** (#64748b): Supporting UI, secondary text, and descriptions
- **Surface** (#f5f7fa): Main page backgrounds (Light mode)
- **Surface Subtle** (#f8fafc): table hovers, grouped row backgrounds, and secondary fills
- **On-surface** (#1e293b): Primary text on light backgrounds
- **Sidebar Surface** (#2d3e5e): Dark navigation canvas
- **Sidebar Active Surface** (#3d4e6e): Active navigation state
- **Card Surface** (#ffffff): White background for content and dashboard cards
- **Chip/Tag Background** (#f1f5f9): Soft neutral fills for toggles and low-emphasis controls
- **Success Soft / Text** (#ecfdf5 / #047857): Normal attendance and resolved states
- **Warning Soft / Text** (#fff7ed / #ea580c): late, failed-attempt, and cautionary states
- **Danger Soft / Text** (#ffe4e6 / #e11d48): missing records and destructive attention states
- **Info Soft / Text** (#eef2ff / #4f46e5): informational or cross-state conflict emphasis

## Typography

- **Headlines**: Pretendard (or Noto Sans KR) & Inter, semi-bold
- **Body**: Pretendard & Inter, regular, 14–16px
- **Labels**: Pretendard & Inter, medium, 12px

Headlines should read as stable and professional rather than expressive.
Body text should remain compact and highly legible for dense dashboard content.
Labels should support tables, filters, status summaries, and inner-card navigation chips without visual noise.

## Elevation

Use low elevation.
Depth should come from surface contrast, a light `#e2e8f0` border, and a soft `0 1px 2px rgba(15, 23, 42, 0.05)` style shadow instead of large floating panels.

## Components

- **Sidebar Navigation**: 200px dark vertical navigation by default, with a thin desktop collapse rail that keeps a top menu re-open control, simple grouped links, active items on `#3d4e6e`, and no launcher-grid styling.
- **Top Utility Bar**: 56px white bar with compact utility/avatar controls and no mandatory helper sentence on the left.
- **Cards**: 16px radius, white surface, `#e2e8f0` border, low shadow, and generous 20–24px internal padding.
- **Tables**: quiet headers, roomy horizontal padding, soft row hover, and one clear primary status chip per row when the layout would otherwise feel noisy.
- **Buttons**: strong action buttons use `#162847`; secondary actions should prefer outline or soft semantic fills.
- **Inputs**: white fields, 12px radius, `#dbe5f0` border, and no overly dense vertical compression.
- **Tags/Chips**: small rounded pills with semantic soft fills, not saturated solid fills by default.
- **Modals/Sheets**: simple white surfaces, restrained borders, and explicit action hierarchy.

## Do's and Don'ts

- Do use purple as accent and metric emphasis, not as the default fill for every large action.
- Do maintain accessible contrast and visible focus states.
- Do keep the shell proportions stable: 200px expanded sidebar, a thin desktop collapse rail, 56px top bar, and a calm content canvas.
- Don't mix multiple corner-radius systems or inconsistent shadow styles.
- Don't reintroduce generic app-shell chrome that looks like a starter template rather than the Figma frame.
