# Sprint 8F — Run Evaluation & Quality Scoring Report

## Goal

Add a Run Evaluation layer that scores each completed run based on timeline, artifacts, tool calls, approvals, governance, cost, and replay state.

## Files Added

| File | Purpose |
|---|---|
| `src/runtime/run-evaluation.ts` | Evaluation domain types |
| `src/runtime/run-evaluation-store.ts` | Evaluation logic, persistence, exports |
| `src/pages/EvaluationPage.tsx` | `/evaluation` route and compact widget |
| `scripts/smoke-run-evaluation.mjs` | Evaluation smoke automation |
| `docs/13-integrations/RUN_EVALUATION_ARCHITECTURE.md` | Architecture documentation |
| `docs/13-integrations/SPRINT_8F_RUN_EVALUATION_REPORT.md` | Sprint report |

## Files Modified

| File | Change |
|---|---|
| `src/App.tsx` | Added `/evaluation` route |
| `src/domain/selectors.ts` | Added evaluation selectors |
| `src/pages/DemoScreens.tsx` | Added compact widget to run console |
| `src/pages/ExecutionTimelinePage.tsx` | Added compact widget |
| `src/pages/ExecutionGraphPage.tsx` | Added compact widget |
| `src/pages/Sprint2Screens.tsx` | Added compact widget to artifacts route |
| `package.json` | Added `smoke:run-evaluation` |

## Score Dimensions

| Dimension | Status |
|---|---|
| `task_completion` | Implemented |
| `artifact_quality` | Implemented |
| `tool_success` | Implemented |
| `approval_compliance` | Implemented |
| `governance_compliance` | Implemented |
| `cost_efficiency` | Implemented |
| `replay_integrity` | Implemented |
| `overall_score` | Implemented |

## Artifact Exports

| Export | Status |
|---|---|
| `run-evaluation.json` | Registered |
| `run-evaluation-summary.md` | Registered |
| `run-quality-report.md` | Registered |
| `evaluation-issues.json` | Registered |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| `npm run validate:demo-data` | Pass |
| `npm run audit:static-assets` | Pass |
| `npm run smoke:run-evaluation` | Pass 13/13 |
| `npm run smoke:execution-timeline` | Pass 10/10 |
| `npm run smoke:execution-replay-control` | Pass 13/13 |
| `npm run smoke:artifact-registry` | Pass 10/10 |
| `npm run smoke:agent-execution-graph` | Pass 12/12 |
| `npm run smoke:real-ui-flow` | Pass 48/48 |
| `npm run smoke:interactions` | Pass 7/7 |
| `npm run smoke:workflow-actions` | Pass 5/5 |
| `npm run smoke:runtime-integration` | Pass 4/4 |
| `npm run smoke:runtime-persistence` | Pass 4/4 |
| `npm run audit:bbox:35` | Pass 8/8 |
| Core bbox 08/20/21/23/30/32/34/37 | Pass |

## Decision

PASS.
