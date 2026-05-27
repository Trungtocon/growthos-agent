# Design 1:1 Progress Table

## Method

- Source of truth for screen names and routes: `docs/05-ui-ux/screen-manifest.csv`.
- Source of truth for current pixel diff: `docs/11-quality/PARITY_LOCKED_SCREENS.md`.
- `Tỉ lệ 1:1` is calculated as `100% - pixel diff`.
- `Mức độ wire` means the current implementation mode:
  - `Static parity locked`: onboarding/auth screens locked by static parity evidence.
  - `Real UI structural pass`: real React/DOM/SVG/CSS screen with structural bbox gate pass; visual polish still deferred.

## Summary

| Metric | Value |
|---|---:|
| Total manifest screens | 55 |
| Static parity locked screens | 7 |
| Real UI structural pass screens | 48 |
| Missing screens | 0 |
| Average 1:1 across all screens | 92.73% |
| Average 1:1 across Real UI screens | 91.68% |

## Progress Table

| Tên màn hình | Chức năng màn hình | Url màn hình | Mức độ wire | Tỉ lệ 1:1 của màn hình |
|---|---|---|---|---:|
| 01 - Login | Xác thực và onboarding workspace | `/login` | Static parity locked | 100.0000% |
| 02 - Register / Create Account | Xác thực và onboarding workspace | `/register` | Static parity locked | 100.0000% |
| 03 - Create First Company | Xác thực và onboarding workspace | `/onboarding/company` | Static parity locked | 99.6477% |
| 04 - Use Case Selection | Xác thực và onboarding workspace | `/onboarding/use-case` | Static parity locked | 100.0000% |
| 05 - First AI Team Setup Wizard | Xác thực và onboarding workspace | `/onboarding/ai-team` | Static parity locked | 100.0000% |
| 06 - Connect Hermes Runtime | Xác thực và onboarding workspace | `/onboarding/hermes` | Static parity locked | 99.9852% |
| 07 - Onboarding Complete / First Task | Xác thực và onboarding workspace | `/onboarding/complete` | Static parity locked | 100.0000% |
| 08 - Executive Command Center | Điều hành tổng quan, công việc hôm nay, inbox, thông báo | `/command-center` | Real UI structural pass | 89.4744% |
| 09 - Today View | Điều hành tổng quan, công việc hôm nay, inbox, thông báo | `/today` | Real UI structural pass | 92.4229% |
| 10 - AI Inbox | Điều hành tổng quan, công việc hôm nay, inbox, thông báo | `/inbox` | Real UI structural pass | 92.5275% |
| 11 - Notification Center | Điều hành tổng quan, công việc hôm nay, inbox, thông báo | `/notifications` | Real UI structural pass | 92.9737% |
| 12 - Company Overview | Quản trị công ty, mục tiêu và dự án | `/company/overview` | Real UI structural pass | 92.2293% |
| 13 - Company Settings | Quản trị công ty, mục tiêu và dự án | `/company/settings` | Real UI structural pass | 94.0465% |
| 14 - Goals Dashboard | Quản trị công ty, mục tiêu và dự án | `/goals` | Real UI structural pass | 90.9209% |
| 15 - Goal Detail | Quản trị công ty, mục tiêu và dự án | `/goals/demo-goal` | Real UI structural pass | 92.5892% |
| 16 - Create Goal Wizard | Quản trị công ty, mục tiêu và dự án | `/goals/new` | Real UI structural pass | 93.1915% |
| 17 - Projects List | Quản trị công ty, mục tiêu và dự án | `/projects` | Real UI structural pass | 87.8067% |
| 18 - Project Detail | Quản trị công ty, mục tiêu và dự án | `/projects/demo-project` | Real UI structural pass | 90.7039% |
| 19 - Create Project Wizard | Quản trị công ty, mục tiêu và dự án | `/projects/new` | Real UI structural pass | 92.4034% |
| 20 - AI Workforce Overview | Quản lý đội ngũ AI agent, hồ sơ, kỹ năng, hiệu suất | `/workforce` | Real UI structural pass | 90.5682% |
| 21 - Org Chart View | Quản lý đội ngũ AI agent, hồ sơ, kỹ năng, hiệu suất | `/org-chart` | Real UI structural pass | 89.4802% |
| 22 - Agents List | Quản lý đội ngũ AI agent, hồ sơ, kỹ năng, hiệu suất | `/agents` | Real UI structural pass | 91.4622% |
| 23 - Agent Detail | Quản lý đội ngũ AI agent, hồ sơ, kỹ năng, hiệu suất | `/agents/demo-agent` | Real UI structural pass | 91.9549% |
| 24 - Create Agent Wizard | Quản lý đội ngũ AI agent, hồ sơ, kỹ năng, hiệu suất | `/agents/new` | Real UI structural pass | 91.1310% |
| 25 - Agent Template Gallery | Quản lý đội ngũ AI agent, hồ sơ, kỹ năng, hiệu suất | `/agents/templates` | Real UI structural pass | 89.1427% |
| 26 - Agent Performance | Quản lý đội ngũ AI agent, hồ sơ, kỹ năng, hiệu suất | `/agents/performance` | Real UI structural pass | 89.2076% |
| 27 - Agent Memory View | Quản lý đội ngũ AI agent, hồ sơ, kỹ năng, hiệu suất | `/agents/memory` | Real UI structural pass | 92.1225% |
| 28 - Agent Skills View | Quản lý đội ngũ AI agent, hồ sơ, kỹ năng, hiệu suất | `/skills` | Real UI structural pass | 91.0761% |
| 29 - Toolsets & Permissions | Quản lý đội ngũ AI agent, hồ sơ, kỹ năng, hiệu suất | `/tools/permissions` | Real UI structural pass | 91.9245% |
| 30 - Tickets Board | Quản lý ticket, run console và artifact | `/tickets` | Real UI structural pass | 89.5416% |
| 31 - Tickets List | Quản lý ticket, run console và artifact | `/tickets/list` | Real UI structural pass | 92.6968% |
| 32 - Ticket Detail | Quản lý ticket, run console và artifact | `/tickets/demo-ticket` | Real UI structural pass | 92.2628% |
| 33 - Create Ticket Wizard | Quản lý ticket, run console và artifact | `/tickets/new` | Real UI structural pass | 91.4178% |
| 34 - Run Console | Quản lý ticket, run console và artifact | `/runs/demo-run` | Real UI structural pass | 90.9881% |
| 35 - Artifacts Library | Quản lý ticket, run console và artifact | `/artifacts` | Real UI structural pass | 93.2318% |
| 36 - Artifact Detail / Review | Quản lý ticket, run console và artifact | `/artifacts/demo-artifact` | Real UI structural pass | 93.4793% |
| 37 - Approval Center | Phê duyệt, chính sách, audit và rủi ro | `/approvals` | Real UI structural pass | 91.3603% |
| 38 - Approval Detail | Phê duyệt, chính sách, audit và rủi ro | `/approvals/demo-approval` | Real UI structural pass | 91.4431% |
| 39 - Governance Policy | Phê duyệt, chính sách, audit và rủi ro | `/governance/policies` | Real UI structural pass | 92.1740% |
| 40 - Audit Log | Phê duyệt, chính sách, audit và rủi ro | `/audit-log` | Real UI structural pass | 91.6468% |
| 41 - Risk Center | Phê duyệt, chính sách, audit và rủi ro | `/risk-center` | Real UI structural pass | 90.6652% |
| 42 - Cost Dashboard | Chi phí, ngân sách và báo cáo | `/cost` | Real UI structural pass | 90.7091% |
| 43 - Budget Settings | Chi phí, ngân sách và báo cáo | `/budget/settings` | Real UI structural pass | 92.4442% |
| 44 - Reports Dashboard | Chi phí, ngân sách và báo cáo | `/reports` | Real UI structural pass | 93.1684% |
| 45 - Report Builder | Chi phí, ngân sách và báo cáo | `/reports/new` | Real UI structural pass | 92.4509% |
| 46 - Integrations Hub | Tích hợp, workspace, secrets, team, phân quyền, billing, hỗ trợ | `/integrations` | Real UI structural pass | 92.1195% |
| 47 - Integration Detail | Tích hợp, workspace, secrets, team, phân quyền, billing, hỗ trợ | `/integrations/demo-integration` | Real UI structural pass | 93.0636% |
| 48 - MCP Server Manager | Tích hợp, workspace, secrets, team, phân quyền, billing, hỗ trợ | `/mcp` | Real UI structural pass | 92.8441% |
| 49 - Workspaces Manager | Tích hợp, workspace, secrets, team, phân quyền, billing, hỗ trợ | `/workspaces` | Real UI structural pass | 92.8529% |
| 50 - Secrets Manager | Tích hợp, workspace, secrets, team, phân quyền, billing, hỗ trợ | `/secrets` | Real UI structural pass | 92.7985% |
| 51 - Team Members | Tích hợp, workspace, secrets, team, phân quyền, billing, hỗ trợ | `/team` | Real UI structural pass | 93.1661% |
| 52 - Role & Permission | Tích hợp, workspace, secrets, team, phân quyền, billing, hỗ trợ | `/roles-permissions` | Real UI structural pass | 92.5972% |
| 53 - System Settings | Tích hợp, workspace, secrets, team, phân quyền, billing, hỗ trợ | `/settings` | Real UI structural pass | 94.1279% |
| 54 - Billing / Plan | Tích hợp, workspace, secrets, team, phân quyền, billing, hỗ trợ | `/billing` | Real UI structural pass | 91.8430% |
| 55 - Help / Template Center | Tích hợp, workspace, secrets, team, phân quyền, billing, hỗ trợ | `/help` | Real UI structural pass | 91.5829% |

## Lowest 1:1 Routes

| Rank | Screen | Route | 1:1 Ratio |
|---:|---|---|---:|
| 1 | 17 - Projects List | `/projects` | 87.8067% |
| 2 | 25 - Agent Template Gallery | `/agents/templates` | 89.1427% |
| 3 | 26 - Agent Performance | `/agents/performance` | 89.2076% |
| 4 | 08 - Executive Command Center | `/command-center` | 89.4744% |
| 5 | 21 - Org Chart View | `/org-chart` | 89.4802% |
