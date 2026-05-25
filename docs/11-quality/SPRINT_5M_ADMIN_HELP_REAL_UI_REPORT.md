# Sprint 5M — Admin, Security, Billing, and Help Real UI Report

## Goal

Convert the remaining manifest routes 50-55 from scaffold fallback coverage into route-specific Real UI screens with selector-driven data, structural bbox contracts, smoke coverage, and pixel diff references.

## Routes Converted

| Screen | Route | Component | Reference PNG |
|---|---|---|---|
| 50 | `/secrets` | `SecretsManagerScreen` | `public/stitch_ui/50_Secrets_Manager.png` |
| 51 | `/team` | `TeamMembersScreen` | `public/stitch_ui/51_Team_Members.png` |
| 52 | `/roles-permissions` | `RolesPermissionsScreen` | `public/stitch_ui/52_Role_Permission.png` |
| 53 | `/settings` | `SystemSettingsScreen` | `public/stitch_ui/53_System_Settings.png` |
| 54 | `/billing` | `BillingPlanScreen` | `public/stitch_ui/54_Billing_Plan.png` |
| 55 | `/help` | `HelpTemplateCenterScreen` | `public/stitch_ui/55_Help_Template_Center.png` |

## Static Asset Guardrail

| Route | Static slices rendered | `backgroundImage` rendered | Status |
|---|---|---|---|
| `/secrets` | No | No | Pass |
| `/team` | No | No | Pass |
| `/roles-permissions` | No | No | Pass |
| `/settings` | No | No | Pass |
| `/billing` | No | No | Pass |
| `/help` | No | No | Pass |

Screen 50 uses mock secret metadata only. No real secret values are stored or rendered.

## Components Added

- `SecretsManagerScreen`
- `TeamMembersScreen`
- `RolesPermissionsScreen`
- `SystemSettingsScreen`
- `BillingPlanScreen`
- `HelpTemplateCenterScreen`

## Selectors Added

- `selectSecretsManagerViewModel`
- `selectTeamMembersViewModel`
- `selectRolesPermissionsViewModel`
- `selectSystemSettingsViewModel`
- `selectBillingPlanViewModel`
- `selectHelpTemplateCenterViewModel`

## Structural Gate

| Screen | Route | Regions passed | Status |
|---|---|---:|---|
| 50 | `/secrets` | 8/8 | Pass |
| 51 | `/team` | 8/8 | Pass |
| 52 | `/roles-permissions` | 8/8 | Pass |
| 53 | `/settings` | 8/8 | Pass |
| 54 | `/billing` | 8/8 | Pass |
| 55 | `/help` | 8/8 | Pass |

## Pixel Diff Reference

| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 50 | `/secrets` | 7.2015% | Visual polish deferred |
| 51 | `/team` | 6.8339% | Visual polish deferred |
| 52 | `/roles-permissions` | 7.4028% | Visual polish deferred |
| 53 | `/settings` | 5.8721% | Visual polish deferred |
| 54 | `/billing` | 8.1570% | Visual polish deferred |
| 55 | `/help` | 8.4171% | Visual polish deferred |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| `npm run validate:demo-data` | Pass |
| `npm run smoke:real-ui-flow` | Pass 48/48 |
| `npm run smoke:interactions` | Pass 7/7 |
| `npm run smoke:workflow-actions` | Pass 5/5 |
| Onboarding parity 01-07 at `STRICT_MAX_DIFF_PERCENT=1.0` | Pass 7/7 |
| Static guardrail scan | Pass |
| Full bbox regression 08-55 | Pass |
| `npm run audit:bbox:50` | Pass 8/8 |
| `npm run audit:bbox:51` | Pass 8/8 |
| `npm run audit:bbox:52` | Pass 8/8 |
| `npm run audit:bbox:53` | Pass 8/8 |
| `npm run audit:bbox:54` | Pass 8/8 |
| `npm run audit:bbox:55` | Pass 8/8 |
| `STRICT_MAX_DIFF_PERCENT=30.0 npm run parity:check -- --ids=50,51,52,53,54,55` | Pass |

## Decision

PASS. Screens 50-55 now have route-specific Real UI implementations and structural gates. All 55 manifest screens are covered by either frozen onboarding parity or authenticated Real UI route implementations.

## Next Step

Sprint 5N should run the full app exit gate across onboarding parity, static guardrail, smoke flows, interactions, workflow actions, and bbox gates 08-55.
