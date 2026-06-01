# Sprint 8M — Autonomous Improvement Loop Scheduler Report

## Goal

Create an autonomous improvement loop scheduler that can create, schedule, run, pause, resume, cancel, retry, complete, and export improvement loops from accepted learning recommendations.

## Files Added

- `src/runtime/improvement-loop.ts`
- `src/runtime/improvement-loop-store.ts`
- `scripts/smoke-improvement-loop.mjs`
- `docs/13-integrations/IMPROVEMENT_LOOP_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_8M_IMPROVEMENT_LOOP_REPORT.md`

## Files Changed

- `src/domain/selectors.ts`
- `src/pages/EvaluationPage.tsx`
- `src/pages/DemoScreens.tsx`
- `src/pages/ExecutionTimelinePage.tsx`
- `src/pages/ExecutionGraphPage.tsx`
- `src/pages/Sprint2Screens.tsx`
- `package.json`

## Loop Statuses

- `draft`
- `scheduled`
- `running`
- `paused`
- `waiting_review`
- `completed`
- `failed`
- `cancelled`

## Trigger Types

- `manual`
- `scheduled`
- `low_score`
- `failed_recommendation`
- `regression_detected`
- `budget_variance`
- `governance_warning`
- `learning_signal`

## Rules Implemented

| Rule | Result |
|---|---|
| Rejected recommendation cannot create loop | Implemented |
| Governance warning blocks loop start | Implemented |
| Low confidence blocks loop start | Implemented |
| High-risk loop enters review-style readiness | Implemented |
| Failed loop lowers confidence | Implemented |
| Completed loop verifies recommendation impact | Implemented |
| Completed loop creates loop outcome | Implemented |
| Exports register through Artifact Registry | Implemented |

## UI Wiring

| Route | Wiring |
|---|---|
| `/evaluation` | Full improvement loop panel |
| `/runs/demo-run` | Compact widget |
| `/execution-timeline` | Compact widget |
| `/execution-graph` | Compact widget |
| `/artifacts` | Compact widget |
| `/agents/demo-agent` | Compact widget |

## Smoke

| Check | Result |
|---|---|
| create loop from accepted recommendation | pass |
| reject loop from rejected recommendation | pass |
| schedule/start/pause/resume/cancel | pass |
| retry failed run | pass |
| complete run with evidence | pass |
| confidence update behavior | pass |
| artifact exports | pass |
| reload persistence | pass |

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run audit:static-assets` | pass |
| `npm run smoke:improvement-loop` | pass 15/15 |
| runtime and evaluation smoke suite | pass |
| `npm run smoke:real-ui-flow` | pass 48/48 |
| `npm run smoke:interactions` | pass 7/7 |
| `npm run smoke:workflow-actions` | pass 5/5 |
| `npm run audit:bbox:35` | pass 8/8 |
| core bbox 08/20/21/23/30/32/34/37 | pass |
| onboarding parity 01-07 | pass 7/7 |

## Decision

PASS.
