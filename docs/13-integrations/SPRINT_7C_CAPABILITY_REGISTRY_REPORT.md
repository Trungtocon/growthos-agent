# Sprint 7C — Capability Registry Report

## Goal

Build a capability graph on top of the Hermes Tool Registry, expose workflow readiness through selectors, and render read-only capability readiness in `/runs/demo-run`.

## Files Added/Changed

| File | Purpose |
|---|---|
| `src/integrations/hermes/capability-registry.ts` | Capability model, builder, workflow readiness engine. |
| `src/runtime-store/capability-registry-store.ts` | Session-persisted capability registry store. |
| `src/domain/selectors.ts` | Capability and workflow readiness selectors; Run Console view model wiring. |
| `src/pages/DemoScreens.tsx` | Read-only Run Inspector capability/readiness rows. |
| `scripts/smoke-capability-registry.mjs` | Capability registry smoke automation. |
| `package.json` | Adds `smoke:capability-registry`. |
| `docs/13-integrations/CAPABILITY_REGISTRY_ARCHITECTURE.md` | Architecture documentation. |

## Capabilities

| Capability | Source |
|---|---|
| Research | Derived from knowledge/search/research tools. |
| Analysis | Derived from analysis/quality/risk-oriented tools when available. |
| Artifact Generation | Derived from artifact/Paperclip/report-capable tools. |
| Approval Handling | Derived from approval/governance/policy-capable tools. |
| Planning | Derived from planning tools. |
| Execution | Derived from runtime/streaming/task-capable tools. |
| Deployment | Derived from deploy/release tools when available. |

## Workflow Readiness Matrix

| Workflow | Required capabilities | Expected mock status |
|---|---|---|
| `demo-run-execution` | research, planning, execution, artifact-generation | Ready |
| `approval-gated-artifact` | planning, execution, artifact-generation, approval-handling | Ready |
| `deployment-readiness` | planning, execution, deployment | Missing deployment |

## Missing Capability Detection

The smoke test verifies that a deployment-only workflow reports `deployment` as missing against the current mock Hermes tool registry.

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run smoke:capability-registry` | pass, 8/8 |
| Existing runtime smoke gates | pass |
| Static asset guardrail | pass |
| Onboarding 01-07 | pass, 7/7 |
| Core bbox gates | pass, 08/20/21/23/30/32/34/37 |

## Decision

PASS.
