# Sprint 8O - Improvement Loop Queue Runtime Report

## Goal

Add execution queue and scheduler runtime for autonomous improvement loops while preserving governance, kill switch, retries, and route stability.

## Files Added

- `src/runtime/improvement-loop-queue.ts`
- `src/runtime/improvement-loop-queue-store.ts`
- `scripts/smoke-improvement-loop-queue.mjs`
- `docs/13-integrations/IMPROVEMENT_LOOP_QUEUE_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_8O_IMPROVEMENT_LOOP_QUEUE_REPORT.md`

## Files Changed

- `src/domain/selectors.ts`
- `src/pages/EvaluationPage.tsx`
- `src/pages/DemoScreens.tsx`
- `src/pages/ExecutionTimelinePage.tsx`
- `src/pages/ExecutionGraphPage.tsx`
- `src/pages/Sprint2Screens.tsx`
- `package.json`

## Queue Statuses

- `queued`
- `scheduled`
- `waiting_governance`
- `waiting_approval`
- `running`
- `retrying`
- `paused`
- `blocked`
- `completed`
- `failed`
- `cancelled`
- `killed`

## Queue Behavior

- Kill switch blocks queue processing and prevents new starts.
- Governance `ALLOW` can start queued work.
- Governance `REQUIRE_REVIEW` moves work to `waiting_approval`.
- Governance `BLOCK` and rollback requirements move work to `blocked`.
- Max concurrency prevents additional starts while active slots are saturated.
- Retry policy tracks retry count, backoff, and exhaustion.
- Schedule windows prevent early execution.

## Selectors Added

- `selectImprovementLoopQueue`
- `selectQueuedLoops`
- `selectRunningLoopQueueItems`
- `selectBlockedLoopQueueItems`
- `selectWaitingApprovalQueueItems`
- `selectNextEligibleLoop`
- `selectQueueHealthSummary`
- `selectQueueConcurrencyStatus`
- `selectQueueAuditTrail`

## Artifact Exports

- `improvement-loop-queue.json`
- `improvement-loop-queue-summary.md`
- `improvement-loop-queue-audit.md`
- `blocked-queue-items.json`
- `retry-policy-report.md`
- `scheduled-loop-report.md`

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run audit:static-assets` | pass |
| `npm run smoke:improvement-loop-queue` | pass |
| `npm run smoke:improvement-loop-governance` | pass |
| `npm run smoke:improvement-loop` | pass |
| `npm run smoke:recommendation-execution` | pass |
| `npm run smoke:learning-memory` | pass |
| `npm run smoke:improvement-outcome` | pass |
| `npm run smoke:action-plan-execution` | pass |
| `npm run smoke:run-evaluation` | pass |
| `npm run smoke:real-ui-flow` | pass |
| `npm run smoke:interactions` | pass |
| `npm run smoke:workflow-actions` | pass |
| `npm run audit:bbox:35` | pass 8/8 |
| core bbox 08/20/21/23/30/32/34/37 | pass |

## Decision

PASS.
