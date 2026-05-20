import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Code2,
  DollarSign,
  FileText,
  Flag,
  PlayCircle,
  ShieldCheck,
  Ticket,
  Timer,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Tone = 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'slate';

export const commercialRoutes = new Set([
  '/command-center',
  '/workforce',
  '/org-chart',
  '/agents/demo-agent',
  '/tickets',
  '/tickets/demo-ticket',
  '/runs/demo-run',
  '/approvals',
]);

export const dashboardKpis = [
  { label: 'AI Agents ho?t d?ng', value: '128', delta: '+12%', tone: 'cyan' as Tone, icon: Bot },
  { label: 'Ticket dang m?', value: '36', delta: '-8%', tone: 'blue' as Tone, icon: Ticket },
  { label: 'Pha duy?t ch? xu ly', value: '14', delta: '-12%', tone: 'purple' as Tone, icon: ShieldCheck },
  { label: 'Chi phi AI thang nay', value: '$18,450.75', delta: '+8.5%', tone: 'blue' as Tone, icon: DollarSign },
  { label: 'T? l? thanh cang', value: '93.6%', delta: '+4.1%', tone: 'green' as Tone, icon: Flag },
  { label: 'C?nh bao r?i ro', value: '7', delta: '+40%', tone: 'red' as Tone, icon: AlertTriangle },
];

export const workforceKpis = [
  { label: 'T?ng Agent', value: '32', delta: '+14%', tone: 'purple' as Tone, icon: Bot },
  { label: 'Dang ho?t d?ng', value: '18', delta: '+8%', tone: 'green' as Tone, icon: PlayCircle },
  { label: 'Dang r?nh', value: '9', delta: '-5%', tone: 'blue' as Tone, icon: Clock3 },
  { label: 'Dang loi', value: '5', delta: '+2%', tone: 'red' as Tone, icon: AlertTriangle },
  { label: 'Chi phi thang nay', value: '$2,840', delta: '+15.2%', tone: 'purple' as Tone, icon: DollarSign },
  { label: 'T? l? thanh cang', value: '91.8%', delta: '+3.4%', tone: 'cyan' as Tone, icon: Flag },
];

export const ticketKpis = [
  { label: 'T?ng ticket', value: '128', tone: 'blue' as Tone, icon: Ticket },
  { label: 'Dang ch?y', value: '14', tone: 'green' as Tone, icon: PlayCircle },
  { label: 'C?n review', value: '9', tone: 'amber' as Tone, icon: Clock3 },
  { label: 'B? chan', value: '6', tone: 'red' as Tone, icon: XCircle },
  { label: 'Failed', value: '3', tone: 'purple' as Tone, icon: AlertTriangle },
  { label: 'Th?i gian TB', value: '2h 18m', tone: 'cyan' as Tone, icon: Timer },
];

export const approvalKpis = [
  { label: 'Ch? phi duy?t', value: '14', tone: 'blue' as Tone, icon: Clock3 },
  { label: 'R?i ro cao', value: '5', tone: 'red' as Tone, icon: ShieldCheck },
  { label: 'Qua han', value: '3', tone: 'amber' as Tone, icon: AlertTriangle },
  { label: 'Da duy?t ham nay', value: '18', tone: 'green' as Tone, icon: CheckCircle2 },
  { label: 'Da t? ch?i ham nay', value: '4', tone: 'red' as Tone, icon: XCircle },
  { label: 'Th?i gian duy?t TB', value: '12m', tone: 'blue' as Tone, icon: Timer },
];

export const healthMetrics = [
  ['Hi?u su?t', 90],
  ['Do tin c?y', 94],
  ['Ch?t lu?ng d?u ra', 93],
  ['T?i uu chi phi', 88],
  ['Tuan the chanh sach', 92],
];

export const activities = [
  ['Hermes QA Agent', 'Hoan t?t audit Module 3', '2 phit tru?c', 'Thanh cang'],
  ['Research Agent', 'Hoan t?t bao cao d?i the', '18 phit tru?c', 'Thanh cang'],
  ['Content Agent', 'T?o 10 k?ch b?n video', '45 phit tru?c', 'Dang xu ly'],
  ['Report Agent', 'T?o bao cao trun', '1 gi? tru?c', 'Thanh cang'],
];

export const strategicGoals = [
  ['Tang lead marketing 30% trong Q2', 72],
  ['T? d?ng haa 60% quy tranh content', 65],
  ['Gi?m 20% thei gian bao cao the cang', 84],
];

export const actionSuggestions = [
  ['Duy?t 3 approval dang ch?', '3 approval c?n b?n xem xat va phi duy?t', '3', 'green' as Tone],
  ['Review 2 ticket failed', '2 ticket c?n duoc ki?m tra va xu ly', '2', 'red' as Tone],
  ['T?i uu budget cho Research Agent', 'Chi phi thang nay cao hon 15%', '', 'blue' as Tone],
  ['T?o goal moi cho chien dich thang t?i', 'Dot m?c tieu va KPI cho chien dich moi', '', 'purple' as Tone],
];

export const alerts = [
  ['Chi phi AI ca the vu?t ngan sach', 'Du bao vu?t 12% so v?i ngan sach thang', 'Cao', 'red' as Tone],
  ['2 agent ca t? l? loi tang cao', 'T? l? loi tang >15% trong 7 ngay qua', 'Trung binh', 'amber' as Tone],
  ['3 approval qua han', 'Approval da qua han c?n xu ly g?p', 'Trung binh', 'amber' as Tone],
  ['1 integration m?t k?t n?i', 'Webhook CRM da ng?t k?t n?i 2 gi?', 'Thap', 'amber' as Tone],
];

export const agents = [
  { name: 'Hermes QA Agent', role: 'QA & UAT', team: 'Engineering', status: 'Running', load: 76, score: 97.2, tone: 'purple' as Tone },
  { name: 'Research Agent', role: 'Research & Insight', team: 'Marketing', status: 'Running', load: 66, score: 95.6, tone: 'green' as Tone },
  { name: 'Content Agent', role: 'Content Production', team: 'Marketing', status: 'Busy', load: 89, score: 93.4, tone: 'amber' as Tone },
  { name: 'Report Agent', role: 'Reporting', team: 'Operations', status: 'Running', load: 57, score: 92.8, tone: 'cyan' as Tone },
  { name: 'CRM Agent', role: 'CRM Automation', team: 'Sales', status: 'Waiting', load: 48, score: 91.1, tone: 'amber' as Tone },
  { name: 'Automation Agent', role: 'Workflow automation', team: 'Operations', status: 'Running', load: 61, score: 90.9, tone: 'cyan' as Tone },
  { name: 'Risk Monitor Agent', role: 'Budget alerts', team: 'Governance', status: 'Running', load: 41, score: 90.2, tone: 'green' as Tone },
  { name: 'Documentation Agent', role: 'Waiting for review', team: 'Engineering', status: 'Idle', load: 24, score: 88.4, tone: 'slate' as Tone },
];

export const departments = [
  ['Product & Coding', 36, 'green' as Tone],
  ['Marketing & Content', 28, 'blue' as Tone],
  ['Sales & CRM', 16, 'amber' as Tone],
  ['Research', 12, 'purple' as Tone],
  ['Operations', 8, 'cyan' as Tone],
];

export const tickets = [
  { title: 'SEO Topic Cluster Planning - Q2', project: 'GrowthOS V2', agent: 'Content Strategist', column: 'Backlog', priority: 'Trung binh', risk: 'Thap', cost: '$0.15' },
  { title: 'Competitor Content Analysis', project: 'Marketing Content Factory', agent: 'Research Agent', column: 'Backlog', priority: 'Thap', risk: 'Thap', cost: '$0.10' },
  { title: 'Weekly Performance Report Automation', project: 'GrowthOS V2', agent: 'Data Analyst Agent', column: 'Ready', priority: 'Trung binh', risk: 'Thap', cost: '$0.18' },
  { title: 'CRM Data Cleanup & Deduplication', project: 'CRM Automation Setup', agent: 'Automation Agent', column: 'Assigned', priority: 'Cao', risk: 'Trung binh', cost: '$0.22' },
  { title: 'Audit Module 3 - Landing & Lead Capture', project: 'GrowthOS V2', agent: 'Hermes QA Agent', column: 'Running', priority: 'Cao', risk: 'Trung binh', cost: '$0.80' },
  { title: 'Generate 10 TikTok Scripts', project: 'Marketing Content Factory', agent: 'Content Agent', column: 'Needs Review', priority: 'Trung binh', risk: 'Thap', cost: '$0.12' },
  { title: 'Design System Components Library', project: 'GrowthOS V2', agent: 'Design Agent', column: 'Done', priority: 'Thap', risk: 'Thap', cost: '$0.07' },
  { title: 'Fix CRM Lead Source Mapping', project: 'CRM Automation Setup', agent: 'Automation Agent', column: 'Blocked', priority: 'Cao', risk: 'Cao', cost: '$0.20' },
  { title: 'Bulk Email Campaign Execution', project: 'Marketing Content Factory', agent: 'Email Agent', column: 'Failed', priority: 'Trung binh', risk: 'Trung binh', cost: '$0.11' },
];

export const ticketColumns = ['Backlog', 'Ready', 'Assigned', 'Running', 'Needs Review', 'Done', 'Blocked', 'Failed'];

export const runSteps = [
  ['Run started', 'Success', '09:42:13', '1s', '$0.000'],
  ['Loaded ticket context', 'Success', '09:42:14', '2s', '$0.000'],
  ['Loaded skill growthos-module-uat', 'Success', '09:42:16', '1s', '$0.000'],
  ['Read PROJECT_BIBLE.md', 'Success', '09:42:18', '3s', '$0.002'],
  ['Read module architecture', 'Success', '09:42:21', '4s', '$0.003'],
  ['Ran build', 'Success', '09:42:25', '1m 42s', '$0.018'],
  ['Analyzed routes', 'Warning', '09:44:07', '22s', '$0.006'],
  ['Generating QA report', 'Running', '09:44:29', '-', '-'],
];

export const toolCalls: [string, string, string, string, string, LucideIcon][] = [
  ['Read File', 'PROJECT_BIBLE.md', 'Success', '3s', '$0.002', FileText],
  ['Read File', 'module-3-architecture.md', 'Success', '4s', '$0.003', FileText],
  ['Run Build', 'npm run build', 'Success', '1m 42s', '$0.018', Code2],
  ['Analyze Route', '/module-3/leads', 'Warning', '22s', '$0.006', Wrench],
  ['Generate Artifact', 'QA_Report_Module3.md', 'Running', '-', '-', FileText],
];

export const transcript = [
  ['09:42:13', 'INFO', 'Run started by Hermes QA Agent'],
  ['09:42:14', 'INFO', 'Loading ticket context...'],
  ['09:42:16', 'INFO', 'Loading skill: growthos-module-uat v1.2'],
  ['09:42:18', 'TOOL', 'read_file -> PROJECT_BIBLE.md'],
  ['09:42:21', 'TOOL', 'read_file -> module-3-architecture.md'],
  ['09:42:25', 'TOOL', 'run_build -> npm run build'],
  ['09:44:07', 'WARN', 'analyze_route -> /module-3/leads missing redirect'],
  ['09:44:29', 'INFO', 'Generating QA report...'],
  ['09:44:31', 'INFO', 'Collecting evidence and screenshots'],
  ['09:44:31', 'INFO', 'Writing QA report...'],
];

export const approvals = [
  { title: 'Hermes QA Agent xin ch?y npm test', agent: 'Hermes QA Agent', project: 'GrowthOS V2', ticket: 'Audit Module 3 - Landing & Lead Capture', risk: 'Medium', impact: 'Local workspace', requested: '8 phit tru?c', tone: 'blue' as Tone },
  { title: 'Automation Agent mu?n s?a lead-source-mapping.ts', agent: 'Automation Agent', project: 'CRM Automation Setup', ticket: 'Mapping ngu?n lead', risk: 'High', impact: 'Source code', requested: '18 phit tru?c', tone: 'purple' as Tone },
  { title: 'CRM Agent mu?n g?i email nurturing cho 120 leads', agent: 'CRM Agent', project: 'CRM Nurturing', ticket: 'Email campaign', risk: 'High', impact: 'Customer communication', requested: '32 phit tru?c', tone: 'amber' as Tone },
  { title: 'Research Agent d? xu?t tang budget tham $30', agent: 'Research Agent', project: 'Market Research', ticket: 'Budget optimization', risk: 'Medium', impact: 'AI spend', requested: '1 gi? tru?c', tone: 'green' as Tone },
  { title: 'Data Agent mu?n ghi d? li?u vao production DB', agent: 'Data Agent', project: 'Analytics Pipeline', ticket: 'Database write', risk: 'High', impact: 'Production database', requested: '2 gi? tru?c', tone: 'cyan' as Tone },
];

export const navCounts = {
  Inbox: 12,
  Tickets: 24,
  Approvals: 7,
};
