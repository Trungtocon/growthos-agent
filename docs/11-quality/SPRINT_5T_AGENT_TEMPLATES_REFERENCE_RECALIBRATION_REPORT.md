# Sprint 5T — Agent Templates Reference Recalibration Report

## Goal
Recalibrate Screen 25 `/agents/templates` from the simplified real UI toward the source PNG marketplace layout.

## Why
Micro-tuning on Screen 25 repeatedly worsened pixel diff because the previous real UI did not include the source design's major sections: filter dropdown, six marketplace cards, and the right template detail drawer.

## Static Asset Guardrail
- parity_25/sidebar.png rendered: No
- parity_25/topbar.png rendered: No
- parity_25/content.png rendered: No
- backgroundImage rendered: No

## Components Changed
- `AgentTemplatesScreen`
- `TemplateMarketCard`
- `TemplateDetailDrawer`
- `TemplateBotAvatar`
- `selectAgentTemplatesViewModel`

## Contract
- `docs/11-quality/screen-25-layout-contract.json`
- Contract source changed from simplified real UI DOM to estimated source PNG structure.
- Shared AppShell regions stayed unchanged.

## Verification
| Check | Result |
|---|---|
| npm run build | pass |
| npm run audit:bbox:25 | pass 8/8 |
| Screen 25 pixel reference | 11.9514% |
| Under 15% safety gate | pass |

## Before / After
| Screen | Route | Before diff | After diff | Notes |
|---|---|---:|---:|---|
| 25 | `/agents/templates` | 10.8573% | 11.9514% | Section coverage improved; pixel polish deferred |

## Decision
PARTIAL

## Next Step
Tune Screen 25 visual primitives after section recalibration: AppShell topbar, card avatar rendering, card typography, right drawer spacing, and sidebar bottom plan card.
