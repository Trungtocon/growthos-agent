# Sprint 8E — Replay Control & Debug Inspector Report

## Goal

Add interactive replay controls and a debug inspector for Execution Timeline without changing AppShell layout, bbox contracts, or static asset policy.

## Files Added

| File | Purpose |
|---|---|
| `src/runtime/execution-replay-control.ts` | Replay control and debug snapshot types |
| `src/runtime/execution-replay-control-store.ts` | Session-persisted replay control actions/selectors |
| `scripts/smoke-execution-replay-control.mjs` | Replay control smoke test |
| `docs/13-integrations/EXECUTION_REPLAY_CONTROL_ARCHITECTURE.md` | Architecture documentation |
| `docs/13-integrations/SPRINT_8E_REPLAY_CONTROL_REPORT.md` | Sprint report |

## Files Modified

| File | Change |
|---|---|
| `src/domain/selectors.ts` | Added replay control selectors |
| `src/pages/ExecutionTimelinePage.tsx` | Added control bar, event inspector, debug JSON panel |
| `src/pages/DemoScreens.tsx` | Added compact replay widget to run console |
| `src/pages/ExecutionGraphPage.tsx` | Added compact replay widget |
| `package.json` | Added `smoke:execution-replay-control` |

## Replay Controls

| Control | Status |
|---|---|
| Play | Implemented |
| Pause | Implemented |
| Step forward | Implemented |
| Step backward | Implemented |
| Jump to frame | Implemented |
| Reset | Implemented |
| Speed 0.5x / 1x / 2x | Implemented |
| Selected event | Implemented |
| Selected frame index | Implemented |
| Session persistence | Implemented |

## Debug Inspector Fields

| Field | Status |
|---|---|
| Current frame | Implemented |
| Event id/type/source/severity | Implemented |
| Run state | Implemented |
| Active step | Implemented |
| Active tool call | Implemented |
| Produced artifacts | Implemented |
| Approval state | Implemented |
| Governance decision | Implemented |
| Usage/cost at selected frame | Implemented |
| Raw normalized debug JSON | Implemented |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| `npm run validate:demo-data` | Pass |
| `npm run audit:static-assets` | Pass |
| `npm run smoke:execution-timeline` | Pass 10/10 |
| `npm run smoke:execution-replay-control` | Pass 13/13 |
| `npm run smoke:real-ui-flow` | Pass 48/48 |
| `npm run smoke:artifact-registry` | Pass 10/10 |
| `npm run smoke:agent-execution-graph` | Pass 12/12 |
| `npm run smoke:interactions` | Pass 7/7 |
| `npm run smoke:workflow-actions` | Pass 5/5 |
| `npm run smoke:runtime-integration` | Pass 4/4 |
| `npm run smoke:runtime-persistence` | Pass 4/4 |
| `npm run audit:bbox:35` | Pass 8/8 |
| Core bbox 08/20/21/23/30/32/34/37 | Pass |

## Decision

PASS.
