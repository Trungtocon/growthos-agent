import {
  DEMO_AGENT_ID,
  DEMO_APPROVAL_ID,
  DEMO_RUN_ID,
  DEMO_TICKET_ID,
} from '../data/demo-fixtures';
import { mergeActivityTimeline } from '../services/activity-service';
import { getWorkflowData, getWorkflowState } from '../state/workflow-engine';
import type { Activity, Agent, Approval, Artifact, CostBreakdown, Goal, Metric, Run, Ticket } from './types';

export interface KpiViewModel {
  label: string;
  value: string;
  delta?: string;
  tone: Metric['tone'];
}

export interface AgentCardViewModel {
  id: string;
  name: string;
  role: string;
  status: string;
  load: number;
  score: number;
  tone: Metric['tone'];
  cost: string;
}

export interface TicketCardViewModel {
  id: string;
  title: string;
  project: string;
  agent: string;
  column: string;
  priority: string;
  risk: string;
  cost: string;
}

export interface ApprovalQueueViewModel {
  id: string;
  title: string;
  status: Approval['status'];
  agent: string;
  project: string;
  ticket: string;
  risk: string;
  impact: string;
  requested: string;
  tone: Metric['tone'];
}

export interface RunStepViewModel {
  name: string;
  status: string;
  time: string;
  duration: string;
  cost: string;
}

export interface ToolCallViewModel {
  name: string;
  target: string;
  status: string;
  duration: string;
  cost: string;
}

export interface ArtifactRowViewModel {
  id: string;
  name: string;
  type: Artifact['type'];
  runId: string;
  ticketCode: string;
  ticketTitle: string;
  agentName: string;
  status: string;
  risk: string;
  createdAt: string;
  size: string;
}

function currency(value: number): string {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: value % 1 === 0 ? 0 : 2 })}`;
}

function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    running: 'Running',
    busy: 'Busy',
    waiting: 'Waiting',
    idle: 'Idle',
    failed: 'Failed',
    paused: 'Paused',
    todo: 'Ready',
    in_progress: 'Running',
    review: 'Needs Review',
    done: 'Done',
    blocked: 'Blocked',
    pending: 'Pending',
    warning: 'Warning',
    success: 'Success',
  };
  return labels[value] ?? value;
}

function ticketColumn(status: Ticket['status']): string {
  const columns: Record<Ticket['status'], string> = {
    todo: 'Backlog',
    in_progress: 'Running',
    review: 'Needs Review',
    done: 'Done',
    blocked: 'Blocked',
    failed: 'Failed',
  };
  return columns[status];
}

function priorityLabel(priority: Ticket['priority']): string {
  return priority === 'high' || priority === 'critical' ? 'Cao' : priority === 'low' ? 'Thap' : 'Trung binh';
}

function riskLabel(risk: Ticket['riskLevel'] | Approval['severity']): string {
  return risk === 'high' || risk === 'critical' ? 'High' : risk === 'low' ? 'Low' : 'Medium';
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '-';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  return date.toISOString().slice(11, 19);
}

function agentTone(agent: Agent): Metric['tone'] {
  if (agent.id === DEMO_AGENT_ID) return 'purple';
  if (agent.riskLevel === 'high' || agent.status === 'failed') return 'red';
  if (agent.status === 'busy') return 'purple';
  if (agent.status === 'waiting') return 'amber';
  if (agent.status === 'idle') return 'slate';
  if (agent.role.toLowerCase().includes('research')) return 'cyan';
  return 'blue';
}

function currentData() {
  return getWorkflowData();
}

function findAgent(id: string): Agent {
  const agent = currentData().agents.find((item) => item.id === id);
  if (!agent) throw new Error(`Missing demo agent: ${id}`);
  return agent;
}

function findTicket(id: string): Ticket {
  const ticket = currentData().tickets.find((item) => item.id === id);
  if (!ticket) throw new Error(`Missing demo ticket: ${id}`);
  return ticket;
}

function findRun(id: string): Run {
  const run = currentData().runs.find((item) => item.id === id);
  if (!run) throw new Error(`Missing demo run: ${id}`);
  return run;
}

function artifactRows(): ArtifactRowViewModel[] {
  const data = currentData();
  return data.runs.flatMap((run, runIndex) => {
    const ticket = findTicket(run.ticketId);
    const agent = findAgent(run.agentId);
    return run.artifacts.map((artifact, artifactIndex) => ({
      id: artifact.id,
      name: artifact.name,
      type: artifact.type,
      runId: run.id,
      ticketCode: ticket.code,
      ticketTitle: ticket.title,
      agentName: agent.name,
      status: statusLabel(run.status),
      risk: riskLabel(run.riskLevel),
      createdAt: artifact.createdAt,
      size: `${Math.max(12, (runIndex + 1) * 18 + artifactIndex * 11)} KB`,
    }));
  });
}

function ticketToCard(ticket: Ticket): TicketCardViewModel {
  const agent = findAgent(ticket.ownerAgentId);
  return {
    id: ticket.id,
    title: ticket.title,
    project: ticket.relatedGoalId ? 'GrowthOS V2' : 'Operations',
    agent: agent.name,
    column: ticketColumn(ticket.status),
    priority: priorityLabel(ticket.priority),
    risk: riskLabel(ticket.riskLevel),
    cost: currency(currentData().runs.find((run) => run.ticketId === ticket.id)?.cost ?? 0.12),
  };
}

function agentToCard(agent: Agent): AgentCardViewModel {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    status: statusLabel(agent.status),
    load: Math.min(92, Math.max(24, agent.currentTicketIds.length * 18 + agent.currentRunIds.length * 22 + 40)),
    score: agent.successRate,
    tone: agentTone(agent),
    cost: currency(agent.costMonthToDate),
  };
}

function approvalToQueueRow(approval: Approval): ApprovalQueueViewModel {
  const ticket = findTicket(approval.ticketId);
  const agent = findAgent(approval.agentId);
  return {
    id: approval.id,
    title: approval.title,
    status: approval.status,
    agent: agent.name,
    project: ticket.relatedGoalId ? 'GrowthOS V2' : 'Operations',
    ticket: ticket.title,
    risk: riskLabel(approval.severity),
    impact: approval.severity === 'high' ? 'Source code' : 'Local workspace',
    requested: approval.id === DEMO_APPROVAL_ID ? '8 phut truoc' : '18 phut truoc',
    tone: approval.severity === 'high' ? 'purple' : approval.severity === 'medium' ? 'blue' : 'green',
  };
}

export function selectCommandCenterViewModel() {
  const data = currentData();
  const openTickets = data.tickets.filter((ticket) => ticket.status !== 'done').length;
  const pendingApprovals = data.approvals.filter((approval) => approval.status === 'pending').length;
  const successRate = data.agents.reduce((sum, agent) => sum + agent.successRate, 0) / data.agents.length;
  const riskWarnings = data.tickets.filter((ticket) => ticket.riskLevel === 'high' || ticket.status === 'failed' || ticket.status === 'blocked').length + data.approvals.filter((approval) => approval.severity === 'high').length;

  return {
    workspace: data.workspace,
    user: data.currentUser,
    kpis: [
      { label: 'AI Agents hoat dong', value: String(data.agents.length), delta: '+12%', tone: 'cyan' },
      { label: 'Ticket dang mo', value: String(openTickets), delta: '-8%', tone: 'blue' },
      { label: 'Phe duyet cho xu ly', value: String(pendingApprovals), delta: '-12%', tone: 'purple' },
      { label: 'Chi phi AI thang nay', value: currency(data.costBreakdown.total), delta: '+8.5%', tone: 'blue' },
      { label: 'Ty le thanh cong', value: `${successRate.toFixed(1)}%`, delta: '+4.1%', tone: 'green' },
      { label: 'Canh bao rui ro', value: String(riskWarnings), delta: '+40%', tone: 'red' },
    ] satisfies KpiViewModel[],
    goals: data.goals,
    activities: getRecentActivities(),
    costBreakdown: data.costBreakdown,
    agents: data.agents,
    tickets: data.tickets,
    approvals: data.approvals,
  };
}

export function selectWorkforceViewModel() {
  const data = currentData();
  const active = data.agents.filter((agent) => ['active', 'running', 'busy'].includes(agent.status)).length;
  const waiting = data.agents.filter((agent) => ['waiting', 'idle'].includes(agent.status)).length;
  const failed = data.agents.filter((agent) => agent.status === 'failed').length;
  const successRate = data.agents.reduce((sum, agent) => sum + agent.successRate, 0) / data.agents.length;

  return {
    agents: data.agents,
    agentCards: data.agents.map(agentToCard),
    tickets: data.tickets,
    runs: data.runs,
    kpis: [
      { label: 'Tong Agent', value: String(data.agents.length), delta: '+14%', tone: 'purple' },
      { label: 'Dang hoat dong', value: String(active), delta: '+8%', tone: 'green' },
      { label: 'Dang ranh', value: String(waiting), delta: '-5%', tone: 'blue' },
      { label: 'Dang loi', value: String(failed), delta: '+2%', tone: 'red' },
      { label: 'Chi phi thang nay', value: currency(data.agents.reduce((sum, agent) => sum + agent.costMonthToDate, 0)), delta: '+15.2%', tone: 'purple' },
      { label: 'Ty le thanh cong', value: `${successRate.toFixed(1)}%`, delta: '+3.4%', tone: 'cyan' },
    ] satisfies KpiViewModel[],
  };
}

export function selectOrgChartViewModel() {
  const data = currentData();
  return {
    agents: data.agents,
    agentCards: data.agents.map(agentToCard),
    rootAgent: data.agents[0],
    detailAgent: data.agents[0],
  };
}

export function selectAgentDetailViewModel(agentId = DEMO_AGENT_ID) {
  const data = currentData();
  const agent = findAgent(agentId);
  const tickets = data.tickets.filter((ticket) => ticket.ownerAgentId === agent.id);
  const runs = data.runs.filter((run) => run.agentId === agent.id);
  return {
    agent,
    tickets,
    runs,
    kpis: [
      { label: 'Success rate', value: `${agent.successRate.toFixed(1)}%`, delta: '+3.1%', tone: 'green' },
      { label: 'Health score', value: `${agent.healthScore}/100`, delta: '+2', tone: 'blue' },
      { label: 'Cost MTD', value: currency(agent.costMonthToDate), delta: '+8%', tone: 'purple' },
      { label: 'Open tickets', value: String(tickets.length), delta: '-1', tone: 'cyan' },
      { label: 'Risk level', value: riskLabel(agent.riskLevel), delta: 'stable', tone: agent.riskLevel === 'high' ? 'red' : 'amber' },
      { label: 'Toolsets', value: String(agent.tools.length), delta: '+1', tone: 'blue' },
    ] satisfies KpiViewModel[],
  };
}

export function selectTicketsBoardViewModel() {
  const data = currentData();
  const cards = data.tickets.map(ticketToCard);
  const columns = ['Backlog', 'Ready', 'Assigned', 'Running', 'Needs Review', 'Done', 'Blocked', 'Failed'];
  return {
    tickets: cards,
    columns,
    rawTickets: data.tickets,
    kpis: [
      { label: 'Tong ticket', value: String(data.tickets.length), tone: 'blue' },
      { label: 'Dang chay', value: String(data.tickets.filter((ticket) => ticket.status === 'in_progress').length), tone: 'green' },
      { label: 'Can review', value: String(data.tickets.filter((ticket) => ticket.status === 'review').length), tone: 'amber' },
      { label: 'Bi chan', value: String(data.tickets.filter((ticket) => ticket.status === 'blocked').length), tone: 'red' },
      { label: 'Failed', value: String(data.tickets.filter((ticket) => ticket.status === 'failed').length), tone: 'purple' },
      { label: 'Thoi gian TB', value: '2h 18m', tone: 'cyan' },
    ] satisfies KpiViewModel[],
  };
}

export function selectTicketsListViewModel() {
  const data = currentData();
  const rows = data.tickets.map((ticket) => {
    const agent = findAgent(ticket.ownerAgentId);
    const run = ticket.runId ? data.runs.find((item) => item.id === ticket.runId) : undefined;
    const approval = ticket.approvalId ? data.approvals.find((item) => item.id === ticket.approvalId) : undefined;
    return {
      id: ticket.id,
      code: ticket.code,
      title: ticket.title,
      status: statusLabel(ticket.status),
      priority: priorityLabel(ticket.priority),
      risk: riskLabel(ticket.riskLevel),
      owner: agent.name,
      tags: ticket.tags,
      updatedAt: ticket.updatedAt.slice(0, 10),
      dueAt: ticket.dueAt?.slice(0, 10) ?? 'No due date',
      runStatus: run ? statusLabel(run.status) : 'No run',
      approvalStatus: approval ? statusLabel(approval.status) : 'No approval',
    };
  });
  return {
    rows,
    agents: data.agents,
    kpis: [
      { label: 'Tickets', value: String(data.tickets.length), tone: 'blue' },
      { label: 'Running', value: String(data.tickets.filter((ticket) => ticket.status === 'in_progress').length), tone: 'cyan' },
      { label: 'Review', value: String(data.tickets.filter((ticket) => ticket.status === 'review').length), tone: 'amber' },
      { label: 'Done', value: String(data.tickets.filter((ticket) => ticket.status === 'done').length), tone: 'green' },
    ] satisfies KpiViewModel[],
  };
}

export function selectCreateTicketViewModel() {
  const data = currentData();
  const allTags = [...new Set(data.tickets.flatMap((ticket) => ticket.tags))];
  return {
    requester: data.currentUser,
    agents: data.agents,
    goals: data.goals,
    tags: allTags,
    templates: data.goals.map((goal) => ({
      id: `ticket-template-${goal.id}`,
      title: `${goal.title} execution ticket`,
      description: goal.description,
      owner: findAgent(goal.ownerId).name,
      criteria: [
        'Define scope and expected artifact',
        'Assign an owner agent and tool policy',
        'Create review checkpoint before completion',
      ],
    })),
    recentTickets: data.tickets.slice(0, 5),
  };
}

export function selectTicketDetailViewModel(ticketId = DEMO_TICKET_ID) {
  const ticket = findTicket(ticketId);
  const agent = findAgent(ticket.ownerAgentId);
  const run = ticket.runId ? findRun(ticket.runId) : undefined;
  const approval = ticket.approvalId ? currentData().approvals.find((item) => item.id === ticket.approvalId) : undefined;
  const events = getWorkflowState().events.filter((event) => event.entityId === ticket.id || event.entityId === ticket.runId || event.entityId === ticket.approvalId);
  return { ticket, agent, run, approval, criteria: ticket.acceptanceCriteria, timeline: events };
}

export function selectRunConsoleViewModel(runId = DEMO_RUN_ID) {
  const run = findRun(runId);
  const ticket = findTicket(run.ticketId);
  const agent = findAgent(run.agentId);
  const events = getWorkflowState().events.filter((event) => event.entityId === run.id || event.entityId === ticket.id);
  return {
    run,
    ticket,
    agent,
    artifacts: run.artifacts,
    timelineRows: run.steps.map((step): RunStepViewModel => ({
      name: step.name,
      status: statusLabel(step.status),
      time: timeLabel(step.startedAt),
      duration: formatDuration(step.durationSeconds),
      cost: step.cost === 0 ? '$0.000' : `$${step.cost.toFixed(3)}`,
    })),
    toolCallRows: run.toolCalls.map((tool): ToolCallViewModel => ({
      name: tool.toolName,
      target: tool.inputSummary,
      status: statusLabel(tool.status),
      duration: tool.durationMs ? formatDuration(Math.round(tool.durationMs / 1000)) : '-',
      cost: tool.cost === 0 ? '-' : `$${tool.cost.toFixed(3)}`,
    })),
    workflowTimeline: events,
  };
}

export function selectApprovalCenterViewModel() {
  const data = currentData();
  const queueRows = data.approvals.map(approvalToQueueRow);
  const highRisk = data.approvals.filter((approval) => approval.severity === 'high').length;
  const pending = data.approvals.filter((approval) => approval.status === 'pending').length;
  return {
    approvals: queueRows,
    rawApprovals: data.approvals,
    selectedApproval: queueRows[0],
    kpis: [
      { label: 'Cho phe duyet', value: String(pending), tone: 'blue' },
      { label: 'Rui ro cao', value: String(highRisk), tone: 'red' },
      { label: 'Qua han', value: '3', tone: 'amber' },
      { label: 'Da duyet hom nay', value: '18', tone: 'green' },
      { label: 'Da tu choi hom nay', value: '4', tone: 'red' },
      { label: 'Thoi gian duyet TB', value: '12m', tone: 'blue' },
    ] satisfies KpiViewModel[],
  };
}

export function selectApprovalDetailViewModel(approvalId = DEMO_APPROVAL_ID) {
  const data = currentData();
  const approval = data.approvals.find((item) => item.id === approvalId) ?? data.approvals[0];
  const ticket = findTicket(approval.ticketId);
  const agent = findAgent(approval.agentId);
  const run = approval.runId ? data.runs.find((item) => item.id === approval.runId) : undefined;
  const events = getWorkflowState().events.filter((event) => [approval.id, approval.ticketId, approval.runId].includes(event.entityId));
  return {
    approval,
    ticket,
    agent,
    run,
    events,
    kpis: [
      { label: 'Severity', value: riskLabel(approval.severity), tone: approval.severity === 'high' || approval.severity === 'critical' ? 'red' : 'amber' },
      { label: 'Status', value: statusLabel(approval.status), tone: approval.status === 'pending' ? 'amber' : approval.status === 'approved' ? 'green' : 'red' },
      { label: 'Audit trail', value: String(approval.auditTrail.length + events.length), tone: 'blue' },
      { label: 'Linked run', value: run ? statusLabel(run.status) : 'None', tone: run?.status === 'failed' ? 'red' : 'cyan' },
    ] satisfies KpiViewModel[],
  };
}

export function selectGovernancePoliciesViewModel() {
  const data = currentData();
  const tools = [...new Set(data.agents.flatMap((agent) => agent.tools))];
  const highRiskApprovals = data.approvals.filter((approval) => approval.severity === 'high' || approval.severity === 'critical');
  return {
    policies: [
      { id: 'policy-approval', name: 'Human approval for high-risk actions', owner: data.currentUser.name, status: 'Enforced', coverage: 96, severity: 'high' },
      { id: 'policy-terminal', name: 'Terminal and filesystem write guardrails', owner: 'Hermes QA Agent', status: 'Enforced', coverage: 91, severity: 'high' },
      { id: 'policy-webhook', name: 'External webhook allowlist', owner: 'Growth Strategy Agent', status: 'Review', coverage: 78, severity: 'medium' },
      { id: 'policy-evidence', name: 'Evidence retention and audit logging', owner: 'Report Agent', status: 'Enforced', coverage: 88, severity: 'medium' },
    ],
    rules: tools.map((tool, index) => ({
      id: `rule-${index + 1}`,
      tool,
      action: index % 2 === 0 ? 'Require approval' : 'Allow with logging',
      risk: index % 3 === 0 ? 'High' : index % 3 === 1 ? 'Medium' : 'Low',
    })),
    kpis: [
      { label: 'Policies', value: '4', tone: 'blue' },
      { label: 'Enforced', value: '3', tone: 'green' },
      { label: 'Review', value: '1', tone: 'amber' },
      { label: 'High risk approvals', value: String(highRiskApprovals.length), tone: 'red' },
    ] satisfies KpiViewModel[],
  };
}

export function selectAuditLogViewModel() {
  const data = currentData();
  const workflowEvents = getWorkflowState().events;
  const approvalEvents = data.approvals.flatMap((approval) => approval.auditTrail.map((entry) => ({
    id: entry.id,
    actor: data.agents.find((agent) => agent.id === entry.actorId)?.name ?? data.currentUser.name,
    action: entry.action,
    entity: approval.title,
    status: statusLabel(approval.status),
    createdAt: entry.createdAt,
    severity: approval.severity,
  })));
  const activityEvents = data.activities.map((activity) => ({
    id: activity.id,
    actor: activity.actorAgentId ? findAgent(activity.actorAgentId).name : data.currentUser.name,
    action: activity.title,
    entity: activity.description,
    status: statusLabel(activity.status),
    createdAt: activity.createdAt,
    severity: activity.status === 'failed' ? 'high' : activity.status === 'warning' ? 'medium' : 'low',
  }));
  return {
    rows: [...approvalEvents, ...activityEvents, ...workflowEvents.map((event) => ({
      id: event.id,
      actor: event.actorId,
      action: event.command,
      entity: event.entityId,
      status: statusLabel(event.status),
      createdAt: event.createdAt,
      severity: event.status === 'failed' ? 'high' : 'medium',
    }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    kpis: [
      { label: 'Audit rows', value: String(approvalEvents.length + activityEvents.length + workflowEvents.length), tone: 'blue' },
      { label: 'Approvals', value: String(data.approvals.length), tone: 'amber' },
      { label: 'Activities', value: String(data.activities.length), tone: 'cyan' },
      { label: 'Failures', value: String(data.activities.filter((activity) => activity.status === 'failed').length), tone: 'red' },
    ] satisfies KpiViewModel[],
  };
}

export function selectRiskCenterViewModel() {
  const data = currentData();
  const riskyAgents = data.agents.filter((agent) => agent.riskLevel === 'high' || agent.riskLevel === 'critical');
  const riskyTickets = data.tickets.filter((ticket) => ticket.riskLevel === 'high' || ticket.riskLevel === 'critical');
  const riskyRuns = data.runs.filter((run) => run.riskLevel === 'high' || run.status === 'failed');
  return {
    riskyAgents,
    riskyTickets,
    riskyRuns,
    controls: [
      { label: 'Approval queue coverage', value: 92, tone: 'green' },
      { label: 'Tool policy coverage', value: 86, tone: 'blue' },
      { label: 'Artifact evidence coverage', value: 78, tone: 'amber' },
      { label: 'Failed run follow-up', value: 64, tone: 'red' },
    ],
    kpis: [
      { label: 'Risk items', value: String(riskyAgents.length + riskyTickets.length + riskyRuns.length), tone: 'red' },
      { label: 'High risk tickets', value: String(riskyTickets.length), tone: 'amber' },
      { label: 'Risky agents', value: String(riskyAgents.length), tone: 'purple' },
      { label: 'Failed runs', value: String(data.runs.filter((run) => run.status === 'failed').length), tone: 'red' },
    ] satisfies KpiViewModel[],
  };
}

export function selectCompanyOverviewViewModel() {
  const data = currentData();
  const activeAgents = data.agents.filter((agent) => ['active', 'running', 'busy'].includes(agent.status)).length;
  const openTickets = data.tickets.filter((ticket) => ticket.status !== 'done').length;
  const pendingApprovals = data.approvals.filter((approval) => approval.status === 'pending').length;

  return {
    workspace: data.workspace,
    currentUser: data.currentUser,
    goals: data.goals,
    agents: data.agents,
    tickets: data.tickets,
    activities: getRecentActivities(),
    kpis: [
      { label: 'AI budget', value: currency(data.workspace.aiBudgetMonthly), tone: 'blue' },
      { label: 'Active agents', value: String(activeAgents), tone: 'green' },
      { label: 'Open tickets', value: String(openTickets), tone: 'cyan' },
      { label: 'Pending approvals', value: String(pendingApprovals), tone: 'amber' },
    ] satisfies KpiViewModel[],
  };
}

export function selectCompanySettingsViewModel() {
  const data = currentData();
  return {
    workspace: data.workspace,
    currentUser: data.currentUser,
    policies: [
      { label: 'Approval required for production changes', value: 'Enabled', tone: 'green' },
      { label: 'Budget alert threshold', value: '80%', tone: 'amber' },
      { label: 'External tool access', value: 'Restricted', tone: 'blue' },
      { label: 'Audit retention', value: '180 days', tone: 'purple' },
    ],
    members: [
      data.currentUser,
      { id: 'user-ops', name: 'Operations Lead', email: 'ops@demo-company.local', role: 'operator' as const },
      { id: 'user-review', name: 'Risk Reviewer', email: 'risk@demo-company.local', role: 'reviewer' as const },
    ],
  };
}

export function selectGoalsDashboardViewModel() {
  const data = currentData();
  const linkedTickets = data.goals.reduce((sum, goal) => sum + goal.linkedTicketIds.length, 0);
  const averageProgress = data.goals.reduce((sum, goal) => sum + goal.progress, 0) / data.goals.length;
  return {
    goals: data.goals,
    tickets: data.tickets,
    kpis: [
      { label: 'Active goals', value: String(data.goals.length), tone: 'blue' },
      { label: 'Average progress', value: `${averageProgress.toFixed(0)}%`, tone: 'green' },
      { label: 'Linked tickets', value: String(linkedTickets), tone: 'cyan' },
      { label: 'At risk', value: String(data.goals.filter((goal) => goal.progress < 70).length), tone: 'amber' },
    ] satisfies KpiViewModel[],
  };
}

export function selectGoalDetailViewModel(goalId = 'goal-lead-growth') {
  const data = currentData();
  const goal = data.goals.find((item) => item.id === goalId) ?? data.goals[0];
  const owner = findAgent(goal.ownerId);
  const tickets = data.tickets.filter((ticket) => goal.linkedTicketIds.includes(ticket.id));
  const activities = getRecentActivities().filter((activity) => activity.type === 'goal' || (activity.relatedTicketId && goal.linkedTicketIds.includes(activity.relatedTicketId)));
  return { goal, owner, tickets, activities };
}

export function selectCreateGoalViewModel() {
  const data = currentData();
  return {
    workspace: data.workspace,
    agents: data.agents,
    templates: [
      'Increase qualified leads',
      'Reduce reporting cycle time',
      'Automate content operations',
      'Improve customer response SLA',
    ],
  };
}

function projectRows() {
  const data = currentData();
  return data.goals.map((goal, index) => {
    const tickets = data.tickets.filter((ticket) => goal.linkedTicketIds.includes(ticket.id));
    const owner = findAgent(goal.ownerId);
    return {
      id: `project-${goal.id}`,
      title: index === 0 ? 'GrowthOS V2 Launch' : index === 1 ? 'Content Operations Automation' : 'Executive Reporting System',
      description: goal.description,
      status: goal.progress > 80 ? 'On track' : goal.progress > 65 ? 'Needs attention' : 'At risk',
      progress: goal.progress,
      owner: owner.name,
      tickets,
      dueAt: goal.dueAt,
    };
  });
}

export function selectProjectsListViewModel() {
  const projects = projectRows();
  return {
    projects,
    kpis: [
      { label: 'Projects', value: String(projects.length), tone: 'blue' },
      { label: 'On track', value: String(projects.filter((project) => project.status === 'On track').length), tone: 'green' },
      { label: 'Needs attention', value: String(projects.filter((project) => project.status !== 'On track').length), tone: 'amber' },
      { label: 'Linked tickets', value: String(projects.reduce((sum, project) => sum + project.tickets.length, 0)), tone: 'cyan' },
    ] satisfies KpiViewModel[],
  };
}

export function selectProjectDetailViewModel(projectId = 'project-goal-lead-growth') {
  const projects = projectRows();
  const project = projects.find((item) => item.id === projectId) ?? projects[0];
  return {
    project,
    milestones: [
      { title: 'Strategy brief', status: 'Done', progress: 100 },
      { title: 'Agent execution plan', status: 'Running', progress: Math.max(45, project.progress - 12) },
      { title: 'Review and approval', status: 'Pending', progress: Math.max(20, project.progress - 28) },
      { title: 'Launch report', status: 'Planned', progress: 10 },
    ],
  };
}

export function selectCreateProjectViewModel() {
  const data = currentData();
  return {
    workspace: data.workspace,
    goals: data.goals,
    agents: data.agents,
    templates: ['Growth campaign', 'Workflow automation', 'Research sprint', 'Executive reporting'],
  };
}

export function selectAgentsListViewModel() {
  const data = currentData();
  const cards = data.agents.map(agentToCard);
  return {
    agents: data.agents,
    agentCards: cards,
    tickets: data.tickets,
    kpis: [
      { label: 'Total agents', value: String(data.agents.length), tone: 'blue' },
      { label: 'Active', value: String(data.agents.filter((agent) => ['active', 'running', 'busy'].includes(agent.status)).length), tone: 'green' },
      { label: 'Waiting', value: String(data.agents.filter((agent) => ['waiting', 'idle'].includes(agent.status)).length), tone: 'amber' },
      { label: 'Avg success', value: `${(data.agents.reduce((sum, agent) => sum + agent.successRate, 0) / data.agents.length).toFixed(1)}%`, tone: 'cyan' },
    ] satisfies KpiViewModel[],
  };
}

export function selectCreateAgentViewModel() {
  const data = currentData();
  return {
    workspace: data.workspace,
    templates: [
      { name: 'Research Analyst', role: 'Research', tools: ['Web research', 'Source validation', 'Report draft'] },
      { name: 'QA Operator', role: 'Quality', tools: ['Browser QA', 'Console audit', 'Evidence capture'] },
      { name: 'Content Producer', role: 'Content', tools: ['Briefing', 'Drafting', 'Publishing handoff'] },
      { name: 'Growth Strategist', role: 'Strategy', tools: ['CRM analysis', 'Campaign planning', 'Budget guardrails'] },
    ],
    recommendedSkills: [...new Set(data.agents.flatMap((agent) => agent.skills))],
  };
}

export function selectAgentTemplatesViewModel() {
  const data = currentData();
  return {
    templates: data.agents.map((agent) => ({
      id: `template-${agent.id}`,
      name: `${agent.role} Template`,
      agentName: agent.name,
      role: agent.role,
      skills: agent.skills,
      tools: agent.tools,
      successRate: agent.successRate,
      tone: agentTone(agent),
    })),
    categories: ['All', 'Research', 'Content', 'QA', 'Reporting', 'Growth'],
  };
}

export function selectAgentPerformanceViewModel() {
  const data = currentData();
  const rows = data.agents.map((agent) => {
    const tickets = data.tickets.filter((ticket) => ticket.ownerAgentId === agent.id);
    const runs = data.runs.filter((run) => run.agentId === agent.id);
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      health: agent.healthScore,
      trust: agent.trustScore,
      quality: agent.outputQuality,
      costEfficiency: agent.costEfficiency,
      successRate: agent.successRate,
      workload: tickets.length + runs.length,
      cost: agent.costMonthToDate,
      risk: agent.riskLevel,
    };
  }).sort((a, b) => b.successRate - a.successRate);
  return {
    rows,
    kpis: [
      { label: 'Avg health', value: `${(rows.reduce((sum, row) => sum + row.health, 0) / rows.length).toFixed(0)}/100`, tone: 'blue' },
      { label: 'Avg trust', value: `${(rows.reduce((sum, row) => sum + row.trust, 0) / rows.length).toFixed(0)}/100`, tone: 'green' },
      { label: 'Quality', value: `${(rows.reduce((sum, row) => sum + row.quality, 0) / rows.length).toFixed(0)}%`, tone: 'cyan' },
      { label: 'Cost MTD', value: currency(rows.reduce((sum, row) => sum + row.cost, 0)), tone: 'purple' },
    ] satisfies KpiViewModel[],
  };
}

export function selectAgentMemoryViewModel() {
  const data = currentData();
  return {
    agents: data.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      memorySummary: agent.memorySummary,
      contextCount: agent.skills.length + agent.tools.length + agent.currentTicketIds.length,
      riskLevel: agent.riskLevel,
    })),
    sources: ['Project notes', 'Ticket history', 'Run logs', 'Approval decisions', 'Tool outputs'],
  };
}

export function selectSkillsRegistryViewModel() {
  const data = currentData();
  const skills = [...new Set(data.agents.flatMap((agent) => agent.skills))].map((skill, index) => ({
    id: `skill-${index + 1}`,
    name: skill,
    agents: data.agents.filter((agent) => agent.skills.includes(skill)).map((agent) => agent.name),
    usage: 42 + index * 7,
    status: index % 4 === 0 ? 'Review' : 'Active',
  }));
  return {
    skills,
    kpis: [
      { label: 'Skills', value: String(skills.length), tone: 'blue' },
      { label: 'Active', value: String(skills.filter((skill) => skill.status === 'Active').length), tone: 'green' },
      { label: 'Review', value: String(skills.filter((skill) => skill.status === 'Review').length), tone: 'amber' },
      { label: 'Avg usage', value: `${Math.round(skills.reduce((sum, skill) => sum + skill.usage, 0) / skills.length)}%`, tone: 'cyan' },
    ] satisfies KpiViewModel[],
  };
}

export function selectToolsPermissionsViewModel() {
  const data = currentData();
  const tools = [...new Set(data.agents.flatMap((agent) => agent.tools))].map((tool, index) => ({
    id: `tool-${index + 1}`,
    name: tool,
    access: index % 3 === 0 ? 'Restricted' : index % 3 === 1 ? 'Approval required' : 'Allowed',
    agents: data.agents.filter((agent) => agent.tools.includes(tool)).map((agent) => agent.name),
    risk: index % 3 === 0 ? 'high' : index % 3 === 1 ? 'medium' : 'low',
  }));
  return {
    tools,
    policies: [
      'Production writes require human approval',
      'External webhooks restricted to approved projects',
      'Browser automation logs must attach evidence',
      'High-risk tool calls create approval records',
    ],
    kpis: [
      { label: 'Tools', value: String(tools.length), tone: 'blue' },
      { label: 'Restricted', value: String(tools.filter((tool) => tool.access === 'Restricted').length), tone: 'red' },
      { label: 'Approval required', value: String(tools.filter((tool) => tool.access === 'Approval required').length), tone: 'amber' },
      { label: 'Allowed', value: String(tools.filter((tool) => tool.access === 'Allowed').length), tone: 'green' },
    ] satisfies KpiViewModel[],
  };
}

export function selectArtifactsLibraryViewModel() {
  const artifacts = artifactRows();
  const data = currentData();
  return {
    artifacts,
    runs: data.runs,
    kpis: [
      { label: 'Artifacts', value: String(artifacts.length), tone: 'blue' },
      { label: 'Reports', value: String(artifacts.filter((artifact) => artifact.type === 'report').length), tone: 'green' },
      { label: 'Logs', value: String(artifacts.filter((artifact) => artifact.type === 'log').length), tone: 'cyan' },
      { label: 'Linked runs', value: String(new Set(artifacts.map((artifact) => artifact.runId)).size), tone: 'purple' },
    ] satisfies KpiViewModel[],
  };
}

export function selectArtifactDetailViewModel(artifactId?: string) {
  const artifacts = artifactRows();
  const artifact = artifacts.find((item) => item.id === artifactId) ?? artifacts[0];
  const run = findRun(artifact.runId);
  const ticket = findTicket(run.ticketId);
  const agent = findAgent(run.agentId);
  return {
    artifact,
    run,
    ticket,
    agent,
    relatedArtifacts: artifacts.filter((item) => item.runId === run.id && item.id !== artifact.id),
    reviewChecklist: ticket.acceptanceCriteria.map((criterion, index) => ({
      id: `artifact-check-${index + 1}`,
      label: criterion,
      status: index < 2 ? 'Verified' : 'Needs review',
    })),
  };
}

export function getRecentActivities(): Activity[] {
  return mergeActivityTimeline(currentData().activities, getWorkflowState().events);
}

export function getCostBreakdown(): CostBreakdown {
  return currentData().costBreakdown;
}

export function getGoals(): Goal[] {
  return currentData().goals;
}
