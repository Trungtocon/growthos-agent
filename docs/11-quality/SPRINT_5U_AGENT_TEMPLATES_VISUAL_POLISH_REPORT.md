# Sprint 5U — Agent Templates Visual Polish Report

## Goal
Polish Screen 25 `/agents/templates` after the Sprint 5T source PNG recalibration while preserving the real UI structural gate.

## Changes
- Added the missing `Template được đề xuất` section heading from the reference PNG.
- Shifted the filter row and gallery down to better align with the source layout.
- Increased the marketplace card/gallery height so the second row reaches the reference crop.
- Reordered and renamed template view-model rows to match the PNG marketplace order.
- Improved the CSS-only robot avatar so cards and the detail drawer resemble the source robot portraits without using parity images.
- Updated only the Screen 25 bbox contract to reflect the refined PNG-aligned content geometry.

## Static Asset Guardrail
- parity_25/sidebar.png rendered: No
- parity_25/topbar.png rendered: No
- parity_25/content.png rendered: No
- backgroundImage rendered: No

## Structural Gate

| Check | Result |
|---|---|
| `npm run audit:bbox:25` | pass 8/8 |

## Pixel Reference

| Screen | Route | Before diff | After diff | Delta |
|---|---|---:|---:|---:|
| 25 | `/agents/templates` | 11.9514% | 11.6725% | -0.2789% |

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run audit:bbox:25` | pass 8/8 |
| `STRICT_MAX_DIFF_PERCENT=15.0 npm run parity:check -- --ids=25` | pass, 11.6725% |

## Decision
PARTIAL

## Next Step
Continue visual polish from the remaining lowest routes. Screen 25 still has visible AppShell/copy/avatar differences from the PNG, but the section structure is now closer and the measured diff improved.
