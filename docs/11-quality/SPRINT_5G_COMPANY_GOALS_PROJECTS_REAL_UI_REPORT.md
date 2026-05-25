# Sprint 5G — Company, Goals & Projects Real UI Report

## Goal

Convert Screens 12-19 from scaffold placeholders into Real UI components with structural bbox gates.

## Scope

| Screen | Route | Component |
|---|---|---|
| 12 | `/company/overview` | `CompanyOverviewScreen` |
| 13 | `/company/settings` | `CompanySettingsScreen` |
| 14 | `/goals` | `GoalsDashboardScreen` |
| 15 | `/goals/demo-goal` | `GoalDetailScreen` |
| 16 | `/goals/new` | `CreateGoalScreen` |
| 17 | `/projects` | `ProjectsListScreen` |
| 18 | `/projects/demo-project` | `ProjectDetailScreen` |
| 19 | `/projects/new` | `CreateProjectScreen` |

## Static Asset Guardrail

No Screen 12-19 route renders parity screenshot slices, `sidebar.png`, `topbar.png`, `content.png`, full-screen screenshots, or `backgroundImage` from parity folders.

## Data Model

The screens use selector-driven view models from `src/domain/selectors.ts`:

- `selectCompanyOverviewViewModel`
- `selectCompanySettingsViewModel`
- `selectGoalsDashboardViewModel`
- `selectGoalDetailViewModel`
- `selectCreateGoalViewModel`
- `selectProjectsListViewModel`
- `selectProjectDetailViewModel`
- `selectCreateProjectViewModel`

## Structural Gate

| Screen | Route | Regions passed | Status |
|---|---|---:|---|
| 12 | `/company/overview` | 8/8 | Pass |
| 13 | `/company/settings` | 7/7 | Pass |
| 14 | `/goals` | 8/8 | Pass |
| 15 | `/goals/demo-goal` | 8/8 | Pass |
| 16 | `/goals/new` | 7/7 | Pass |
| 17 | `/projects` | 8/8 | Pass |
| 18 | `/projects/demo-project` | 7/7 | Pass |
| 19 | `/projects/new` | 7/7 | Pass |

## Pixel Diff Reference

| Screen | Route | Pixel diff | Notes |
|---|---|---:|---|
| 12 | `/company/overview` | 7.7707% | Visual polish deferred |
| 13 | `/company/settings` | 5.9535% | Visual polish deferred |
| 14 | `/goals` | 9.0791% | Visual polish deferred |
| 15 | `/goals/demo-goal` | 7.4108% | Visual polish deferred |
| 16 | `/goals/new` | 6.8085% | Visual polish deferred |
| 17 | `/projects` | 11.1671% | Visual polish deferred |
| 18 | `/projects/demo-project` | 9.2961% | Visual polish deferred |
| 19 | `/projects/new` | 7.5966% | Visual polish deferred |

## Verification

| Check | Result |
|---|---|
| `npm run build` | Pass |
| `npm run validate:demo-data` | Pass |
| `npm run smoke:real-ui-flow` | Pass 19/19 |
| bbox 12-19 | Pass |
| pixel reference 12-19 at 30% safety gate | Pass |

## Decision

PASS.

Screens 12-19 are accepted as Real UI Structural PASS / Visual Polish Deferred.

## Next Step

Sprint 5H should convert the workforce support wave: `/agents`, `/agents/new`, `/agents/templates`, `/agents/performance`, `/agents/memory`, `/skills`, and `/tools/permissions`.
