# Sprint 8A — Hermes Sandbox Runtime Report

## Goal

Connect GrowthOS runtime orchestration to an optional real Hermes Sandbox Runtime endpoint without bypassing governance or breaking mock fallback mode.

## Files Added/Changed

| Area | Files |
|---|---|
| Hermes sandbox client | `src/integrations/hermes/hermes-sandbox-client.ts` |
| Hermes config/adapter | `src/integrations/hermes/hermes-config.ts`, `src/integrations/hermes/hermes-adapter.ts` |
| Runtime orchestration | `src/integrations/growthos-runtime/runtime-config.ts`, `src/integrations/growthos-runtime/runtime-orchestrator.ts`, `src/integrations/growthos-runtime/runtime-types.ts` |
| Selectors/UI | `src/domain/selectors.ts`, `src/pages/DemoScreens.tsx` |
| Smoke | `scripts/smoke-hermes-sandbox-runtime.mjs`, `package.json` |
| Docs | `docs/13-integrations/HERMES_SANDBOX_RUNTIME_ARCHITECTURE.md`, this report |

## Runtime Mode Behavior

| Mode | Behavior |
|---|---|
| `mock` | Existing mock Hermes/Paperclip runtime remains default. |
| `sandbox` with missing config | Falls back to mock, marks readiness degraded/warning, does not crash UI. |
| `sandbox` with config | Uses Hermes sandbox adapter/client for health, discovery, start, poll, cancel, and event stream normalization. |

## Governance Preflight

Real sandbox starts call the enterprise governance exit gate before contacting Hermes.

| Condition | Result |
|---|---|
| Blockers present | Hermes is not called; enforcement rejection and audit event are recorded. |
| Approval hold present | Plan execution uses approval hold path and does not call sandbox until approved. |
| Warnings only | Sandbox execution may proceed. |
| Sandbox missing/offline | Mock fallback is allowed with warning/degraded readiness. |

## Adapter Mapping

| Hermes output | GrowthOS output |
|---|---|
| run status | GrowthOS lifecycle via `run-event-mapper` |
| tool calls | Runtime tool call rows |
| artifacts | GrowthOS artifacts with `source: hermes` |
| stream events | `RunStreamEvent` records |

## Smoke Coverage

`npm run smoke:hermes-sandbox-runtime` validates:

- missing env falls back to mock
- invalid health returns degraded
- sandbox health success
- sandbox run start normalized
- sandbox poll normalized
- sandbox cancel normalized
- sandbox tool calls mapped
- sandbox artifacts mapped
- governance blocker prevents sandbox call
- approval hold prevents sandbox call until approved

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run audit:static-assets` | pass |
| `npm run smoke:enterprise-governance-exit` | pass |
| `npm run smoke:governance-enforcement` | pass |
| `npm run smoke:approval-execution` | pass |
| `npm run smoke:hermes-sandbox-runtime` | pass 9/9 |
| Runtime smoke suite | pass |
| Onboarding 01-07 | pass 7/7 |
| BBox core 08/20/21/23/30/32/34/37 | pass |

## Decision

PASS.
