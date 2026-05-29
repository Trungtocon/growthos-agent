# Full 55-Screen Audit Report

## Scope

This report initializes the measurable 55-screen recovery system. Section and bbox audit scripts update generated evidence under `parity-reports/`.

| Screen | Route | Component | Render Mode | Section Audit | BBox Audit | Visual Diff | Missing Sections | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | `/login` | LoginOnboardingParityPage | STATIC_PARITY | Pass 1/1 | Pass 1/1 | 0% | - | P3 |
| 02 | `/register` | RegisterOnboardingParityPage | STATIC_PARITY | Pass 1/1 | Pass 1/1 | 0% | - | P3 |
| 03 | `/onboarding/company` | CompanyOnboardingParityPage | STATIC_PARITY | Pass 1/1 | Pass 1/1 | 0.3523% | - | P3 |
| 04 | `/onboarding/use-case` | UseCaseOnboardingParityPage | STATIC_PARITY | Pass 1/1 | Pass 1/1 | 0% | - | P3 |
| 05 | `/onboarding/ai-team` | AiTeamOnboardingParityPage | STATIC_PARITY | Pass 1/1 | Pass 1/1 | 0% | - | P3 |
| 06 | `/onboarding/hermes` | HermesOnboardingParityPage | STATIC_PARITY | Pass 1/1 | Pass 1/1 | 0.0148% | - | P3 |
| 07 | `/onboarding/complete` | CompleteOnboardingParityPage | STATIC_PARITY | Pass 1/1 | Pass 1/1 | 0% | - | P3 |
| 08 | `/command-center` | CommandCenter / AppShell | REAL_UI | Pass 14/14 | Pass 14/14 | 10.4716% | - | P2 |
| 09 | `/today` | TodayScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 7.5771% | - | P3 |
| 10 | `/inbox` | InboxScreen / AppShell | REAL_UI | Pass 9/9 | Pass 9/9 | 7.4678% | - | P3 |
| 11 | `/notifications` | NotificationScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 7.0314% | - | P3 |
| 12 | `/company/overview` | CompanyOverviewScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 7.7707% | - | P3 |
| 13 | `/company/settings` | CompanySettingsScreen / AppShell | REAL_UI | Pass 7/7 | Pass 7/7 | 5.9535% | - | P3 |
| 14 | `/goals` | GoalsDashboardScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 9.0791% | - | P2 |
| 15 | `/goals/demo-goal` | GoalDetailScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 7.4108% | - | P3 |
| 16 | `/goals/new` | CreateGoalScreen / AppShell | REAL_UI | Pass 7/7 | Pass 7/7 | 6.8085% | - | P3 |
| 17 | `/projects` | ProjectsListScreen / AppShell | REAL_UI | Pass 10/10 | Pass 10/10 | 10.8481% | - | P2 |
| 18 | `/projects/demo-project` | ProjectDetailScreen / AppShell | REAL_UI | Pass 7/7 | Pass 7/7 | 9.2961% | - | P2 |
| 19 | `/projects/new` | CreateProjectScreen / AppShell | REAL_UI | Pass 7/7 | Pass 7/7 | 7.5966% | - | P3 |
| 20 | `/workforce` | WorkforceOverviewRealPage | REAL_UI | Pass 14/14 | Pass 14/14 | 9.4227% | - | P2 |
| 21 | `/org-chart` | OrgChartRealPage | REAL_UI | Pass 10/10 | Pass 10/10 | 10.5198% | - | P2 |
| 22 | `/agents` | AgentsListScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 8.5378% | - | P2 |
| 23 | `/agents/demo-agent` | AgentDetailRealPage | REAL_UI | Pass 18/18 | Pass 18/18 | 8.0324% | - | P2 |
| 24 | `/agents/new` | CreateAgentScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 8.869% | - | P2 |
| 25 | `/agents/templates` | AgentTemplatesScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 10.572% | - | P2 |
| 26 | `/agents/performance` | AgentPerformanceScreen / AppShell | REAL_UI | Pass 12/12 | Pass 12/12 | 10.7083% | - | P2 |
| 27 | `/agents/memory` | AgentMemoryScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 7.8775% | - | P3 |
| 28 | `/skills` | SkillsRegistryScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 8.9239% | - | P2 |
| 29 | `/tools/permissions` | ToolsPermissionsScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 8.0755% | - | P2 |
| 30 | `/tickets` | TicketsBoardRealPage | REAL_UI | Pass 12/12 | Pass 12/12 | 10.3084% | - | P2 |
| 31 | `/tickets/list` | TicketsListScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 7.3032% | - | P3 |
| 32 | `/tickets/demo-ticket` | TicketDetailRealPage | REAL_UI | Pass 15/15 | Pass 15/15 | 8.0905% | - | P2 |
| 33 | `/tickets/new` | CreateTicketScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 8.5822% | - | P2 |
| 34 | `/runs/demo-run` | RunConsoleRealPage | REAL_UI | Pass 16/16 | Pass 16/16 | 9.008% | - | P2 |
| 35 | `/artifacts` | ArtifactsLibraryScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 6.7682% | - | P3 |
| 36 | `/artifacts/demo-artifact` | ArtifactDetailScreen / AppShell | REAL_UI | Pass 7/7 | Pass 7/7 | 6.5207% | - | P3 |
| 37 | `/approvals` | ApprovalCenterRealPage | REAL_UI | Pass 13/13 | Pass 13/13 | 8.6052% | - | P2 |
| 38 | `/approvals/demo-approval` | ApprovalDetailScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 8.5569% | - | P2 |
| 39 | `/governance/policies` | GovernancePoliciesScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 7.826% | - | P3 |
| 40 | `/audit-log` | AuditLogScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 8.3532% | - | P2 |
| 41 | `/risk-center` | RiskCenterScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 9.3348% | - | P2 |
| 42 | `/cost` | CostDashboardScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 9.2909% | - | P2 |
| 43 | `/budget/settings` | BudgetSettingsScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 7.5558% | - | P3 |
| 44 | `/reports` | ReportsDashboardScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 6.8316% | - | P3 |
| 45 | `/reports/new` | ReportBuilderScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 7.5491% | - | P3 |
| 46 | `/integrations` | IntegrationsHubScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 7.8805% | - | P3 |
| 47 | `/integrations/demo-integration` | IntegrationDetailScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 6.9364% | - | P3 |
| 48 | `/mcp` | McpServerManagerScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 7.1559% | - | P3 |
| 49 | `/workspaces` | WorkspacesManagerScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 7.1471% | - | P3 |
| 50 | `/secrets` | SecretsManagerScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 7.2015% | - | P3 |
| 51 | `/team` | TeamMembersScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 6.8339% | - | P3 |
| 52 | `/roles-permissions` | RolesPermissionsScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 7.4028% | - | P3 |
| 53 | `/settings` | SystemSettingsScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 5.8721% | - | P3 |
| 54 | `/billing` | BillingPlanScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 8.157% | - | P2 |
| 55 | `/help` | HelpTemplateCenterScreen / AppShell | REAL_UI | Pass 8/8 | Pass 8/8 | 8.4171% | - | P2 |
