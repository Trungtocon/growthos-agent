# Sprint 8K — Learning Memory & Recommendation Engine Report

## Goal

Add a learning memory layer that converts verified improvement outcomes into reusable recommendations for future runs, agents, workflows, prompts, tool choices, cost controls, approval gates, and governance policy updates.

## Files Added

| File | Purpose |
|---|---|
| `src/runtime/learning-memory.ts` | Learning memory domain models |
| `src/runtime/recommendation-engine.ts` | Recommendation mapping and confidence logic |
| `src/runtime/learning-memory-store.ts` | Persistence, duplicate prevention, exports |
| `scripts/smoke-learning-memory.mjs` | 12-step smoke automation |
| `docs/13-integrations/LEARNING_MEMORY_ARCHITECTURE.md` | Architecture document |

## Files Modified

| File | Change |
|---|---|
| `src/domain/selectors.ts` | Added learning signal/recommendation selectors |
| `src/pages/EvaluationPage.tsx` | Added full learning memory panel and compact widget |
| `src/pages/DemoScreens.tsx` | Added compact widgets for run and agent routes |
| `src/pages/ExecutionTimelinePage.tsx` | Added compact recommendation widget |
| `src/pages/ExecutionGraphPage.tsx` | Added compact recommendation widget |
| `src/pages/Sprint2Screens.tsx` | Added compact recommendation widget for artifacts |
| `package.json` | Added `smoke:learning-memory` |

## Signal Types

- `improved_outcome`
- `regressed_outcome`
- `unchanged_outcome`
- `prompt_improvement`
- `tool_selection`
- `cost_optimization`
- `governance_policy`
- `approval_process`
- `replay_integrity`
- `workflow_design`

## Recommendation Types

- `use_tool`
- `avoid_tool`
- `adjust_prompt`
- `require_approval`
- `reduce_cost`
- `change_workflow`
- `add_governance_rule`
- `improve_artifact_quality`
- `rerun_with_constraints`

## Rules Implemented

| Rule | Status |
|---|---|
| Improved outcomes increase confidence | Implemented |
| Regressed outcomes create avoid/change recommendations | Implemented |
| Inconclusive outcomes recommend more evidence | Implemented |
| Repeated positive signals increase confidence | Implemented |
| High-cost dimensions trigger cost optimization | Implemented |
| Governance regressions trigger approval/policy recommendations | Implemented |
| Artifact quality regressions trigger artifact quality recommendations | Implemented |

## Artifact Exports

| Export | Status |
|---|---|
| `learning-memory.json` | Registered |
| `recommendations.json` | Registered |
| `recommendation-summary.md` | Registered |
| `recommendation-evidence.md` | Registered |
| `learning-signal-report.json` | Registered |

## Smoke

| Check | Result |
|---|---|
| `npm run smoke:learning-memory` | Pass 12/12 |
| `npm run build` | Pass |
| `npm run validate:demo-data` | Pass |
| `npm run audit:static-assets` | Pass |
| `npm run smoke:improvement-outcome` | Pass 12/12 |
| `npm run smoke:action-plan-execution` | Pass 12/12 |
| `npm run smoke:feedback-action-planner` | Pass 13/13 |
| `npm run smoke:run-evaluation` | Pass 13/13 |
| `npm run smoke:evaluation-feedback` | Pass 12/12 |
| `npm run smoke:execution-timeline` | Pass 10/10 |
| `npm run smoke:execution-replay-control` | Pass 13/13 |
| `npm run smoke:artifact-registry` | Pass 10/10 |
| `npm run smoke:agent-execution-graph` | Pass 12/12 |
| `npm run smoke:real-ui-flow` | Pass 48/48 |
| `npm run smoke:interactions` | Pass 7/7 |
| `npm run smoke:workflow-actions` | Pass 5/5 |
| `npm run smoke:runtime-integration` | Pass 4/4 |
| `npm run smoke:runtime-persistence` | Pass 4/4 |
| onboarding parity 01-07 | Pass 7/7 |
| bbox 35 | Pass 8/8 |
| core bbox 08/20/21/23/30/32/34/37 | Pass |

## Decision

PASS.
