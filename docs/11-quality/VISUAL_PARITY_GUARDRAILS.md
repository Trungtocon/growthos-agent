# Visual Parity Guardrails — 1:1 Implementation Rules

## Mission

The 55 PNG files inside `public/stitch_ui/` are the visual source of truth. Frontend implementation is considered complete only when each route visually matches its corresponding PNG with a reproducible evidence pack.

## Non-negotiable rules

1. **Do not redesign.** Do not improve, reinterpret, simplify, or restyle the screens unless a new PNG replaces the current source of truth.
2. **One route = one PNG.** The mapping is defined in `docs/05-ui-ux/screen-manifest.csv`.
3. **Exact file naming matters.** Use `npm run normalize:stitch` after copying the PNG files into `public/stitch_ui/`.
4. **Shared AppShell first.** Screens 08–55 must use one shared AppShell. Fix the shell once; do not create per-screen sidebar/topbar variants.
5. **Auth/onboarding separate.** Screens 01–07 must not use the full AppShell.
6. **No backend dependency for visual parity.** Use stable mock data matching the screenshots.
7. **No empty placeholders on implemented screens.** A screen cannot be marked complete while it still shows scaffold text such as “Implementation Target” or “Design Reference”.
8. **No functional drift.** Buttons may be mocked, but labels, states, badges, panels, charts, cards, and table structures must match the PNG.
9. **No hidden overflow mismatch.** Desktop viewport must match the PNG dimensions. If the reference PNG is 1440×1024, test at 1440×1024.
10. **No acceptance without evidence.** Every completed screen must include screenshot evidence and a visual diff report.

## 1:1 acceptance levels

Because browsers render fonts and antialiasing slightly differently across machines, “1:1” is enforced through three gates:

| Gate | Requirement | Result |
|---|---|---|
| Structural parity | Same route, same shell, same sections, same relative layout, same visible content | Required |
| Visual parity | Pixel diff must be within threshold set by `STRICT_MAX_DIFF_PERCENT` | Required |
| Human review | Manual review confirms no obvious spacing, color, hierarchy, sidebar, or content mismatch | Required |

Recommended thresholds:

```bash
# Sprint development gate
STRICT_MAX_DIFF_PERCENT=2.0 npm run parity:check

# Demo-ready gate
STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check

# Final strict gate
STRICT_MAX_DIFF_PERCENT=0.5 npm run parity:check
```

A screen should not be called “done” until it passes the final strict gate or the remaining difference is explicitly documented as font antialiasing only.

## Required workflow for every screen

For each screen Codex implements:

1. Open the target PNG in `public/stitch_ui/`.
2. Identify global shell structure, grid, typography, spacing, colors, cards, badges, charts, forms, table columns, and empty states.
3. Implement reusable components, not one-off HTML copied 55 times.
4. Run:

```bash
npm run build
npm run parity:check -- --ids=<screen_id>
```

5. Inspect generated files in:

```text
parity-reports/<screen_id>_<screen_slug>/
├── actual.png
├── diff.png
└── report.json
```

6. Fix until the diff is acceptable.
7. Provide the evidence pack summary:
   - route implemented
   - reference PNG used
   - viewport size
   - mismatch percent
   - remaining known differences
   - files changed

## Implementation priorities

Implement in this order to prevent UI drift:

1. Design tokens and global styles
2. AppShell for screens 08–55
3. Onboarding/Auth shell for screens 01–07
4. Reusable primitives: Card, Button, Badge, Tabs, Table, KPI, Drawer, Stepper, Progress, Timeline
5. 8 demo screens:
   - 08 Executive Command Center
   - 20 AI Workforce Overview
   - 21 Org Chart View
   - 23 Agent Detail
   - 30 Tickets Board
   - 32 Ticket Detail
   - 34 Run Console
   - 37 Approval Center
6. Remaining screens by wave

## Common visual mistakes Codex must avoid

- Recreating sidebar/topbar differently per screen
- Adding dark mode when PNG is light
- Using generic placeholder text instead of screenshot-specific labels
- Using random icons that change visual density
- Changing chart/card proportions
- Using inconsistent border radius
- Making cards too tall or too compressed
- Ignoring table column density
- Ignoring right-side panels and drawers
- Skipping status/risk/cost badges
- Using English when screenshot copy is Vietnamese
- Creating route but leaving scaffold page

## Final definition of done

A screen is complete only when:

- It exists at the route in `screen-manifest.csv`.
- It renders without console errors.
- It uses the correct shell type.
- It visually matches the PNG at the same viewport size.
- It passes `npm run build`.
- It passes `npm run parity:check -- --ids=<id>` at the agreed threshold.
- Its evidence pack is generated in `parity-reports/`.
