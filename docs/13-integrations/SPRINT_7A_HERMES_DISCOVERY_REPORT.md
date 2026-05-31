# Sprint 7A — Hermes Discovery Layer Report

## Goal

Add a Hermes discovery layer that reports runtime status, capabilities, models, tools, and readiness through the existing adapter/orchestrator/store/selector path.

## Files Added/Changed

| Area | Files |
|---|---|
| Hermes discovery | `src/integrations/hermes/hermes-discovery-types.ts`, `src/integrations/hermes/hermes-discovery-client.ts` |
| Runtime store | `src/runtime-store/hermes-discovery-store.ts` |
| Runtime orchestration | `src/integrations/growthos-runtime/runtime-orchestrator.ts`, `src/integrations/growthos-runtime/runtime-types.ts` |
| Commands/selectors | `src/state/command-actions.ts`, `src/state/event-log.ts`, `src/domain/selectors.ts` |
| UI wiring | `src/pages/DemoScreens.tsx` |
| Smoke | `scripts/smoke-hermes-discovery.mjs`, `package.json` |

## Runtime Mode Behavior

| Scenario | Result |
|---|---|
| `VITE_RUNTIME_MODE=mock` | Discovery returns deterministic online mock Hermes models/tools/capabilities. |
| `VITE_RUNTIME_MODE=sandbox` without credentials | Discovery returns `missing_config`, stores warning, and preserves mock fallback. |
| Sandbox configured but endpoint fails | Discovery returns `offline` or `degraded` with normalized warning details. |

## Routes Wired

| Route | Wiring |
|---|---|
| `/runs/demo-run` | Run Inspector shows Hermes status, model, mode, enabled tools, and refresh action. |
| `/integrations` | Integration Hub includes Hermes Runtime status from selectors. |

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run smoke:real-ui-flow` | pass |
| `npm run smoke:interactions` | pass |
| `npm run smoke:workflow-actions` | pass |
| `npm run smoke:runtime-integration` | pass |
| `npm run smoke:runtime-persistence` | pass |
| `npm run smoke:sandbox-connectors` | pass |
| `npm run smoke:real-run-lifecycle` | pass |
| `npm run smoke:artifact-viewer` | pass |
| `npm run smoke:live-run-streaming` | pass |
| `npm run smoke:tool-runtime` | pass |
| `npm run smoke:hermes-discovery` | pass |
| `npm run audit:static-assets` | pass |
| onboarding 01-07 parity | pass |
| bbox 08/20/21/23/30/32/34/37 | pass |

## Decision

PASS.
