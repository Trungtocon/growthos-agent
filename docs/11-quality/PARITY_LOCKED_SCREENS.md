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
| 08 | `/command-center` | `CommandCenter` / `AppShell` branch | 0% | Frozen | `public/stitch_ui/parity_08/*` |
| 20 | `/workforce` | `WorkforceOverviewParityPage` | 0% | Frozen | `public/stitch_ui/parity_20/*` |

## Rules

- Do not modify frozen screens unless there is a direct request to do so.
- Future sprints must run regression parity for screens 01-08 before merge.
- If frozen-screen regression fails, stop the sprint and restore onboarding before continuing.
- Do not modify the protected assets listed above during unrelated work.
- Onboarding screens currently prioritize visual parity through static-first reconstruction.
- Interaction overlay and component refactor will be handled in a separate sprint after all 55 screens pass visual parity.
- Screen 08 is the first frozen AppShell baseline.
- Do not modify Screen 08 unless there is a direct request to do so.
- Future AppShell screens must regression test Screen 08 before merge.
- If Screen 08 regression fails, stop the sprint and restore the AppShell baseline before continuing.
- Screen 20 is the first frozen AI Workforce baseline.
- Do not modify Screen 20 unless there is a direct request to do so.
- Future AI Workforce screens must regression test Screen 20 before merge.
- If Screen 20 regression fails, stop the sprint and restore the AI Workforce baseline before continuing.
