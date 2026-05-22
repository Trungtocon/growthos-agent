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
| 21 | `/org-chart` | `OrgChartParityPage` | 0% | Frozen | `public/stitch_ui/parity_21/*` |
| 23 | `/agents/demo-agent` | `AgentDetailParityPage` | 0% | Frozen | `public/stitch_ui/parity_23/*` |
| 30 | `/tickets` | `TicketsBoardParityPage` | 0% | Frozen | `public/stitch_ui/parity_30/*` |
| 32 | `/tickets/demo-ticket` | `TicketDetailParityPage` | 0% | Frozen | `public/stitch_ui/parity_32/*` |

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
- Screen 21 is the frozen AI Workforce Org Chart baseline.
- Do not modify Screen 21 unless there is a direct request to do so.
- Future AI Workforce screens must regression test Screen 20 and Screen 21 before merge.
- If Screen 20 or Screen 21 regression fails, stop the sprint and restore the AI Workforce baseline before continuing.
- Screen 23 is the frozen Agent Detail baseline.
- Do not modify Screen 23 unless there is a direct request to do so.
- Future Work Execution screens must regression test Screen 08, Screen 20, Screen 21, and Screen 23 before merge.
- If any frozen baseline fails, stop the sprint and restore it before continuing.
- Screen 30 is the frozen Work Execution board baseline.
- Do not modify Screen 30 unless there is a direct request to do so.
- Future Work Execution screens must regression test Screen 30 before merge.
- If Screen 30 regression fails, stop the sprint and restore the Work Execution baseline before continuing.
- Screen 32 is the frozen Ticket Detail baseline.
- Do not modify Screen 32 unless there is a direct request to do so.
- Future Run/Execution screens must regression test Screen 30 and Screen 32 before merge.
- If Screen 30 or Screen 32 regression fails, stop the sprint and restore the Work Execution baseline before continuing.
