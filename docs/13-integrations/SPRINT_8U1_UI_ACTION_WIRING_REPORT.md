# Sprint 8U.1 UI Action Wiring Report

## Summary

Sprint 8U.1 audited visible UI actions across the currently registered application routes and added a browser smoke gate that verifies every visible button is one of:

- wired with a React click handler,
- disabled with an explicit reason,
- intentionally marked read-only / coming soon.

The route scan covered 54 routes and ended with `silentButtons=0`.

## Action Policy

| Action state | Required behavior | Implementation |
|---|---|---|
| Wired | Click executes command/store/runtime action | Core route buttons keep `onClick` and smoke exercises state changes |
| Disabled | Button explains why it cannot run | `data-disabled-reason` and `title` added where state can block action |
| Read-only | Static/scaffold action is intentional | `data-action-state="read-only"` and `Coming soon / read-only` tooltip |

## Core Action Inventory

| Route | Button label | Current handler | Expected command/store | Status |
|---|---|---|---|---|
| `/tickets/demo-ticket` | Start Hermes | Ticket detail command button | `startAgentRun` through command/runtime state | wired |
| `/tickets/demo-ticket` | Create plan | Ticket detail command button | `createRunPlanAction` / run-plan store | wired |
| `/tickets/demo-ticket` | Start plan | Ticket detail command button | `startRunFromPlan` through runtime orchestrator | wired |
| `/approvals` | Approve | Approval action button | `approveApproval` command | wired |
| `/approvals` | Reject | Approval action button | `rejectApproval` command | wired |
| `/runs/demo-run` | Refresh Runtime | Run inspector action | runtime discovery refresh command | wired |
| `/evaluation` | Refresh score | `registerRunEvaluationExports(DEMO_RUN_ID)` | run evaluation export/update | wired |
| `/evaluation` | Generate recommendation | `createLearningSignalFromOutcome` -> `generateRecommendationFromSignal` | learning recommendation store | wired |
| `/evaluation` | Enqueue loop | `enqueueImprovementLoop` | improvement loop queue store | wired |
| `/evaluation` | Start | `startQueuedLoop` | queue item lifecycle | wired |
| `/evaluation` | Pause | `pauseQueuedLoop` | queue item lifecycle | wired |
| `/evaluation` | Start | `startImprovementLoopWorker` | worker store | wired |
| `/evaluation` | Stop | `stopImprovementLoopWorker` | worker store | wired |
| `/evaluation` | Enable kill switch | `enableGlobalLoopKillSwitch` | loop governance store | wired |
| `/worker-recovery` | Plan incident | `createRecoveryPlanForIncident` | recovery store, disabled if no incident | wired/disabled |
| `/chaos` | Start stale worker | `createChaosScenario` -> `startChaosRun` | chaos simulation store | wired |
| `/certified-sandbox-run` | Create run | `createCertifiedSandboxRun` | certification store | wired |
| `/certified-sandbox-run` | Export final | `exportCertifiedSandboxRunArtifacts` | artifact registry, disabled until run exists | wired/disabled |
| shared scaffold routes | Xem thêm / More / unlabeled static buttons | no command by design | `data-action-state="read-only"` | read-only |

## Implementation Notes

- Added `ReadOnlyActionGuard` around authenticated `AppShell` routes. It does not change layout (`display: contents`) and only annotates button action state after render.
- Updated shared `Button` to default no-handler buttons to read-only and disabled buttons to a default blocked reason.
- Marked core Sprint 8U.1 actions with stable `data-workflow` attributes for smoke automation.
- Added explicit disabled reasons for worker control, recovery, and certified sandbox export actions.
- No Hermes/Paperclip direct UI calls were introduced.
- No bbox contracts or visual layout rules were changed.

## GitNexus Impact Findings

| Symbol | Risk | Reason |
|---|---|---|
| `Button` | CRITICAL | Shared primitive used by many route flows; metadata-only changes were verified by full smoke and bbox |
| `MoreButton` | CRITICAL | Shared read-only action primitive; tooltip/metadata only |
| `LinkFooter` | HIGH | Shared scaffold footer action; tooltip/metadata only |
| `App` | LOW | Wrapper change only; direct caller is `src/main.tsx` |
| route pages edited | LOW | Scoped action marker/handler changes |

## Smoke Results

| Check | Result | Notes |
|---|---|---|
| Core action smoke | PASS | `12/12` |
| Visible route action scan | PASS | `routes=54`, `silentButtons=0` |
| Disabled reason scan | PASS | `checkedDisabled=8` |
| Start Run | PASS | command log shows `startAgentRun` |
| Create Plan / Start Plan | PASS | plan persisted with `run-plan-ticket-audit-module-3-demo-run-execution` |
| Approve / Reject | PASS | approval command count updated |
| Refresh Runtime | PASS | discovery refreshed |
| Run Evaluation / Recommendation | PASS | evaluation artifacts and recommendation generated |
| Queue / Worker | PASS | queue paused, worker stopped |
| Kill Switch | PASS | enabled state observed |
| Recovery Action | PASS | recovery plan created |
| Chaos Run | PASS | chaos run created |
| Certification Run | PASS | certified run and exports created |

## Verification

| Command | Result |
|---|---|
| `npm run build` | PASS |
| `npm run validate:demo-data` | PASS |
| `npm run audit:static-assets` | PASS |
| `npm run smoke:ui-action-wiring` | PASS |
| `npm run smoke:interactions` | PASS |
| `npm run smoke:workflow-actions` | PASS |
| `npm run smoke:real-ui-flow` | PASS |
| `npm run audit:bbox:08` | PASS `14/14` |
| `npm run audit:bbox:20` | PASS `14/14` |
| `npm run audit:bbox:21` | PASS `10/10` |
| `npm run audit:bbox:23` | PASS `18/18` |
| `npm run audit:bbox:30` | PASS `12/12` |
| `npm run audit:bbox:32` | PASS `15/15` |
| `npm run audit:bbox:34` | PASS `16/16` |
| `npm run audit:bbox:35` | PASS `8/8` |
| `npm run audit:bbox:37` | PASS `13/13` |

## Files Changed

| File | Change |
|---|---|
| `src/App.tsx` | Wrap AppShell routes with `ReadOnlyActionGuard` |
| `src/components/ui/ReadOnlyActionGuard.tsx` | New metadata-only action state guard |
| `src/components/ui/DemoPrimitives.tsx` | Shared Button/MoreButton/LinkFooter action metadata defaults |
| `src/components/ui/MockCards.tsx` | Mark scaffold footer action read-only |
| `src/pages/EvaluationPage.tsx` | Wire refresh score and add workflow markers |
| `src/pages/WorkerControlPage.tsx` | Add disabled reasons |
| `src/pages/WorkerRecoveryPage.tsx` | Add disabled reason and workflow marker |
| `src/pages/ChaosSimulationPage.tsx` | Add workflow marker |
| `src/pages/CertifiedSandboxRunPage.tsx` | Add disabled export reason and workflow marker |
| `scripts/smoke-ui-action-wiring.mjs` | New UI action wiring smoke |
| `package.json` | Add `smoke:ui-action-wiring` script |

## Not Staged

Generated evidence and unrelated pre-existing dirty files remain intentionally unstaged:

- `parity-reports/*`
- `tsconfig.tsbuildinfo`
- `.gitignore`
- `AGENTS.md`
- `.claude/*`
- `CLAUDE.md`
- old visual audit docs/scripts
- pre-existing `src/components/layout/AppShell.tsx` `/artifacts` hunk
- pre-existing `package.json` `parity:local-diff` hunk

## Conclusion

PASS. Visible app actions are now either wired, disabled with a reason, or intentionally read-only, and all required Sprint 8U.1 gates pass.
