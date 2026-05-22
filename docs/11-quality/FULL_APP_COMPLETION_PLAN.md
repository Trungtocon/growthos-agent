# Full Application Completion Plan

## Planning Basis

This roadmap is derived from the 2026-05-23 full app re-audit:

- 55 manifest screens exist.
- 7 onboarding/auth screens are frozen static parity screens.
- 8 Demo v1 routes are Real UI structural pass screens.
- 3 utility command-center routes have bespoke Sprint 2 UI but no current structural gate.
- 37 manifest screens remain generic scaffold placeholders.

## Phase 1 - Stabilization

Preserve the current quality baseline before widening implementation:

- Keep build, onboarding parity, demo data validation, bbox gates, smoke flow, and interaction smoke green.
- Keep the static asset guardrail clean for Real UI routes.
- Keep full coverage reporting explicit so route existence is not mistaken for design completion.
- Keep parity lock docs and acceptance policy aligned with the route map.

## Phase 2 - Core Workflow Foundation

Add a workflow command layer above the shared stores:

- Commands for approval, run, and ticket operations.
- Optimistic mutation lifecycle with async local mock API.
- Success and failure reconciliation.
- Rollback and inline failure state.
- Shared event log and timeline selectors.
- Workflow smoke automation.

## Phase 3 - Remaining Real UI Screen Coverage

Convert scaffold routes in product waves, preserving manifest routes and PNG references:

- Command-center support: 09-11.
- Company/goals/projects: 12-19.
- Workforce support: 22,24-29.
- Work execution support: 31,33,35-36.
- Governance support: 38-41.
- Budget/reporting: 42-45.
- Integrations, workspace, admin, help: 46-55.

Each new screen should use AppShell when authenticated, DOM/SVG/CSS Real UI, typed data/view models, route-specific smoke, and structural bbox gating where the existing Real UI strategy applies.

## Phase 4 - Interaction Wiring

- Connect navigation between new list, detail, create, and settings surfaces.
- Use shared UI state for filters, search, tabs, selection, dialog state, and workflow intent.
- Add loading, empty, and error states with no layout-breaking shortcuts.
- Keep workflow commands on the shared command/event path.

## Phase 5 - Data/API Readiness

- Expand domain types and fixtures with company, project, skill, tool permission, artifact, policy, report, integration, workspace, team, billing, and help models.
- Keep screens selector-driven.
- Keep `demo-api` as a backend adapter boundary.
- Remove remaining screen-local mock arrays when a typed data source exists.

## Phase 6 - Visual Polish & Design Consistency

- Revisit typography, spacing, primitives, color/status tokens, responsive behavior, and accessibility.
- Use PNG evidence for visual decisions.
- Do not swap DOM Real UI back to screenshot parity for production routes.

## Phase 7 - Final Exit Gates

- Run full build and data validation.
- Run onboarding parity regression.
- Run static guardrail scans.
- Run bbox, smoke, interaction, and workflow automation for all converted core routes.
- Record parity evidence and remaining pixel polish notes.
- Publish full completion exit report and final coverage totals.

## Sprint Table

| Sprint | Goal | Screens/Subsystems | Files likely touched | Verification | Exit gate |
|---|---|---|---|---|---|
| 5D | Re-audit and roadmap | Full manifest, quality docs | `docs/11-quality/*` | Baseline build, parity, bbox, smoke | Audit and roadmap accepted with clean baseline |
| 5E | Workflow action foundation | Ticket/run/approval command pipeline | `src/state`, `src/services`, `src/domain`, `scripts`, docs | Build, data validation, workflow smoke, existing gates | Commands reconcile and rollback through selectors |
| 5F | Command-center support wave | 09 Today, 10 Inbox, 11 Notifications | Sprint 2 pages, selectors, fixtures, bbox/smoke | Existing gates plus 09-11 route gates | Utility routes promoted out of partial status |
| 5G | Company and goals | 12-16 | New Real UI pages, types, data, contracts | Build, smoke, parity reference, bbox | Company/goals routes are Real UI |
| 5H | Projects wave | 17-19 | New project pages, selectors, commands | Build, smoke, parity reference, bbox | Project list/detail/create flow works |
| 5I | Workforce support wave | 22,24-29 | Agent list/builder/template/performance/memory/skill/tool pages | Build, smoke, bbox, static guardrail | Workforce support surfaces are Real UI |
| 5J | Work execution support wave | 31,33,35-36 | Ticket list/create and artifact pages | Build, workflow smoke, bbox | Ticket and artifact supporting routes are Real UI |
| 5K | Governance wave | 38-41 | Approval detail, policy, audit, risk pages | Build, workflow smoke, bbox | Governance support routes are Real UI |
| 5L | Budget and reports wave | 42-45 | Cost, budget, report pages | Build, data validation, bbox | Budget/report surfaces are Real UI |
| 5M | Integrations and admin wave A | 46-50 | Integration, MCP, workspace, secrets surfaces | Build, smoke, static guardrail | Admin adapters remain mock-safe and Real UI |
| 5N | Integrations and admin wave B | 51-55 | Team, roles, settings, billing, help | Build, smoke, bbox | Remaining manifest screens are Real UI or documented exception |
| 5O | Interaction expansion | New navigation, filters, forms, dialogs | Shared state, selectors, smoke scripts | Interaction and workflow smoke | New waves share interaction architecture |
| 5P | Data/API hardening | Expanded fixtures, view models, adapter seams | `src/domain`, `src/data`, `src/services` | Build, data validation, typecheck | Screen-local mock drift reduced |
| 5Q | Visual polish and accessibility | Converted screens | UI primitives, styles, QA docs | Accessibility pass, responsive QA, parity evidence | Consistent production UI behavior |
| 5R | Full app exit gate | All 55 manifest screens | Reports and quality scripts | Full gate suite | Exit report declares pass, partial, or blocked |

## Verification Template Per Core Sprint

```powershell
npm run build
npm run validate:demo-data
npm run smoke:real-ui-flow
npm run smoke:interactions
STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=1,2,3,4,5,6,7
npm run audit:bbox:08
npm run audit:bbox:20
npm run audit:bbox:21
npm run audit:bbox:23
npm run audit:bbox:30
npm run audit:bbox:32
npm run audit:bbox:34
npm run audit:bbox:37
```

Add screen-specific bbox, smoke, interaction, and parity reference checks when a sprint converts more routes.

## Checkpoint Policy

- Commit audit and plan docs as the first checkpoint.
- Commit each sprint only after its scoped gates pass or a documented partial result is worth retaining.
- Keep generated parity evidence out of commits unless a specific repo convention requires it.
