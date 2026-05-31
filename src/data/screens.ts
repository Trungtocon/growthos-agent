export type ScreenSpec = {
  id: number;
  wave: string;
  title: string;
  route: string;
  file: string;
  assetPath: string;
};

export const screens: ScreenSpec[] = [
  {
    "id": 1,
    "wave": "Authentication & Onboarding",
    "title": "Login",
    "route": "/login",
    "file": "01_Login.png",
    "assetPath": "/stitch_ui/01_Login.png"
  },
  {
    "id": 2,
    "wave": "Authentication & Onboarding",
    "title": "Register / Create Account",
    "route": "/register",
    "file": "02_Register_Create_Account.png",
    "assetPath": "/stitch_ui/02_Register_Create_Account.png"
  },
  {
    "id": 3,
    "wave": "Authentication & Onboarding",
    "title": "Create First Company",
    "route": "/onboarding/company",
    "file": "03_Create_First_Company.png",
    "assetPath": "/stitch_ui/03_Create_First_Company.png"
  },
  {
    "id": 4,
    "wave": "Authentication & Onboarding",
    "title": "Use Case Selection",
    "route": "/onboarding/use-case",
    "file": "04_Use_Case_Selection.png",
    "assetPath": "/stitch_ui/04_Use_Case_Selection.png"
  },
  {
    "id": 5,
    "wave": "Authentication & Onboarding",
    "title": "First AI Team Setup Wizard",
    "route": "/onboarding/ai-team",
    "file": "05_First_AI_Team_Setup_Wizard.png",
    "assetPath": "/stitch_ui/05_First_AI_Team_Setup_Wizard.png"
  },
  {
    "id": 6,
    "wave": "Authentication & Onboarding",
    "title": "Connect Hermes Runtime",
    "route": "/onboarding/hermes",
    "file": "06_Connect_Hermes_Runtime.png",
    "assetPath": "/stitch_ui/06_Connect_Hermes_Runtime.png"
  },
  {
    "id": 7,
    "wave": "Authentication & Onboarding",
    "title": "Onboarding Complete / First Task",
    "route": "/onboarding/complete",
    "file": "07_Onboarding_Complete_First_Task.png",
    "assetPath": "/stitch_ui/07_Onboarding_Complete_First_Task.png"
  },
  {
    "id": 8,
    "wave": "Command Center",
    "title": "Executive Command Center",
    "route": "/command-center",
    "file": "08_Executive_Command_Center.png",
    "assetPath": "/stitch_ui/08_Executive_Command_Center.png"
  },
  {
    "id": 9,
    "wave": "Command Center",
    "title": "Today View",
    "route": "/today",
    "file": "09_Today_View.png",
    "assetPath": "/stitch_ui/09_Today_View.png"
  },
  {
    "id": 10,
    "wave": "Command Center",
    "title": "AI Inbox",
    "route": "/inbox",
    "file": "10_AI_Inbox.png",
    "assetPath": "/stitch_ui/10_AI_Inbox.png"
  },
  {
    "id": 11,
    "wave": "Command Center",
    "title": "Notification Center",
    "route": "/notifications",
    "file": "11_Notification_Center.png",
    "assetPath": "/stitch_ui/11_Notification_Center.png"
  },
  {
    "id": 12,
    "wave": "Company, Goals & Projects",
    "title": "Company Overview",
    "route": "/company/overview",
    "file": "12_Company_Overview.png",
    "assetPath": "/stitch_ui/12_Company_Overview.png"
  },
  {
    "id": 13,
    "wave": "Company, Goals & Projects",
    "title": "Company Settings",
    "route": "/company/settings",
    "file": "13_Company_Settings.png",
    "assetPath": "/stitch_ui/13_Company_Settings.png"
  },
  {
    "id": 14,
    "wave": "Company, Goals & Projects",
    "title": "Goals Dashboard",
    "route": "/goals",
    "file": "14_Goals_Dashboard.png",
    "assetPath": "/stitch_ui/14_Goals_Dashboard.png"
  },
  {
    "id": 15,
    "wave": "Company, Goals & Projects",
    "title": "Goal Detail",
    "route": "/goals/demo-goal",
    "file": "15_Goal_Detail.png",
    "assetPath": "/stitch_ui/15_Goal_Detail.png"
  },
  {
    "id": 16,
    "wave": "Company, Goals & Projects",
    "title": "Create Goal Wizard",
    "route": "/goals/new",
    "file": "16_Create_Goal_Wizard.png",
    "assetPath": "/stitch_ui/16_Create_Goal_Wizard.png"
  },
  {
    "id": 17,
    "wave": "Company, Goals & Projects",
    "title": "Projects List",
    "route": "/projects",
    "file": "17_Projects_List.png",
    "assetPath": "/stitch_ui/17_Projects_List.png"
  },
  {
    "id": 18,
    "wave": "Company, Goals & Projects",
    "title": "Project Detail",
    "route": "/projects/demo-project",
    "file": "18_Project_Detail.png",
    "assetPath": "/stitch_ui/18_Project_Detail.png"
  },
  {
    "id": 19,
    "wave": "Company, Goals & Projects",
    "title": "Create Project Wizard",
    "route": "/projects/new",
    "file": "19_Create_Project_Wizard.png",
    "assetPath": "/stitch_ui/19_Create_Project_Wizard.png"
  },
  {
    "id": 20,
    "wave": "AI Workforce",
    "title": "AI Workforce Overview",
    "route": "/workforce",
    "file": "20_AI_Workforce_Overview.png",
    "assetPath": "/stitch_ui/20_AI_Workforce_Overview.png"
  },
  {
    "id": 21,
    "wave": "AI Workforce",
    "title": "Org Chart View",
    "route": "/org-chart",
    "file": "21_Org_Chart_View.png",
    "assetPath": "/stitch_ui/21_Org_Chart_View.png"
  },
  {
    "id": 22,
    "wave": "AI Workforce",
    "title": "Agents List",
    "route": "/agents",
    "file": "22_Agents_List.png",
    "assetPath": "/stitch_ui/22_Agents_List.png"
  },
  {
    "id": 23,
    "wave": "AI Workforce",
    "title": "Agent Detail",
    "route": "/agents/demo-agent",
    "file": "23_Agent_Detail.png",
    "assetPath": "/stitch_ui/23_Agent_Detail.png"
  },
  {
    "id": 24,
    "wave": "AI Workforce",
    "title": "Create Agent Wizard",
    "route": "/agents/new",
    "file": "24_Create_Agent_Wizard.png",
    "assetPath": "/stitch_ui/24_Create_Agent_Wizard.png"
  },
  {
    "id": 25,
    "wave": "AI Workforce",
    "title": "Agent Template Gallery",
    "route": "/agents/templates",
    "file": "25_Agent_Template_Gallery.png",
    "assetPath": "/stitch_ui/25_Agent_Template_Gallery.png"
  },
  {
    "id": 26,
    "wave": "AI Workforce",
    "title": "Agent Performance",
    "route": "/agents/performance",
    "file": "26_Agent_Performance.png",
    "assetPath": "/stitch_ui/26_Agent_Performance.png"
  },
  {
    "id": 27,
    "wave": "AI Workforce",
    "title": "Agent Memory View",
    "route": "/agents/memory",
    "file": "27_Agent_Memory_View.png",
    "assetPath": "/stitch_ui/27_Agent_Memory_View.png"
  },
  {
    "id": 28,
    "wave": "AI Workforce",
    "title": "Agent Skills View",
    "route": "/skills",
    "file": "28_Agent_Skills_View.png",
    "assetPath": "/stitch_ui/28_Agent_Skills_View.png"
  },
  {
    "id": 29,
    "wave": "AI Workforce",
    "title": "Toolsets & Permissions",
    "route": "/tools/permissions",
    "file": "29_Toolsets_Permissions.png",
    "assetPath": "/stitch_ui/29_Toolsets_Permissions.png"
  },
  {
    "id": 30,
    "wave": "Work Execution",
    "title": "Tickets Board",
    "route": "/tickets",
    "file": "30_Tickets_Board.png",
    "assetPath": "/stitch_ui/30_Tickets_Board.png"
  },
  {
    "id": 31,
    "wave": "Work Execution",
    "title": "Tickets List",
    "route": "/tickets/list",
    "file": "31_Tickets_List.png",
    "assetPath": "/stitch_ui/31_Tickets_List.png"
  },
  {
    "id": 32,
    "wave": "Work Execution",
    "title": "Ticket Detail",
    "route": "/tickets/demo-ticket",
    "file": "32_Ticket_Detail.png",
    "assetPath": "/stitch_ui/32_Ticket_Detail.png"
  },
  {
    "id": 33,
    "wave": "Work Execution",
    "title": "Create Ticket Wizard",
    "route": "/tickets/new",
    "file": "33_Create_Ticket_Wizard.png",
    "assetPath": "/stitch_ui/33_Create_Ticket_Wizard.png"
  },
  {
    "id": 34,
    "wave": "Work Execution",
    "title": "Run Console",
    "route": "/runs/demo-run",
    "file": "34_Run_Console.png",
    "assetPath": "/stitch_ui/34_Run_Console.png"
  },
  {
    "id": 35,
    "wave": "Work Execution",
    "title": "Artifacts Library",
    "route": "/artifacts",
    "file": "35_Artifacts_Library.png",
    "assetPath": "/stitch_ui/35_Artifacts_Library.png"
  },
  {
    "id": 36,
    "wave": "Work Execution",
    "title": "Artifact Detail / Review",
    "route": "/artifacts/demo-artifact",
    "file": "36_Artifact_Detail_Review.png",
    "assetPath": "/stitch_ui/36_Artifact_Detail_Review.png"
  },
  {
    "id": 37,
    "wave": "Governance & Audit",
    "title": "Approval Center",
    "route": "/approvals",
    "file": "37_Approval_Center.png",
    "assetPath": "/stitch_ui/37_Approval_Center.png"
  },
  {
    "id": 38,
    "wave": "Governance & Audit",
    "title": "Approval Detail",
    "route": "/approvals/demo-approval",
    "file": "38_Approval_Detail.png",
    "assetPath": "/stitch_ui/38_Approval_Detail.png"
  },
  {
    "id": 39,
    "wave": "Governance & Audit",
    "title": "Governance Policy",
    "route": "/governance/policies",
    "file": "39_Governance_Policy.png",
    "assetPath": "/stitch_ui/39_Governance_Policy.png"
  },
  {
    "id": 40,
    "wave": "Governance & Audit",
    "title": "Audit Log",
    "route": "/audit-log",
    "file": "40_Audit_Log.png",
    "assetPath": "/stitch_ui/40_Audit_Log.png"
  },
  {
    "id": 41,
    "wave": "Governance & Audit",
    "title": "Risk Center",
    "route": "/risk-center",
    "file": "41_Risk_Center.png",
    "assetPath": "/stitch_ui/41_Risk_Center.png"
  },
  {
    "id": 42,
    "wave": "Budget & Reports",
    "title": "Cost Dashboard",
    "route": "/cost",
    "file": "42_Cost_Dashboard.png",
    "assetPath": "/stitch_ui/42_Cost_Dashboard.png"
  },
  {
    "id": 43,
    "wave": "Budget & Reports",
    "title": "Budget Settings",
    "route": "/budget/settings",
    "file": "43_Budget_Settings.png",
    "assetPath": "/stitch_ui/43_Budget_Settings.png"
  },
  {
    "id": 44,
    "wave": "Budget & Reports",
    "title": "Reports Dashboard",
    "route": "/reports",
    "file": "44_Reports_Dashboard.png",
    "assetPath": "/stitch_ui/44_Reports_Dashboard.png"
  },
  {
    "id": 45,
    "wave": "Budget & Reports",
    "title": "Report Builder",
    "route": "/reports/new",
    "file": "45_Report_Builder.png",
    "assetPath": "/stitch_ui/45_Report_Builder.png"
  },
  {
    "id": 46,
    "wave": "Integrations, Workspace, Admin",
    "title": "Integrations Hub",
    "route": "/integrations",
    "file": "46_Integrations.png",
    "assetPath": "/stitch_ui/46_Integrations.png"
  },
  {
    "id": 47,
    "wave": "Integrations, Workspace, Admin",
    "title": "Integration Detail",
    "route": "/integrations/demo-integration",
    "file": "47_Integration_Detail.png",
    "assetPath": "/stitch_ui/47_Integration_Detail.png"
  },
  {
    "id": 48,
    "wave": "Integrations, Workspace, Admin",
    "title": "MCP Server Manager",
    "route": "/mcp",
    "file": "48_MCP_Server_Manager.png",
    "assetPath": "/stitch_ui/48_MCP_Server_Manager.png"
  },
  {
    "id": 49,
    "wave": "Integrations, Workspace, Admin",
    "title": "Workspaces Manager",
    "route": "/workspaces",
    "file": "49_Workspaces_Manager.png",
    "assetPath": "/stitch_ui/49_Workspaces_Manager.png"
  },
  {
    "id": 50,
    "wave": "Integrations, Workspace, Admin",
    "title": "Secrets Manager",
    "route": "/secrets",
    "file": "50_Secrets_Manager.png",
    "assetPath": "/stitch_ui/50_Secrets_Manager.png"
  },
  {
    "id": 51,
    "wave": "Integrations, Workspace, Admin",
    "title": "Team Members",
    "route": "/team",
    "file": "51_Team_Members.png",
    "assetPath": "/stitch_ui/51_Team_Members.png"
  },
  {
    "id": 52,
    "wave": "Integrations, Workspace, Admin",
    "title": "Role & Permission",
    "route": "/roles-permissions",
    "file": "52_Role_Permission.png",
    "assetPath": "/stitch_ui/52_Role_Permission.png"
  },
  {
    "id": 53,
    "wave": "Integrations, Workspace, Admin",
    "title": "System Settings",
    "route": "/settings",
    "file": "53_System_Settings.png",
    "assetPath": "/stitch_ui/53_System_Settings.png"
  },
  {
    "id": 54,
    "wave": "Integrations, Workspace, Admin",
    "title": "Billing / Plan",
    "route": "/billing",
    "file": "54_Billing_Plan.png",
    "assetPath": "/stitch_ui/54_Billing_Plan.png"
  },
  {
    "id": 55,
    "wave": "Integrations, Workspace, Admin",
    "title": "Help / Template Center",
    "route": "/help",
    "file": "55_Help_Template_Center.png",
    "assetPath": "/stitch_ui/55_Help_Template_Center.png"
  },
  {
    "id": 56,
    "wave": "Runtime Governance",
    "title": "Workspace Governance",
    "route": "/workspace",
    "file": "49_Workspaces_Manager.png",
    "assetPath": "/stitch_ui/49_Workspaces_Manager.png"
  },
  {
    "id": 57,
    "wave": "Runtime Governance",
    "title": "Organization Governance",
    "route": "/organization",
    "file": "49_Workspaces_Manager.png",
    "assetPath": "/stitch_ui/49_Workspaces_Manager.png"
  },
  {
    "id": 58,
    "wave": "Runtime Governance",
    "title": "Access Control",
    "route": "/access",
    "file": "52_Role_Permission.png",
    "assetPath": "/stitch_ui/52_Role_Permission.png"
  },
  {
    "id": 59,
    "wave": "Runtime Governance",
    "title": "Policy Inheritance",
    "route": "/policies",
    "file": "39_Governance_Policy.png",
    "assetPath": "/stitch_ui/39_Governance_Policy.png"
  },
  {
    "id": 60,
    "wave": "Runtime Governance",
    "title": "Governance Decision Engine",
    "route": "/governance",
    "file": "39_Governance_Policy.png",
    "assetPath": "/stitch_ui/39_Governance_Policy.png"
  },
  {
    "id": 61,
    "wave": "Runtime Governance",
    "title": "Governance Enforcement",
    "route": "/enforcement",
    "file": "39_Governance_Policy.png",
    "assetPath": "/stitch_ui/39_Governance_Policy.png"
  }
];

export const primaryDemoScreenIds = [8, 20, 21, 23, 30, 32, 34, 37];
