import {
  DEMO_AGENT_ID,
  DEMO_APPROVAL_ID,
  DEMO_RUN_ID,
  DEMO_TICKET_ID,
  demoActivities,
  demoAgents,
  demoApprovals,
  demoCostBreakdown,
  demoCurrentUser,
  demoGoals,
  demoRuns,
  demoTickets,
  demoWorkspace,
} from '../data/demo-fixtures';
import type { Activity, Agent, Approval, CostBreakdown, Goal, Metric, Run, Ticket } from './types';

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

function findAgent(id: string): Agent {
  const agent = demoAgents.find((item) => item.id === id);
  if (!agent) throw new Error(`Missing demo agent: ${id}`);
  return agent;
}

function findTicket(id: string): Ticket {
  const ticket = demoTickets.find((item) => item.id === id);
  if (!ticket) throw new Error(`Missing demo ticket: ${id}`);
  return ticket;
}

function findRun(id: string): Run {
  const run = demoRuns.find((item) => item.id === id);
  if (!run) throw new Error(`Missing demo run: ${id}`);
  return run;
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
    cost: currency(demoRuns.find((run) => run.ticketId === ticket.id)?.cost ?? 0.12),
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
  const openTickets = demoTickets.filter((ticket) => ticket.status !== 'done').length;
  const pendingApprovals = demoApprovals.filter((approval) => approval.status === 'pending').length;
  const successRate = demoAgents.reduce((sum, agent) => sum + agent.successRate, 0) / demoAgents.length;
  const riskWarnings = demoTickets.filter((ticket) => ticket.riskLevel === 'high' || ticket.status === 'failed' || ticket.status === 'blocked').length + demoApprovals.filter((approval) => approval.severity === 'high').length;

  return {
    workspace: demoWorkspace,
    user: demoCurrentUser,
    kpis: [
      { label: 'AI Agents hoat dong', value: String(demoAgents.length), delta: '+12%', tone: 'cyan' },
      { label: 'Ticket dang mo', value: String(openTickets), delta: '-8%', tone: 'blue' },
      { label: 'Phe duyet cho xu ly', value: String(pendingApprovals), delta: '-12%', tone: 'purple' },
      { label: 'Chi phi AI thang nay', value: currency(demoCostBreakdown.total), delta: '+8.5%', tone: 'blue' },
      { label: 'Ty le thanh cong', value: `${successRate.toFixed(1)}%`, delta: '+4.1%', tone: 'green' },
      { label: 'Canh bao rui ro', value: String(riskWarnings), delta: '+40%', tone: 'red' },
    ] satisfies KpiViewModel[],
    goals: demoGoals,
    activities: demoActivities,
    costBreakdown: demoCostBreakdown,
    agents: demoAgents,
    tickets: demoTickets,
    approvals: demoApprovals,
  };
}

export function selectWorkforceViewModel() {
  const active = demoAgents.filter((agent) => ['active', 'running', 'busy'].includes(agent.status)).length;
  const waiting = demoAgents.filter((agent) => ['waiting', 'idle'].includes(agent.status)).length;
  const failed = demoAgents.filter((agent) => agent.status === 'failed').length;
  const successRate = demoAgents.reduce((sum, agent) => sum + agent.successRate, 0) / demoAgents.length;

  return {
    agents: demoAgents,
    agentCards: demoAgents.map(agentToCard),
    tickets: demoTickets,
    runs: demoRuns,
    kpis: [
      { label: 'Tong Agent', value: String(demoAgents.length), delta: '+14%', tone: 'purple' },
      { label: 'Dang hoat dong', value: String(active), delta: '+8%', tone: 'green' },
      { label: 'Dang ranh', value: String(waiting), delta: '-5%', tone: 'blue' },
      { label: 'Dang loi', value: String(failed), delta: '+2%', tone: 'red' },
      { label: 'Chi phi thang nay', value: currency(demoAgents.reduce((sum, agent) => sum + agent.costMonthToDate, 0)), delta: '+15.2%', tone: 'purple' },
      { label: 'Ty le thanh cong', value: `${successRate.toFixed(1)}%`, delta: '+3.4%', tone: 'cyan' },
    ] satisfies KpiViewModel[],
  };
}

export function selectOrgChartViewModel() {
  return {
    agents: demoAgents,
    agentCards: demoAgents.map(agentToCard),
    rootAgent: demoAgents[0],
    detailAgent: demoAgents[0],
  };
}

export function selectAgentDetailViewModel(agentId = DEMO_AGENT_ID) {
  const agent = findAgent(agentId);
  const tickets = demoTickets.filter((ticket) => ticket.ownerAgentId === agent.id);
  const runs = demoRuns.filter((run) => run.agentId === agent.id);
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
  const cards = demoTickets.map(ticketToCard);
  const columns = ['Backlog', 'Ready', 'Assigned', 'Running', 'Needs Review', 'Done', 'Blocked', 'Failed'];
  return {
    tickets: cards,
    columns,
    rawTickets: demoTickets,
    kpis: [
      { label: 'Tong ticket', value: String(demoTickets.length), tone: 'blue' },
      { label: 'Dang chay', value: String(demoTickets.filter((ticket) => ticket.status === 'in_progress').length), tone: 'green' },
      { label: 'Can review', value: String(demoTickets.filter((ticket) => ticket.status === 'review').length), tone: 'amber' },
      { label: 'Bi chan', value: String(demoTickets.filter((ticket) => ticket.status === 'blocked').length), tone: 'red' },
      { label: 'Failed', value: String(demoTickets.filter((ticket) => ticket.status === 'failed').length), tone: 'purple' },
      { label: 'Thoi gian TB', value: '2h 18m', tone: 'cyan' },
    ] satisfies KpiViewModel[],
  };
}

export function selectTicketDetailViewModel(ticketId = DEMO_TICKET_ID) {
  const ticket = findTicket(ticketId);
  const agent = findAgent(ticket.ownerAgentId);
  const run = ticket.runId ? findRun(ticket.runId) : undefined;
  const approval = ticket.approvalId ? demoApprovals.find((item) => item.id === ticket.approvalId) : undefined;
  return { ticket, agent, run, approval, criteria: ticket.acceptanceCriteria };
}

export function selectRunConsoleViewModel(runId = DEMO_RUN_ID) {
  const run = findRun(runId);
  const ticket = findTicket(run.ticketId);
  const agent = findAgent(run.agentId);
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
  };
}

export function selectApprovalCenterViewModel() {
  const queueRows = demoApprovals.map(approvalToQueueRow);
  const highRisk = demoApprovals.filter((approval) => approval.severity === 'high').length;
  const pending = demoApprovals.filter((approval) => approval.status === 'pending').length;
  return {
    approvals: queueRows,
    rawApprovals: demoApprovals,
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

export function getRecentActivities(): Activity[] {
  return demoActivities;
}

export function getCostBreakdown(): CostBreakdown {
  return demoCostBreakdown;
}

export function getGoals(): Goal[] {
  return demoGoals;
}
