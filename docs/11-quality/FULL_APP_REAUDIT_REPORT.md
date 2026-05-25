# Full Application Re-Audit Report

## 1. Executive Summary

Audit baseline on 2026-05-23:

- Manifest screens: 55.
- Manifest routes with an app route entry: 55.
- Design-backed implementations beyond the scaffold fallback: 26.
- Locked static parity onboarding/auth screens: 7.
- Real UI routes with structural bbox gates: 19.
- Partial utility Real UI routes without route-specific parity or bbox gates: 0.
- Scaffold placeholders still falling through `ScreenPage`: 29.
- Real UI Demo v1 flow remains healthy at audit time: build pass, onboarding parity pass, bbox gates pass for 08/20/21/23/30/32/34/37, smoke flow pass, interaction smoke pass.

The route map is broad but product coverage is not yet broad. `ScreenPage` keeps every manifest route navigable, but only `commercialRoutes` and `sprint2Routes` bypass the generic scaffold. The next work should stabilize workflow commands and then convert remaining business routes in coherent waves rather than treating scaffold presence as completion.

## 2. Route Coverage Table

| Screen | Route | Manifest title | Active component | File | Mode | Uses AppShell | Status |
|---|---|---|---|---|---|---|---|
| 01 | `/login` | Login | `LoginOnboardingParityPage` | `src/pages/Sprint2Screens.tsx` | STATIC_PARITY | No | PASS |
| 02 | `/register` | Register / Create Account | `RegisterOnboardingParityPage` | `src/pages/Sprint2Screens.tsx` | STATIC_PARITY | No | PASS |
| 03 | `/onboarding/company` | Create First Company | `CompanyOnboardingParityPage` | `src/pages/Sprint2Screens.tsx` | STATIC_PARITY | No | PASS |
| 04 | `/onboarding/use-case` | Use Case Selection | `UseCaseOnboardingParityPage` | `src/pages/Sprint2Screens.tsx` | STATIC_PARITY | No | PASS |
| 05 | `/onboarding/ai-team` | First AI Team Setup Wizard | `AiTeamOnboardingParityPage` | `src/pages/Sprint2Screens.tsx` | STATIC_PARITY | No | PASS |
| 06 | `/onboarding/hermes` | Connect Hermes Runtime | `HermesOnboardingParityPage` | `src/pages/Sprint2Screens.tsx` | STATIC_PARITY | No | PASS |
| 07 | `/onboarding/complete` | Onboarding Complete / First Task | `CompleteOnboardingParityPage` | `src/pages/Sprint2Screens.tsx` | STATIC_PARITY | No | PASS |
| 08 | `/command-center` | Executive Command Center | `CommandCenter` | `src/pages/DemoScreens.tsx` | REAL_UI | Yes | PASS |
| 09 | `/today` | Today Workspace | `TodayScreen` | `src/pages/Sprint2Screens.tsx` | REAL_UI | Yes | PASS |
| 10 | `/inbox` | Inbox | `InboxScreen` | `src/pages/Sprint2Screens.tsx` | REAL_UI | Yes | PASS |
| 11 | `/notifications` | Notification Center | `NotificationScreen` | `src/pages/Sprint2Screens.tsx` | REAL_UI | Yes | PASS |
| 12 | `/company/overview` | Company Overview | `CompanyOverviewScreen` | `src/pages/Sprint2Screens.tsx` | REAL_UI | Yes | PASS |
| 13 | `/company/settings` | Company Profile / Settings | `CompanySettingsScreen` | `src/pages/Sprint2Screens.tsx` | REAL_UI | Yes | PASS |
| 14 | `/goals` | Goals List | `GoalsDashboardScreen` | `src/pages/Sprint2Screens.tsx` | REAL_UI | Yes | PASS |
| 15 | `/goals/demo-goal` | Goal Detail | `GoalDetailScreen` | `src/pages/Sprint2Screens.tsx` | REAL_UI | Yes | PASS |
| 16 | `/goals/new` | Create Goal | `CreateGoalScreen` | `src/pages/Sprint2Screens.tsx` | REAL_UI | Yes | PASS |
| 17 | `/projects` | Projects List | `ProjectsListScreen` | `src/pages/Sprint2Screens.tsx` | REAL_UI | Yes | PASS |
| 18 | `/projects/demo-project` | Project Detail | `ProjectDetailScreen` | `src/pages/Sprint2Screens.tsx` | REAL_UI | Yes | PASS |
| 19 | `/projects/new` | Create Project | `CreateProjectScreen` | `src/pages/Sprint2Screens.tsx` | REAL_UI | Yes | PASS |
| 20 | `/workforce` | AI Workforce Overview | `WorkforceOverviewRealPage` | `src/pages/DemoScreens.tsx` | REAL_UI | Yes | PASS |
| 21 | `/org-chart` | Org Chart View | `OrgChartRealPage` | `src/pages/DemoScreens.tsx` | REAL_UI | Yes | PASS |
| 22 | `/agents` | Agent List | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 23 | `/agents/demo-agent` | Agent Detail | `AgentDetailRealPage` | `src/pages/DemoScreens.tsx` | REAL_UI | Yes | PASS |
| 24 | `/agents/new` | Agent Builder | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 25 | `/agents/templates` | Agent Template Gallery | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 26 | `/agents/performance` | Agent Performance | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 27 | `/agents/memory` | Agent Memory / Context | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 28 | `/skills` | Skill Registry | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 29 | `/tools/permissions` | Tools & Permissions | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 30 | `/tickets` | Tickets Board | `TicketsBoardRealPage` | `src/pages/DemoScreens.tsx` | REAL_UI | Yes | PASS |
| 31 | `/tickets/list` | Tickets List | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 32 | `/tickets/demo-ticket` | Ticket Detail | `TicketDetailRealPage` | `src/pages/DemoScreens.tsx` | REAL_UI | Yes | PASS |
| 33 | `/tickets/new` | Create Ticket | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 34 | `/runs/demo-run` | Run Console | `RunConsoleRealPage` | `src/pages/DemoScreens.tsx` | REAL_UI | Yes | PASS |
| 35 | `/artifacts` | Artifacts Library | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 36 | `/artifacts/demo-artifact` | Artifact Detail / Review | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 37 | `/approvals` | Approval Center | `ApprovalCenterRealPage` | `src/pages/DemoScreens.tsx` | REAL_UI | Yes | PASS |
| 38 | `/approvals/demo-approval` | Approval Detail | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 39 | `/governance/policies` | Governance Policy | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 40 | `/audit-log` | Audit Log | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 41 | `/risk-center` | Risk Center | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 42 | `/cost` | Cost Dashboard | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 43 | `/budget/settings` | Budget Settings | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 44 | `/reports` | Reports Dashboard | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 45 | `/reports/new` | Report Builder | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 46 | `/integrations` | Integrations Hub | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 47 | `/integrations/demo-integration` | Integration Detail | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 48 | `/mcp` | MCP Server Manager | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 49 | `/workspaces` | Workspaces Manager | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 50 | `/secrets` | Secrets Manager | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 51 | `/team` | Team Members | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 52 | `/roles-permissions` | Role & Permission | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 53 | `/settings` | System Settings | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 54 | `/billing` | Billing / Plan | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |
| 55 | `/help` | Help / Template Center | `ScreenPage` scaffold fallback | `src/pages/ScreenPage.tsx` | PLACEHOLDER | Yes | NOT_STARTED |

## 3. Visual/Structural Gate Status

| Screen | Route | Visual parity status | Structural bbox status | Smoke status | Notes |
|---|---|---|---|---|---|
| 01-07 | Auth and onboarding | Pass at <=1% regression threshold | N/A | Route parity coverage | Frozen static-first parity screens |
| 08 | `/command-center` | Pixel polish deferred, 10.5256% reference diff | Pass 14/14 | Pass | Real UI structural baseline |
| 09 | `/today` | Pixel polish deferred, 7.5771% reference diff | Pass 8/8 | Pass | Command-support Real UI route promoted in Sprint 5F |
| 10 | `/inbox` | Pixel polish deferred, 7.4725% reference diff | Pass 9/9 | Pass | Command-support Real UI route promoted in Sprint 5F |
| 11 | `/notifications` | Pixel polish deferred, 7.0263% reference diff | Pass 8/8 | Pass | Command-support Real UI route promoted in Sprint 5F |
| 12-19 | Company, goals, projects | Pixel polish deferred, 5.9535%-11.1671% reference diff | Pass 60/60 | Pass | Business planning wave promoted in Sprint 5G |
| 20 | `/workforce` | Pixel polish deferred, 9.4318% reference diff | Pass 14/14 | Pass | Real UI structural baseline |
| 21 | `/org-chart` | Pixel polish deferred, 11.4165% reference diff | Pass 10/10 | Pass | Real UI structural baseline |
| 23 | `/agents/demo-agent` | Pixel polish deferred, 8.0451% reference diff | Pass 18/18 | Pass | Real UI structural baseline |
| 30 | `/tickets` | Pixel polish deferred, 10.6961% reference diff | Pass 12/12 | Pass | Real UI structural baseline |
| 32 | `/tickets/demo-ticket` | Pixel polish deferred, 7.7372% reference diff | Pass 15/15 | Pass | Real UI structural baseline |
| 34 | `/runs/demo-run` | Pixel polish deferred, 12.5042% reference diff | Pass 16/16 | Pass | Real UI structural baseline |
| 37 | `/approvals` | Pixel polish deferred, 8.6397% reference diff | Pass 13/13 | Pass | Real UI structural baseline |
| 22,24-29,31,33,35-36,38-55 | Remaining manifest routes | Scaffold only | Missing | Missing | Convert in prioritized waves |

## 4. Static Asset Audit

Audit commands scanned `src` for Real UI parity route folders, `sidebar.png`, `topbar.png`, `content.png`, `backgroundImage`, and route-specific design folder names.

| Route | Static slice rendered? | Evidence | Severity | Action |
|---|---|---|---|---|
| `/login` through `/onboarding/complete` | Yes, intentionally | Onboarding parity page dispatch in `Sprint2Screens.tsx` | Accepted | Keep frozen unless onboarding sprint changes policy |
| `/command-center` | No | Guardrail scan has no `parity_08` source match | Low | Keep structural gate and guardrail |
| `/today` | No | Guardrail scan has no production `parity_09` source match | Low | Keep structural gate and guardrail |
| `/inbox` | No | Guardrail scan has no production `parity_10` source match | Low | Keep structural gate and guardrail |
| `/notifications` | No | Guardrail scan has no production `parity_11` source match | Low | Keep structural gate and guardrail |
| `/company/overview`, `/company/settings`, `/goals`, `/goals/demo-goal`, `/goals/new`, `/projects`, `/projects/demo-project`, `/projects/new` | No | Guardrail scan has no production `parity_12`-`parity_19` source match | Low | Keep structural gate and guardrail |
| `/workforce` | No | Guardrail scan has no `parity_20` source match | Low | Keep structural gate and guardrail |
| `/org-chart` | No | Guardrail scan has no `parity_21` source match | Low | Keep structural gate and guardrail |
| `/agents/demo-agent` | No | Guardrail scan has no `parity_23` source match | Low | Keep structural gate and guardrail |
| `/tickets` | No | Guardrail scan has no `parity_30` source match | Low | Keep structural gate and guardrail |
| `/tickets/demo-ticket` | No | Guardrail scan has no `parity_32` source match | Low | Keep structural gate and guardrail |
| `/runs/demo-run` | No | Guardrail scan has no `parity_34` source match | Low | Keep structural gate and guardrail |
| `/approvals` | No | Guardrail scan has no `parity_37` source match | Low | Keep structural gate and guardrail |
| Remaining AppShell routes | No production parity slices found | Generic scaffold references PNG only as a source link | Medium | Replace scaffold with DOM Real UI routes by wave |

## 5. App Architecture Audit

| Area | Current state | Assessment |
|---|---|---|
| AppShell | Shared DOM shell with route profiles and active nav | Healthy baseline for authenticated pages |
| Route map | Manifest is complete; `commercialRoutes` and `sprint2Routes` choose the non-scaffold branch | Coverage is explicit but narrow |
| Component primitives | Dashboard cards, badges, progress, rows, and shell UI exist | Reuse for new screen waves |
| Domain types | Demo v1 entities are typed in `src/domain` | Good starting point; expand with new screen data |
| Fixtures | Linked demo fixtures cover Real UI Demo v1 and Sprint 5G planning routes | Incomplete for the remaining 29 scaffold routes |
| Mock API | Local demo API boundary exists | Needs mutation and workflow command coverage |
| Selectors | Demo view models and UI interaction selectors exist | Keep selector-driven rendering as screens expand |
| State/store | Shared demo data hooks plus UI interaction state | Needs command/event and optimistic mutation boundary |
| Interaction model | Selection, search, filters, and tabs are wired for Demo v1 | Does not yet cover workflow decisions and rollback |
| Quality docs/tests | Strong Demo v1 docs, bbox audit, smoke, data validation | Missing full application wave status and later-screen gates |

## 6. Product Readiness Audit

| Dimension | Assessment | Evidence |
|---|---|---|
| UI coverage | Partial | 26 of 55 screens have design-backed UI beyond the scaffold fallback; 19 authenticated routes now have structural gates |
| Interaction readiness | Partial | Selection/navigation wiring exists for Demo v1 only |
| Data readiness | Partial | Typed fixtures and selectors exist for Demo v1 entities |
| API readiness | Foundation only | Mock read service exists; backend adapter and mutation flow remain |
| Accessibility readiness | Partial | Semantic Real UI components exist, but no full audit across 55 screens |
| Responsive readiness | Partial | Desktop structural gates exist for eight routes; broad route coverage is not verified |
| Maintainability | Improving | AppShell, primitives, selectors, docs, and smoke scripts reduce divergence |
| Testing | Partial | Build, data validation, onboarding parity, bbox, and smoke cover Demo v1 |
| Commercial demo readiness | Demo v1 pass, full app partial | Core flow works; broad product surfaces remain scaffold placeholders |

## 7. Screen-by-Screen Gap Matrix

| Screen | Route | Missing UI | Missing interaction | Missing data/API | Missing test/gate | Priority |
|---|---|---|---|---|---|---|
| 22,24-29 | Workforce support | List, builder, templates, performance, memory, skill/tool screens | Agent creation, inspection, permission flows | Extended agent/skill/tool data | Per-screen screen gates | P1 important product flow |
| 31,33,35-36 | Work execution support | Tickets list/new and artifact screens | Create/review flows | Ticket/artifact selectors | Per-screen screen gates | P1 important product flow |
| 38-41 | Governance support | Detail, policy, audit, risk screens | Approval detail and policy actions | Governance and audit events | Per-screen screen gates | P1 important product flow |
| 42-45 | Budget/reports | Cost, budget, report builder surfaces | Budget/report controls | Report and cost models | Per-screen screen gates | P2 remaining core screen |
| 46-55 | Integrations/admin | Integrations, workspace, settings, billing, help surfaces | Admin configuration flows | Admin/integration models | Per-screen screen gates | P2 remaining core screen |
| Existing 08/20/21/23/30/32/34/37 | Demo v1 visuals | Pixel polish deferred | Workflow mutations | Mutation mock API | Workflow smoke | P0 demo blocker |

## 8. Risk Register

| Risk | Impact | Evidence | Mitigation |
|---|---|---|---|
| Scaffold routes look implemented because they route | Coverage can be overstated | 29 manifest routes still fall through `ScreenPage` scaffold | Track mode and gates per screen |
| Pixel parity and Real UI constraints compete | Time loss on small visual deltas | Sprint 4 tuning history and acceptance policy | Keep structural gate for Real UI, use pixel diff as reference |
| Workflow mutations bypass selectors/store | UI state diverges across screens | Current architecture is selection-first | Add command/event pipeline before more workflow UI |
| New screen waves duplicate local mock data | Maintenance cost and inconsistent flows | Fixtures cover only Demo v1 | Extend typed fixtures/selectors per wave |
| Admin/settings screens imply backend/security needs | Unsafe fake requirements | Manifest includes secrets, billing, integrations | Keep mock-only boundary and document non-production adapters |
| Quality scripts grow route by route | Gate drift | Current bbox/smoke scripts are manually enumerated | Consolidate wave checklists and update progress docs |

## 9. Recommended Completion Strategy

1. Keep onboarding 01-07 frozen and keep Real UI Demo v1 structural gates unchanged.
2. Build the workflow command/event layer next so ticket, run, and approval actions share optimistic mutation, rollback, and activity behavior before more surfaces depend on them.
3. Keep `/today`, `/inbox`, and `/notifications` under the Sprint 5F structural quality strategy.
4. Convert remaining routes by business wave:
   - workforce support routes;
   - work execution support routes;
   - governance, budget, reports;
   - integrations and workspace/admin.
5. Extend typed data, selectors, mock API boundaries, smoke coverage, and structural gates with each converted wave.
6. Reserve broad visual polish, accessibility verification, responsive QA, and final parity evidence for the stabilization stage after route coverage and interactions are coherent.
