# Sprint 4C - Command Center Real UI Tuning Report

## Goal

- Continue tuning `/command-center` as real React UI.
- Keep static slice guardrails intact.
- Do not regress onboarding screens 01-07.
- Do not keep changes that increase visual diff.

## Baseline

| Screen | Route | Mode | Baseline diff | Gate <=3% |
|---|---|---|---:|---|
| 08 | /command-center | Real UI Components | 10.5256% | Fail |

## Guardrail

| Check | Result |
|---|---|
| `parity_08/sidebar.png` rendered | No |
| `parity_08/topbar.png` rendered | No |
| `parity_08/content.png` rendered | No |
| `backgroundImage` screenshot route usage | No |

## Tuning Attempts

| Pass | Change tested | Result | Decision |
|---|---|---:|---|
| Health card progress geometry | Moved health metric rows to label/value plus full-width bars | 10.5397% to 10.7124% in prior attempt | Reverted |
| Dashboard header icons | Added DOM Lucide icons to card headers | 10.5510% | Reverted |
| Cost legend columns | Added percent column and exact values | 10.5533% | Reverted |
| Sidebar bottom density | Reduced bottom card vertical padding | 10.5277% | Reverted |
| Content wrapper offset | Nudged main padding to match offset analysis | 10.5754% | Reverted |
| Local Inter font | Loaded `@fontsource/inter` | 10.9727% | Reverted |
| Local Roboto font | Loaded `@fontsource/roboto` | 10.8784% | Reverted |
| Small icon/avatar crops | Used small logo/KPI/avatar assets only, no layout screenshots | 10.6277% | Reverted |
| Font smoothing | Added antialias/geometricPrecision | 10.5256% | Reverted |

## Current Region Diff

| Region | Diff |
|---|---:|
| Main left | 16.0609% |
| Main right | 10.3587% |
| Topbar | 8.2360% |
| KPI band | 7.8894% |
| Sidebar | 7.5215% |

## Findings

- The macro geometry is already close enough that small spacing and icon changes often make parity worse.
- The highest remaining mismatch is not a single global offset.
- `parity:offsets` only showed material movement for topbar, not for main content.
- Main-left mismatch is concentrated in text/icon rendering and detailed chart/list internals rather than a simple card position error.
- The real UI route should remain source-clean until a better measured strategy is selected.

## Recommendation

Sprint 4C should pause code tuning and move to a controlled component-by-component rebuild using DOM snapshots and visual overlays:

1. Instrument DOM bounding boxes for every Command Center card and key child element.
2. Compare those boxes against measured reference coordinates.
3. Rebuild one card at a time behind a route-local flag.
4. Keep only passes that reduce the full-page diff and the target region diff.
5. Do not reintroduce static layout screenshots.

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| onboarding 01-07 parity | Pass |
| screen 08 parity <=3% | Fail, 10.5256% |

## Decision

Sprint 4C status: NEEDS STRATEGY RESET.
