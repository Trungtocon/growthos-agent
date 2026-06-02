# Sprint 8N — Improvement Loop Governance Report

## Goal

Add governance controls, kill switch, rollback planning, and audit exports for autonomous improvement loops.

## Files Added

- `src/runtime/improvement-loop-governance.ts`
- `src/runtime/improvement-loop-governance-store.ts`
- `scripts/smoke-improvement-loop-governance.mjs`
- `docs/13-integrations/IMPROVEMENT_LOOP_GOVERNANCE_ARCHITECTURE.md`
- `docs/13-integrations/SPRINT_8N_IMPROVEMENT_LOOP_GOVERNANCE_REPORT.md`

## Files Changed

- `src/runtime/improvement-loop-store.ts`
- `src/domain/selectors.ts`
- `src/pages/EvaluationPage.tsx`
- `src/pages/DemoScreens.tsx`
- `src/pages/ExecutionTimelinePage.tsx`
- `src/pages/ExecutionGraphPage.tsx`
- `src/pages/Sprint2Screens.tsx`
- `package.json`

## Decision Types

- `ALLOW`
- `PAUSE`
- `REQUIRE_REVIEW`
- `BLOCK`
- `KILL`
- `ROLLBACK_REQUIRED`

## Block Reasons

- `max_attempts_exceeded`
- `confidence_too_low`
- `repeated_failure`
- `cost_limit_exceeded`
- `risk_too_high`
- `governance_blocker`
- `approval_required`
- `regression_detected`
- `manual_kill_switch`
- `missing_evidence`

## Artifact Exports

- `improvement-loop-governance.json`
- `loop-governance-audit.md`
- `loop-kill-switch-report.md`
- `loop-rollback-plan.md`
- `blocked-loops.json`

## Verification

| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run validate:demo-data` | pass |
| `npm run audit:static-assets` | pass |
| `npm run smoke:improvement-loop-governance` | pass 13/13 |
| `npm run smoke:improvement-loop` | pass |
| recommendation/learning/outcome/action/evaluation smoke regression | pass |
| real UI smoke/interactions/workflow | pass |
| bbox 35 + core bbox | pass |
| onboarding parity 01-07 | pass 7/7 |

## Decision

PASS.
