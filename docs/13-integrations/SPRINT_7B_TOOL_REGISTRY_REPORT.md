# Sprint 7B — Hermes Tool Registry + Capability Mapping Report

## Goal

Replace hardcoded runtime stream tool definitions with a Hermes-discovered tool registry and expose read-only registry details in Run Console.

## Files Added/Changed

| Area | Files |
|---|---|
| Registry domain | `src/integrations/hermes/hermes-tool-registry.ts` |
| Registry persistence | `src/runtime-store/tool-registry-store.ts` |
| Runtime integration | `src/integrations/growthos-runtime/runtime-orchestrator.ts` |
| Selectors/UI | `src/domain/selectors.ts`, `src/pages/DemoScreens.tsx` |
| Smoke | `scripts/smoke-tool-registry.mjs`, `package.json` |
| Docs | `docs/13-integrations/TOOL_REGISTRY_ARCHITECTURE.md`, `docs/13-integrations/SPRINT_7B_TOOL_REGISTRY_REPORT.md` |

## Registry Summary

| Item | Result |
|---|---|
| Registry source | Hermes discovery output |
| Tools | Built from `discovery.tools` |
| Models | Built from `discovery.models` |
| Capabilities | Built from `discovery.capabilities` |
| Compatibility | Tool/model matrix with support reason |
| Persistence | sessionStorage |

## Runtime Integration

Runtime streaming now reads enabled streaming tools from the registry. The stream sequence is still deterministic for smoke reliability, but tool definitions are registry-driven.

## UI

`/runs/demo-run` shows a compact read-only registry summary in the existing Run Inspector panel without changing AppShell or bbox contracts.

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
| `npm run smoke:tool-registry` | pass |
| `npm run audit:static-assets` | pass |
| onboarding 01-07 parity | pass |
| bbox 08/20/21/23/30/32/34/37 | pass |

## Decision

PASS.
