# Sprint 7O - Governance Decision Engine Report

## Goal

Create a unified governance decision engine that evaluates runtime actions across policy, budget, quota, RBAC, approval, and authorization audit gates without replacing the existing engines.

## Files Added

- `src/runtime/governance-decision-engine.ts`
- `src/runtime/governance-decision-store.ts`
- `scripts/smoke-governance-decision.mjs`
- `docs/13-integrations/GOVERNANCE_DECISION_ENGINE_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_7O_GOVERNANCE_DECISION_REPORT.md`

## Files Changed

- `src/integrations/growthos-runtime/runtime-orchestrator.ts`
- `src/domain/selectors.ts`
- `src/pages/Sprint2Screens.tsx`
- `src/pages/DemoScreens.tsx`
- `src/data/screens.ts`
- `package.json`

## Decisions Implemented

| Decision | Status |
|---|---|
| `ALLOW` | implemented |
| `DENY` | implemented |
| `REQUIRE_APPROVAL` | implemented |
| `BLOCKED_BY_POLICY` | implemented |
| `BLOCKED_BY_BUDGET` | implemented |
| `BLOCKED_BY_QUOTA` | implemented |
| `BLOCKED_BY_RBAC` | implemented |

## Gates Implemented

| Gate | Source | Status |
|---|---|---|
| Policy Gate | Plan policy and policy inheritance | implemented |
| Budget Gate | Execution budget governance | implemented |
| Quota Gate | Usage ledger quota evaluation | implemented |
| RBAC Gate | RBAC store authorization decisions | implemented |
| Approval Gate | Plan policy approval-required results | implemented |
| Authorization Audit Gate | Authorization audit summary | implemented |

## Runtime Integration

| Action | Governance Hook |
|---|---|
| `approveRunPlan` | records plan approval decision |
| `startRunFromPlan` | evaluates policy, budget, quota, RBAC, approval, and audit before execution |
| `startStreamingRun` | evaluates run request before creating the streaming run |
| artifact exports | evaluate artifact export before exporting governance-sensitive artifacts |
| deployment governance | evaluates deployment request |
| budget override governance | evaluates budget override request |

## Selectors

- `selectGovernanceDecisionHistory`
- `selectBlockedExecutions`
- `selectGovernanceWarnings`
- `selectGovernanceSummary`
- `selectDecisionReport`
- `selectGateFailures`
- `selectGovernanceDecisionViewModel`

## UI

| Route | Surface |
|---|---|
| `/governance` | Governance decision dashboard |
| `/access` | Compact governance decision status |
| `/policies` | Governance decision summary |
| `/tickets/demo-ticket` | Compact governance status |
| `/runs/demo-run` | Compact governance status |

## Artifacts

- `governance-decision-report.md`
- `governance-violations.json`
- `blocked-executions.json`
- `approval-required-report.md`

## Smoke Coverage

| Check | Result |
|---|---|
| allow decision path | pass |
| deny decision path | pass |
| approval-required path | pass |
| policy violation | pass |
| budget violation | pass |
| quota violation | pass |
| RBAC violation | pass |
| decision selectors | pass |
| artifact export | pass |
| route rendering | pass |

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run audit:static-assets` | pass |
| `npm run smoke:governance-decision` | pass 10/10 |
| Policy/RBAC/audit smoke | pass |
| Runtime smoke suite | pass |
| Onboarding parity 01-07 | pass 7/7 |
| BBox core 08/20/21/23/30/32/34/37 | pass |

## Decision

PASS.
