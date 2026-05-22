# Parity Locked Screens

These screens have passed the strict visual parity gate and are frozen for future sprints.

| Screen | Route | Component | Diff | Status | Protected Assets |
|---|---|---|---:|---|---|
| 01 | `/login` | `LoginOnboardingParityPage` | 0% | Frozen | `public/stitch_ui/parity_01/*` |
| 02 | `/register` | `RegisterOnboardingParityPage` | 0% | Frozen | `public/stitch_ui/parity_02/*` |
| 03 | `/onboarding/company` | `CompanyOnboardingParityPage` | 0.3523% | Frozen | `public/stitch_ui/parity_03/*` |
| 04 | `/onboarding/use-case` | `UseCaseOnboardingParityPage` | 0% | Frozen | `public/stitch_ui/parity_04/*` |
| 05 | `/onboarding/ai-team` | `AiTeamOnboardingParityPage` | 0% | Frozen | `public/stitch_ui/parity_05/*` |
| 06 | `/onboarding/hermes` | `HermesOnboardingParityPage` | 0.0148% | Frozen | `public/stitch_ui/parity_06/*` |
| 07 | `/onboarding/complete` | `CompleteOnboardingParityPage` | 0% | Frozen | `public/stitch_ui/parity_07/*` |
| 08 | `/command-center` | `CommandCenter` / `AppShell` | 10.5256% | Real UI Structural PASS / Visual Polish Deferred | No static `parity_08` layout assets rendered |
| 20 | `/workforce` | `WorkforceOverviewRealPage` | 9.4318% | Real UI Structural PASS / Visual Polish Deferred | No static `parity_20` layout assets rendered |
| 21 | `/org-chart` | `OrgChartRealPage` | 11.4165% | Real UI Structural PASS / Visual Polish Deferred | No static `parity_21` layout assets rendered |
| 23 | `/agents/demo-agent` | `AgentDetailRealPage` | 8.0451% | Real UI Structural PASS / Visual Polish Deferred | No static `parity_23` layout assets rendered |
| 30 | `/tickets` | `TicketsBoardRealPage` | 10.6961% | Real UI Structural PASS / Visual Polish Deferred | No static `parity_30` layout assets rendered |
| 32 | `/tickets/demo-ticket` | `TicketDetailRealPage` | 7.7372% | Real UI Structural PASS / Visual Polish Deferred | No static `parity_32` layout assets rendered |
| 34 | `/runs/demo-run` | `RunConsoleRealPage` | 12.5042% | Real UI Structural PASS / Visual Polish Deferred | No static `parity_34` layout assets rendered |
| 37 | `/approvals` | `ApprovalCenterRealPage` | 8.6397% | Real UI Structural PASS / Visual Polish Deferred | No static `parity_37` layout assets rendered |

## Real UI Demo v1 Lock

| Screen | Route | Mode | Component | Static Guardrail | Structural Gate | Pixel Diff | Status |
|---|---|---|---|---|---|---:|---|
| 08 | `/command-center` | Real UI | `CommandCenter + AppShell` | Pass | Pass 14/14 | 10.5256% | Real UI Structural PASS / Visual Polish Deferred |
| 20 | `/workforce` | Real UI | `WorkforceOverviewRealPage + AppShell` | Pass | Pass 14/14 | 9.4318% | Real UI Structural PASS / Visual Polish Deferred |
| 21 | `/org-chart` | Real UI | `OrgChartRealPage + AppShell` | Pass | Pass 10/10 | 11.4165% | Real UI Structural PASS / Visual Polish Deferred |
| 23 | `/agents/demo-agent` | Real UI | `AgentDetailRealPage + AppShell` | Pass | Pass 18/18 | 8.0451% | Real UI Structural PASS / Visual Polish Deferred |
| 30 | `/tickets` | Real UI | `TicketsBoardRealPage + AppShell` | Pass | Pass 12/12 | 10.6961% | Real UI Structural PASS / Visual Polish Deferred |
| 32 | `/tickets/demo-ticket` | Real UI | `TicketDetailRealPage + AppShell` | Pass | Pass 15/15 | 7.7372% | Real UI Structural PASS / Visual Polish Deferred |
| 34 | `/runs/demo-run` | Real UI | `RunConsoleRealPage + AppShell` | Pass | Pass 16/16 | 12.5042% | Real UI Structural PASS / Visual Polish Deferred |
| 37 | `/approvals` | Real UI | `ApprovalCenterRealPage + AppShell` | Pass | Pass 13/13 | 8.6397% | Real UI Structural PASS / Visual Polish Deferred |

## Rules

- Do not modify frozen screens unless there is a direct request to do so.
- Future sprints must run regression parity for screens 01-08 before merge.
- If frozen-screen regression fails, stop the sprint and restore onboarding before continuing.
- Do not modify the protected assets listed above during unrelated work.
- Onboarding screens currently prioritize visual parity through static-first reconstruction.
- Interaction overlay and component refactor will be handled in a separate sprint after all 55 screens pass visual parity.
- Screen 08 is the first frozen AppShell baseline.
- Do not modify Screen 08 unless there is a direct request to do so.
- Screen 08 is locked as Real UI Structural PASS, not static screenshot parity.
- Do not revert Screen 08 to static slices to chase pixel diff.
- Screen 08 pixel diff <=3% is not a blocker for following real UI conversion sprints.
- Future AppShell screens must regression test Screen 08 before merge.
- If Screen 08 regression fails, stop the sprint and restore the AppShell baseline before continuing.
- Screen 20 is the first frozen AI Workforce baseline.
- Do not modify Screen 20 unless there is a direct request to do so.
- Screen 20 is locked as Real UI Structural PASS using the same structural gate approach.
- Future AppShell screens should use structural bbox gates before pixel tuning.
- Screen 21 is the real UI AI Workforce Org Chart baseline.
- Do not modify Screen 21 unless there is a direct request to do so.
- Screen 21 is locked as Real UI Structural PASS using the shared structural bbox gate.
- Do not revert Screen 21 to static slices to chase pixel diff.
- Screen 21 pixel diff is a polish metric, not the primary real UI gate.
- Screen 21 active real component is `OrgChartRealPage + AppShell`; static guardrail Pass; structural gate Pass 10/10; pixel diff 11.4165%.
- Future AI Workforce screens must regression test Screen 20 and Screen 21 before merge.
- If Screen 20 or Screen 21 regression fails, stop the sprint and restore the AI Workforce baseline before continuing.
- Screen 23 is the real UI Agent Detail baseline.
- Do not modify Screen 23 unless there is a direct request to do so.
- Screen 23 is locked as Real UI Structural PASS using the shared structural bbox gate.
- Do not revert Screen 23 to static slices to chase pixel diff.
- Screen 23 pixel diff is a polish metric, not the primary real UI gate.
- Screen 23 active real component is `AgentDetailRealPage + AppShell`; static guardrail Pass; structural gate Pass 18/18; pixel diff 8.0451%.
- Future Work Execution screens must regression test Screen 08, Screen 20, Screen 21, and Screen 23 before merge.
- If any frozen baseline fails, stop the sprint and restore it before continuing.
- Screen 30 is the frozen Work Execution board baseline.
- Do not modify Screen 30 unless there is a direct request to do so.
- Screen 30 is locked as Real UI Structural PASS using the shared structural bbox gate.
- Do not revert Screen 30 to static slices to chase pixel diff.
- Screen 30 pixel diff is a polish metric, not the primary real UI gate.
- Future Work Execution screens must regression test Screen 30 before merge.
- If Screen 30 regression fails, stop the sprint and restore the Work Execution baseline before continuing.
- Screen 32 is the frozen Ticket Detail baseline.
- Do not modify Screen 32 unless there is a direct request to do so.
- Screen 32 is locked as Real UI Structural PASS using the shared structural bbox gate.
- Do not revert Screen 32 to static slices to chase pixel diff.
- Screen 32 pixel diff is a polish metric, not the primary real UI gate.
- Screen 32 active real component is `TicketDetailRealPage + AppShell`; static guardrail Pass; structural gate Pass 15/15; pixel diff 7.7372%.
- Future Run/Execution screens must regression test Screen 30 and Screen 32 before merge.
- If Screen 30 or Screen 32 regression fails, stop the sprint and restore the Work Execution baseline before continuing.
- Screen 34 is the frozen Run Console baseline.
- Do not modify Screen 34 unless there is a direct request to do so.
- Screen 34 is locked as Real UI Structural PASS using the shared structural bbox gate.
- Do not revert Screen 34 to static slices to chase pixel diff.
- Screen 34 pixel diff is a polish metric, not the primary real UI gate.
- Screen 34 active real component is `RunConsoleRealPage + AppShell`; static guardrail Pass; structural gate Pass 16/16; pixel diff 12.5042%.
- Screen 37 is the frozen Approval Center baseline.
- Do not modify Screen 37 unless there is a direct request to do so.
- Screen 37 is locked as Real UI Structural PASS using the shared structural bbox gate.
- Do not revert Screen 37 to static slices to chase pixel diff.
- Screen 37 pixel diff is a polish metric, not the primary real UI gate.
- Screen 37 active real component is `ApprovalCenterRealPage + AppShell`; static guardrail Pass; structural gate Pass 13/13; pixel diff 8.6397%.
- Do not return any real UI locked route to static slices.
- Structural bbox gate is the primary acceptance gate for real UI conversion; pixel diff is a visual polish metric.
- Real UI Demo v1 routes are locked at structural parity: 08, 20, 21, 23, 30, 32, 34, and 37.
- Pixel diff remains a visual polish metric and must not be used as the primary gate for Real UI Demo v1 acceptance.
