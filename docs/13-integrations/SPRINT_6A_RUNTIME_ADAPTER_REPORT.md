# Sprint 6A — Runtime Adapter Report

## Goal
Connect Real UI Demo v1 to a clean Paperclip + Hermes integration adapter layer while preserving existing UI, smoke, data, and structural gates.

## Files Added/Changed
| Area | Files |
|---|---|
| Hermes adapter | `src/integrations/hermes/*` |
| Paperclip adapter | `src/integrations/paperclip/*` |
| GrowthOS runtime | `src/integrations/growthos-runtime/*` |
| Workflow state/actions | `src/state/async-actions.ts`, `src/state/command-actions.ts`, `src/state/event-log.ts`, `src/state/workflow-engine.ts` |
| Targeted UI wiring | `src/pages/DemoScreens.tsx` |
| Smoke | `scripts/smoke-runtime-integration.mjs`, `package.json` |
| Docs | `docs/13-integrations/PAPERCLIP_HERMES_INTEGRATION_ARCHITECTURE.md` |

## Runtime Actions
- `startAgentRun(ticketId)`
- `pauseAgentRun(runId)`
- `resumeAgentRun(runId)`
- `retryAgentRun(runId)`
- `cancelAgentRun(runId)`
- `approveRunAction(approvalId)`
- `rejectRunAction(approvalId)`

## Route Wiring
| Route | Runtime behavior |
|---|---|
| `/tickets/demo-ticket` | Starts a simulated Hermes run and shows Paperclip artifact in ticket output. |
| `/runs/demo-run` | Shows run tool calls/artifacts from selector data and routes run controls through runtime adapter. |
| `/approvals` | Approval actions route through runtime adapter and generated approval gates persist across route loads. |

## Verification
| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run smoke:runtime-integration` | pass 4/4 |
| `npm run validate:demo-data` | pass |
| `npm run smoke:real-ui-flow` | pass 48/48 |
| `npm run smoke:interactions` | pass 7/7 |
| `npm run smoke:workflow-actions` | pass 5/5 |
| `npm run audit:static-assets` | pass |

## Decision
PASS

## Notes
- No UI component imports Hermes or Paperclip clients directly.
- Mock mode remains the only active runtime mode in Sprint 6A.
- Remote clients intentionally throw until real backend configuration exists.
- Existing workflow failure injection via `uikigai-demo-fail-next-command` remains supported for rollback smoke tests.
