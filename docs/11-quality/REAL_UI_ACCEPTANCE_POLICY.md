# Real UI Acceptance Policy

## Purpose

Static screenshot parity is not enough for commercial SaaS. Real UI routes must use React/DOM/SVG components and be measurable by structure.

## Route Types

### Static Parity Route

- Uses images or sliced assets to lock visual parity.
- Only acceptable for prototype or onboarding visual lock work.
- Not considered production-ready.

### Real UI Route

- Does not render screenshot or cropped layout assets.
- AppShell, cards, lists, buttons, and charts are real DOM/SVG/CSS.
- Small logo, icon, or avatar assets are allowed only when they are real product assets, not cropped screenshots of UI layout.
- Required structural regions expose `data-parity-id` for audit.

## Real UI Gate

A real UI screen is accepted when:

1. `npm run build` passes.
2. Static asset guardrail passes.
3. Required `data-parity-id` elements exist.
4. DOM bounding-box structural audit passes.
5. Critical flows and routes render.
6. Pixel diff is recorded but not used as the primary gate.

## Pixel Diff

- Pixel diff is a visual polish metric.
- It is not the primary gate for real UI conversion.
- A screen may be accepted as Real UI Structural PASS even when pixel diff is above 3%, if the bounding-box structural gate passes.

## Current Decision

Screen 08 `/command-center` is accepted as:

**Real UI Structural PASS / Visual Polish Deferred.**
