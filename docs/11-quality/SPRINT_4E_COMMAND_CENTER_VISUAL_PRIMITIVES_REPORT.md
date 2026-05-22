# Sprint 4E - Command Center Visual Primitive Tuning Report

## Goal

Tune `/command-center` visual primitives after Sprint 4D established a passing structural bounding-box gate.

## Baseline

| Check | Result |
|---|---|
| Static sliced assets rendered by `/command-center` | No |
| `npm run build` | Pass |
| `npm run audit:bbox:08` | Pass, 14/14 regions |
| Screen 08 pixel diff baseline | 10.5256% |

## Static Asset Guardrail

| Asset / Pattern | Rendered in active `/command-center` route |
|---|---|
| `parity_08/sidebar.png` | No |
| `parity_08/topbar.png` | No |
| `parity_08/content.png` | No |
| `backgroundImage` screenshot layout | No |
| Full-screen screenshot | No |

## Structural Gate

The structural parity gate remains healthy. The primary containers and card regions are inside contract tolerance:

| Region Group | Status |
|---|---|
| AppShell sidebar/topbar/main | Pass |
| Command header/KPI/main grid | Pass |
| Health/goals/activity/actions/alerts/cost cards | Pass |

## Visual Primitive Tuning Attempts

| Pass | Before diff | After diff | Region impact | Decision |
|---|---:|---:|---|---|
| KPI trend tone polarity | 10.5256% | 10.5257% | KPI band slightly worse | Reverted |
| Health metric rows as label/value + full-width bars | 10.5256% | 10.6916% | Main-left worsened from 16.0609% to 16.6414% | Reverted |
| Topbar user avatar crop | 10.5256% | 10.5460% | Topbar worsened | Reverted |
| KPI icon override with closer Lucide icons | 10.5256% | 10.5339% | KPI band worsened from 7.8894% to 7.9593% | Reverted |
| Dashboard card header icons | 10.5256% | 10.5447% | Main-left/right slightly worse | Reverted |

## Current Region Diff

| Region | Diff |
|---|---:|
| Main left | 16.0609% |
| Main right | 10.3587% |
| Topbar | 8.2360% |
| KPI band | 7.8894% |
| Sidebar | 7.5215% |
| Page heading | 3.9073% |

## Finding

Sprint 4E confirms the blocker is no longer macro layout. DOM bounding boxes match the contract, but pixel diff is dominated by visual primitive fidelity:

- Reference icons and agent avatars appear to be custom raster/icon artwork, while the real UI uses generic Lucide/CSS approximations.
- Text rendering, font weight, and antialiasing differ enough to keep region diff high.
- Donut/progress/list primitives are structurally close, but exact stroke geometry and icon artwork do not match the PNG source.
- Small isolated DOM changes can visually look closer but still increase pixel mismatch because they move text or change antialiasing distribution.

## Decision

Sprint 4E is **PARTIAL**:

- Structural gate remains pass.
- Static asset guardrail remains pass.
- No failed tuning code was kept.
- Pixel diff remains at 10.5256%, so this is not a visual parity pass.

## Next Step

Do not continue random pixel tuning. Sprint 4F should choose one of two explicit strategies:

1. **Real UI acceptance strategy:** keep DOM primitives, define a separate real-UI threshold, and stop comparing custom icon/avatar artwork at a 1% screenshot gate.
2. **Approved small-asset strategy:** allow only non-layout micro assets such as logo, avatar, and icon glyphs from a curated asset folder, while keeping cards, tables, charts, and layout as real DOM/SVG.

Until one of these is chosen, `/command-center` should remain a real UI route with structural parity pass but pixel parity unresolved.
