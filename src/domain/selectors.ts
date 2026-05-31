import {
  DEMO_AGENT_ID,
  DEMO_APPROVAL_ID,
  DEMO_RUN_ID,
  DEMO_TICKET_ID,
} from '../data/demo-fixtures';
import { mergeActivityTimeline } from '../services/activity-service';
import { getApprovalById, getApprovals as getRuntimeApprovals } from '../runtime-store/approval-store';
import { getArtifactById as getRuntimeArtifactById, getRunArtifacts, getRuntimeArtifacts } from '../runtime-store/artifact-store';
import { getRunEvents, getRuntimeEvents } from '../runtime-store/event-store';
import { getRunById } from '../runtime-store/run-store';
import { getStreamEvents, isStreamComplete } from '../runtime-store/stream-store';
import { getActiveToolCall, getCompletedToolCalls, getToolCallById, getToolCallsByRun } from '../runtime-store/tool-call-store';
import { getWorkflowData, getWorkflowState } from '../state/workflow-engine';
import type { Activity, Agent, Approval, Artifact, CostBreakdown, Goal, Metric, Run, Ticket } from './types';
import type { RuntimeToolCall } from '../integrations/growthos-runtime/runtime-types';
import type { HermesDiscoveryResult } from '../integrations/hermes/hermes-discovery-types';
import type { HermesToolRegistry } from '../integrations/hermes/hermes-tool-registry';
import type { CapabilityRegistry, WorkflowReadiness } from '../integrations/hermes/capability-registry';
import type { RunPlan } from '../integrations/growthos-runtime/run-planner';
import { getRuntimeReadiness } from '../integrations/growthos-runtime/runtime-orchestrator';
import {
  getHermesCapabilities as getStoredHermesCapabilities,
  getHermesDiscovery as getStoredHermesDiscovery,
  getHermesDiscoveryStatus as getStoredHermesDiscoveryStatus,
  getHermesModels as getStoredHermesModels,
  getHermesTools as getStoredHermesTools,
} from '../runtime-store/hermes-discovery-store';
import {
  getRegisteredCapabilities,
  getRegisteredModels,
  getRegisteredTools,
  getToolCompatibilityMatrix,
  getToolRegistry as getStoredToolRegistry,
} from '../runtime-store/tool-registry-store';
import {
  getCapabilities as getStoredCapabilities,
  getCapabilityRegistry as getStoredCapabilityRegistry,
  getMissingCapabilities as getStoredMissingCapabilities,
  getWorkflowReadiness as getStoredWorkflowReadiness,
  getWorkflowReadinessRows as getStoredWorkflowReadinessRows,
} from '../runtime-store/capability-registry-store';
import {
  getCurrentPlanForTicket,
  getPlanSteps as getStoredPlanSteps,
  getPlansByTicket,
  getRunPlan as getStoredRunPlan,
} from '../runtime-store/run-plan-store';
import {
  getBlockingReasons as getStoredBlockingReasons,
  getCanStartPlan as getStoredCanStartPlan,
  getPlanWarnings as getStoredPlanWarnings,
  getPolicyReport as getStoredPolicyReport,
} from '../runtime-store/plan-policy-store';
import {
  getBudgetReport as getStoredBudgetReport,
  getExecutionBudget as getStoredExecutionBudget,
} from '../runtime-store/execution-budget-store';
import { estimateRunPlanBudget } from '../integrations/growthos-runtime/execution-budget';
import {
  getBillingLedger,
  getQuotaReport as getStoredQuotaReport,
  getQuotaReports,
  getUsageByRun,
} from '../runtime-store/usage-ledger-store';
import { summarizeEstimatedVsActual } from '../integrations/growthos-runtime/usage-ledger';
import {
  getModelAnalytics as getStoredModelAnalytics,
  getToolAnalytics as getStoredToolAnalytics,
  getWorkflowAnalytics as getStoredWorkflowAnalytics,
  getWorkspaceAnalytics as getStoredWorkspaceAnalytics,
} from '../runtime-store/workspace-analytics-store';
import {
  getCostAlerts as getStoredCostAlerts,
  getProviderCost as getStoredProviderCost,
  getReconciliationReport as getStoredReconciliationReport,
  getVarianceHistory as getStoredVarianceHistory,
} from '../runtime/cost-reconciliation-store';

export interface KpiViewModel {
  label: string;
  value: string;
  caption?: string;
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
  originatingTool?: string;
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
  inputPreview?: string;
  outputPreview?: string;
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

export interface ArtifactPreviewViewModel {
  id: string;
  runId: string;
  name: string;
  type: Artifact['type'];
  source: NonNullable<Artifact['source']>;
  contentSummary: string;
  contentText?: string;
  contentJson?: unknown;
  language?: string;
  url?: string;
  createdAt: string;
  createdLabel: string;
  sizeLabel: string;
  generatedByToolName?: string;
}

export function selectHermesDiscovery(): HermesDiscoveryResult {
  return getStoredHermesDiscovery();
}

export function selectHermesStatus() {
  return getStoredHermesDiscoveryStatus();
}

export function selectHermesTools() {
  return getStoredHermesTools();
}

export function selectHermesModels() {
  return getStoredHermesModels();
}

export function selectHermesCapabilities() {
  return getStoredHermesCapabilities();
}

export function selectRuntimeReadiness() {
  return getRuntimeReadiness();
}

export function selectHermesToolRegistry(): HermesToolRegistry {
  return getStoredToolRegistry();
}

export function selectRegisteredHermesTools() {
  return getRegisteredTools();
}

export function selectRegisteredHermesModels() {
  return getRegisteredModels();
}

export function selectRegisteredHermesCapabilities() {
  return getRegisteredCapabilities();
}

export function selectToolCompatibilityMatrix() {
  return getToolCompatibilityMatrix();
}

export function selectCapabilityRegistry(): CapabilityRegistry {
  return getStoredCapabilityRegistry();
}

export function selectCapabilities() {
  return getStoredCapabilities();
}

export function selectWorkflowReadiness(workflowId = 'demo-run-execution'): WorkflowReadiness {
  return getStoredWorkflowReadiness(workflowId);
}

export function selectWorkflowReadinessMatrix() {
  return getStoredWorkflowReadinessRows();
}

export function selectMissingCapabilities(workflowId = 'demo-run-execution') {
  return getStoredMissingCapabilities(workflowId);
}

export function selectRunPlan(planId?: string): RunPlan | undefined {
  return getStoredRunPlan(planId);
}

export function selectPlansByTicket(ticketId: string): RunPlan[] {
  return getPlansByTicket(ticketId);
}

export function selectCurrentPlanForTicket(ticketId: string): RunPlan | undefined {
  return getCurrentPlanForTicket(ticketId);
}

export function selectPlanSteps(planId?: string) {
  return planId ? getStoredPlanSteps(planId) : [];
}

export function selectPlanReadiness(planId?: string) {
  const plan = selectRunPlan(planId);
  const policyReport = selectPolicyReport(planId);
  return {
    ready: plan?.status === 'ready' && (policyReport ? policyReport.status !== 'blocked' : true),
    status: plan?.status ?? 'draft',
    missingCapabilities: plan?.missingCapabilities ?? [],
    warnings: [...(plan?.warnings ?? []), ...(policyReport?.warnings ?? [])],
    policyStatus: policyReport?.status ?? 'allowed',
    blockingReasons: policyReport?.blockingReasons ?? [],
    canStart: policyReport ? policyReport.status !== 'blocked' : plan?.status === 'ready',
  };
}

export function selectPolicyReport(planId?: string) {
  return getStoredPolicyReport(planId);
}

export function selectBlockingReasons(planId?: string): string[] {
  return getStoredBlockingReasons(planId);
}

export function selectPlanWarnings(planId?: string): string[] {
  return getStoredPlanWarnings(planId);
}

export function selectCanStartPlan(planId?: string): boolean {
  return getStoredCanStartPlan(planId);
}

export function selectExecutionCost(planId?: string) {
  return selectBudgetPolicy(planId)?.estimate ?? (selectRunPlan(planId) ? estimateRunPlanBudget(selectRunPlan(planId)!) : undefined);
}

export function selectExecutionRisk(planId?: string) {
  return selectExecutionCost(planId)?.riskLevel ?? 'low';
}

export function selectExecutionBudget() {
  return getStoredExecutionBudget();
}

export function selectBudgetPolicy(planId?: string) {
  return getStoredBudgetReport(planId);
}

export function selectUsageLedger(runId: string) {
  return getBillingLedger(runId);
}

export function selectActualRunCost(runId: string) {
  return selectUsageLedger(runId).actualTotal;
}

export function selectEstimatedVsActualCost(runId: string) {
  return summarizeEstimatedVsActual(runId);
}

export function selectQuotaStatus(targetId?: string) {
  if (targetId) return getStoredQuotaReport(targetId)?.status ?? 'ok';
  const reports = getQuotaReports();
  if (reports.some((report) => report.status === 'exceeded')) return 'exceeded';
  if (reports.some((report) => report.status === 'warning')) return 'warning';
  return 'ok';
}

export function selectQuotaWarnings(runId?: string): string[] {
  const report = getStoredQuotaReport(runId);
  return report ? [...report.warnings, ...report.blockingReasons] : [];
}

export function selectBillingRecordsByRun(runId: string) {
  return getUsageByRun(runId);
}

export function selectWorkspaceAnalytics() {
  return getStoredWorkspaceAnalytics();
}

export function selectToolAnalytics() {
  return getStoredToolAnalytics();
}

export function selectModelAnalytics() {
  return getStoredModelAnalytics();
}

export function selectWorkflowAnalytics() {
  return getStoredWorkflowAnalytics();
}

export function selectTopCostTools(limit = 5) {
  return selectToolAnalytics().slice().sort((a, b) => b.totalCost - a.totalCost).slice(0, limit);
}

export function selectTopCostModels(limit = 5) {
  return selectModelAnalytics().slice().sort((a, b) => b.totalCost - a.totalCost).slice(0, limit);
}

export function selectTopWorkflows(limit = 5) {
  return selectWorkflowAnalytics().slice().sort((a, b) => b.totalCost - a.totalCost).slice(0, limit);
}

export function selectWorkspaceCostSummary() {
  const analytics = selectWorkspaceAnalytics();
  return {
    estimatedCost: analytics.estimatedCost,
    actualCost: analytics.actualCost,
    varianceCost: analytics.varianceCost,
  };
}

export function selectWorkspaceTokenSummary() {
  const analytics = selectWorkspaceAnalytics();
  return {
    totalTokens: analytics.totalTokens,
    averageTokensPerRun: analytics.totalRuns ? Math.round(analytics.totalTokens / analytics.totalRuns) : 0,
  };
}

export function selectWorkspaceRuntimeSummary() {
  const analytics = selectWorkspaceAnalytics();
  return {
    totalRuntimeMinutes: analytics.totalRuntimeMinutes,
    averageRuntimeMinutes: analytics.totalRuns ? Number((analytics.totalRuntimeMinutes / analytics.totalRuns).toFixed(2)) : 0,
  };
}

export function selectReconciliationReport() {
  return getStoredReconciliationReport();
}

export function selectVarianceHistory() {
  return getStoredVarianceHistory();
}

export function selectCostVariance(runId?: string) {
  const report = selectReconciliationReport();
  if (!runId) {
    return {
      variance: report.variance,
      variancePercent: report.variancePercent,
    };
  }
  const record = report.records.find((item) => item.runId === runId);
  return {
    variance: record?.variance ?? 0,
    variancePercent: record?.variancePercent ?? 0,
  };
}

export function selectVarianceSeverity(runId?: string) {
  const report = selectReconciliationReport();
  if (!runId) return report.severity;
  return report.records.find((item) => item.runId === runId)?.severity ?? 'NORMAL';
}

export function selectProviderCost(runId?: string) {
  return getStoredProviderCost(runId);
}

export function selectEstimatedVsActual(runId?: string) {
  if (runId) return selectEstimatedVsActualCost(runId);
  const report = selectReconciliationReport();
  return {
    estimatedTotal: report.estimatedCost,
    actualTotal: report.actualCost,
    variance: Number((report.actualCost - report.estimatedCost).toFixed(4)),
    variancePercent: report.estimatedCost ? Number(((Math.abs(report.actualCost - report.estimatedCost) / report.estimatedCost) * 100).toFixed(2)) : 0,
  };
}

export function selectCostAlerts() {
  return getStoredCostAlerts();
}

function streamProgress(runId: string): number {
  const events = getStreamEvents(runId);
  if (isStreamComplete(runId)) return 100;
  return Math.min(88, Math.round((events.length / 14) * 100));
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

function ticketColumn(ticket: Ticket): string {
  if (ticket.id === 'ticket-performance-report') return 'Ready';
  if (ticket.id === 'ticket-crm-cleanup') return 'Assigned';

  const columns: Record<Ticket['status'], string> = {
    todo: 'Backlog',
    in_progress: 'Running',
    review: 'Needs Review',
    done: 'Done',
    blocked: 'Blocked',
    failed: 'Failed',
  };
  return columns[ticket.status];
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

function formatArtifactSize(artifact: Artifact, fallbackIndex = 0): string {
  const bytes = artifact.sizeBytes ?? Math.max(12 * 1024, (fallbackIndex + 1) * 19 * 1024);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mergeArtifactsById(primary: Artifact[], secondary: Artifact[]): Artifact[] {
  const seen = new Set<string>();
  return [...primary, ...secondary].filter((artifact) => {
    if (seen.has(artifact.id)) return false;
    seen.add(artifact.id);
    return true;
  });
}

function toolCallCost(toolCall: RuntimeToolCall): number {
  return typeof toolCall.metadata?.cost === 'number' ? toolCall.metadata.cost : 0;
}

function runtimeToolToViewModel(toolCall: RuntimeToolCall): ToolCallViewModel {
  return {
    name: toolCall.toolName,
    target: toolCall.input,
    status: statusLabel(toolCall.status),
    duration: toolCall.durationMs ? formatDuration(Math.round(toolCall.durationMs / 1000)) : toolCall.status === 'running' ? 'running' : '-',
    cost: toolCallCost(toolCall) === 0 ? '-' : `$${toolCallCost(toolCall).toFixed(3)}`,
    inputPreview: toolCall.input,
    outputPreview: toolCall.output ?? (toolCall.status === 'running' ? 'Running...' : 'Queued'),
  };
}

function domainToolToViewModel(tool: Run['toolCalls'][number]): ToolCallViewModel {
  return {
    name: tool.toolName,
    target: tool.inputSummary,
    status: statusLabel(tool.status),
    duration: tool.durationMs ? formatDuration(Math.round(tool.durationMs / 1000)) : '-',
    cost: tool.cost === 0 ? '-' : `$${tool.cost.toFixed(3)}`,
    inputPreview: tool.inputSummary,
    outputPreview: tool.outputSummary,
  };
}

function runToolRows(run: Run): ToolCallViewModel[] {
  const runtimeTools = getToolCallsByRun(run.id);
  return runtimeTools.length ? runtimeTools.map(runtimeToolToViewModel) : run.toolCalls.map(domainToolToViewModel);
}

function toolProgress(runId: string): number {
  const activeTool = getActiveToolCall(runId);
  if (activeTool && typeof activeTool.metadata?.progress === 'number') return activeTool.metadata.progress;
  const toolCalls = getToolCallsByRun(runId);
  if (toolCalls.length === 0) return 0;
  return Math.round((getCompletedToolCalls(runId).length / Math.max(1, toolCalls.length)) * 100);
}

export function getArtifactsForRun(runId: string): Artifact[] {
  const baseRun = currentData().runs.find((run) => run.id === runId);
  const runtimeArtifacts = getRunArtifacts(runId);
  return mergeArtifactsById(runtimeArtifacts, baseRun?.artifacts ?? []);
}

export function getPrimaryArtifactForRun(runId: string): Artifact | undefined {
  const artifacts = getArtifactsForRun(runId);
  return artifacts.find((artifact) => ['markdown', 'report', 'code', 'json', 'patch'].includes(artifact.type)) ?? artifacts[0];
}

export function getArtifactById(artifactId: string): Artifact | undefined {
  const runtimeArtifact = getRuntimeArtifactById(artifactId);
  if (runtimeArtifact) return runtimeArtifact;
  return currentData().runs.flatMap((run) => run.artifacts).find((artifact) => artifact.id === artifactId);
}

export function getArtifactPreviewModel(artifactId?: string): ArtifactPreviewViewModel | undefined {
  if (!artifactId) return undefined;
  const artifact = getArtifactById(artifactId);
  if (!artifact) return undefined;
  const sourceTool = getToolCallById(artifact.toolId);
  return {
    id: artifact.id,
    runId: artifact.runId,
    name: artifact.name,
    type: artifact.type,
    source: artifact.source ?? 'mock',
    contentSummary: artifact.contentSummary ?? `${artifact.type} artifact generated by runtime output.`,
    contentText: artifact.contentText,
    contentJson: artifact.contentJson,
    language: artifact.language,
    url: artifact.url,
    createdAt: artifact.createdAt,
    createdLabel: artifact.createdAt.slice(0, 16).replace('T', ' '),
    sizeLabel: formatArtifactSize(artifact),
    generatedByToolName: sourceTool?.toolName,
  };
}

function artifactRows(): ArtifactRowViewModel[] {
  const data = currentData();
  const runtimeByRun = getRuntimeArtifacts().reduce<Record<string, Artifact[]>>((acc, artifact) => {
    acc[artifact.runId] = [...(acc[artifact.runId] ?? []), artifact];
    return acc;
  }, {});
  return data.runs.flatMap((run, runIndex) => {
    const ticket = findTicket(run.ticketId);
    const agent = findAgent(run.agentId);
    return mergeArtifactsById(runtimeByRun[run.id] ?? [], run.artifacts).map((artifact, artifactIndex) => ({
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
      size: formatArtifactSize(artifact, runIndex + artifactIndex),
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
    column: ticketColumn(ticket),
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
  const tool = getToolCallById(approval.toolId);
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
    originatingTool: tool?.toolName,
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
  const baseRun = ticket.runId ? findRun(ticket.runId) : undefined;
  const runtimeRun = baseRun ? getRunById(baseRun.id) : undefined;
  const runtimeArtifacts = baseRun ? getArtifactsForRun(baseRun.id) : [];
  const run = runtimeRun ? { ...runtimeRun, artifacts: runtimeArtifacts.length ? runtimeArtifacts : runtimeRun.artifacts } : baseRun;
  const primaryArtifact = run ? getPrimaryArtifactForRun(run.id) : undefined;
  const baseApproval = ticket.approvalId ? currentData().approvals.find((item) => item.id === ticket.approvalId) : undefined;
  const approval = baseApproval ? getApprovalById(baseApproval.id) ?? baseApproval : undefined;
  const workflowEvents = getWorkflowState().events.filter((event) => event.entityId === ticket.id || event.entityId === ticket.runId || event.entityId === ticket.approvalId);
  const runtimeEvents = run ? getRunEvents(run.id) : [];
  const streamEvents = run ? getStreamEvents(run.id) : [];
  const activeToolCall = run ? getActiveToolCall(run.id) : undefined;
  const completedToolCalls = run ? getCompletedToolCalls(run.id) : [];
  const totalToolCalls = run ? getToolCallsByRun(run.id).length || run.toolCalls.length : 0;
  const plans = selectPlansByTicket(ticket.id);
  const currentPlan = selectCurrentPlanForTicket(ticket.id);
  const policyReport = selectPolicyReport(currentPlan?.id);
  const budgetPolicy = selectBudgetPolicy(currentPlan?.id);
  const executionEstimate = selectExecutionCost(currentPlan?.id);
  const usageLedger = run ? selectUsageLedger(run.id) : undefined;
  const quotaWarnings = run ? selectQuotaWarnings(run.id) : [];
  const workflowAnalytics = selectWorkflowAnalytics().find((item) => item.workflowId === currentPlan?.workflowId) ?? selectTopWorkflows(1)[0];
  const events = [
    ...workflowEvents,
    ...runtimeEvents,
  ];
  return {
    ticket,
    agent,
    run,
    approval,
    criteria: ticket.acceptanceCriteria,
    timeline: events,
    streamEvents,
    latestStreamEvent: streamEvents[streamEvents.length - 1],
    streamProgress: run ? streamProgress(run.id) : 0,
    toolProgress: run ? toolProgress(run.id) : 0,
    activeToolCall,
    lastCompletedToolCall: completedToolCalls[completedToolCalls.length - 1],
    completedToolCalls,
    totalToolsExecuted: totalToolCalls,
    primaryArtifactPreview: getArtifactPreviewModel(primaryArtifact?.id),
    plans,
    currentPlan,
    planSteps: selectPlanSteps(currentPlan?.id),
    planReadiness: selectPlanReadiness(currentPlan?.id),
    policyReport,
    budgetPolicy,
    executionEstimate,
    executionBudget: selectExecutionBudget(),
    usageLedger,
    estimatedVsActualCost: run ? selectEstimatedVsActualCost(run.id) : undefined,
    quotaStatus: run ? selectQuotaStatus(run.id) : selectQuotaStatus(currentPlan?.id),
    quotaWarnings,
    workflowAnalytics,
    blockingReasons: selectBlockingReasons(currentPlan?.id),
    planWarnings: selectPlanWarnings(currentPlan?.id),
    canStartPlan: currentPlan ? selectCanStartPlan(currentPlan.id) : false,
  };
}

export function selectRunConsoleViewModel(runId = DEMO_RUN_ID) {
  const baseRun = findRun(runId);
  const runtimeRun = getRunById(runId);
  const runtimeArtifacts = getArtifactsForRun(runId);
  const run = runtimeRun ? { ...runtimeRun, artifacts: runtimeArtifacts.length ? runtimeArtifacts : runtimeRun.artifacts } : baseRun;
  const ticket = findTicket(run.ticketId);
  const agent = findAgent(run.agentId);
  const events = [
    ...getRunEvents(run.id),
    ...getWorkflowState().events.filter((event) => event.entityId === run.id || event.entityId === ticket.id),
  ];
  const streamEvents = getStreamEvents(run.id);
  const latestStreamEvent = streamEvents[streamEvents.length - 1];
  const activeToolCall = getActiveToolCall(run.id);
  const completedToolCalls = getCompletedToolCalls(run.id);
  const runtimeToolRows = runToolRows(run);
  const hermesDiscovery = selectHermesDiscovery();
  const runtimeReadiness = selectRuntimeReadiness();
  const toolRegistry = selectHermesToolRegistry();
  const capabilityRegistry = selectCapabilityRegistry();
  const capabilities = selectCapabilities();
  const workflowReadiness = selectWorkflowReadiness();
  const workflowReadinessMatrix = selectWorkflowReadinessMatrix();
  const missingCapabilities = selectMissingCapabilities();
  const currentPlan = selectCurrentPlanForTicket(ticket.id);
  const policyReport = selectPolicyReport(currentPlan?.id);
  const budgetPolicy = selectBudgetPolicy(currentPlan?.id);
  const executionEstimate = selectExecutionCost(currentPlan?.id);
  const usageLedger = selectUsageLedger(run.id);
  const quotaWarnings = selectQuotaWarnings(run.id);
  const workspaceAnalytics = selectWorkspaceAnalytics();
  const topTools = selectTopCostTools(3);
  const topModels = selectTopCostModels(3);
  const topWorkflows = selectTopWorkflows(3);
  const reconciliationReport = selectReconciliationReport();
  const runReconciliation = reconciliationReport.records.find((record) => record.runId === run.id);
  return {
    run,
    ticket,
    agent,
    artifacts: run.artifacts,
    hermesDiscovery,
    runtimeReadiness,
    toolRegistry,
    capabilityRegistry,
    capabilities,
    workflowReadiness,
    workflowReadinessMatrix,
    missingCapabilities,
    currentPlan,
    planSteps: selectPlanSteps(currentPlan?.id),
    planReadiness: selectPlanReadiness(currentPlan?.id),
    policyReport,
    budgetPolicy,
    executionEstimate,
    executionBudget: selectExecutionBudget(),
    usageLedger,
    estimatedVsActualCost: selectEstimatedVsActualCost(run.id),
    quotaStatus: selectQuotaStatus(run.id),
    quotaWarnings,
    billingRecords: selectBillingRecordsByRun(run.id),
    workspaceAnalytics,
    topTools,
    topModels,
    topWorkflows,
    workspaceCostSummary: selectWorkspaceCostSummary(),
    workspaceTokenSummary: selectWorkspaceTokenSummary(),
    workspaceRuntimeSummary: selectWorkspaceRuntimeSummary(),
    reconciliationReport,
    runReconciliation,
    providerCost: selectProviderCost(run.id),
    costVariance: selectCostVariance(run.id),
    varianceSeverity: selectVarianceSeverity(run.id),
    costAlerts: selectCostAlerts(),
    blockingReasons: selectBlockingReasons(currentPlan?.id),
    planWarnings: selectPlanWarnings(currentPlan?.id),
    canStartPlan: currentPlan ? selectCanStartPlan(currentPlan.id) : false,
    primaryArtifactPreview: getArtifactPreviewModel(getPrimaryArtifactForRun(run.id)?.id),
    streamEvents,
    latestStreamEvent,
    streamProgress: streamProgress(run.id),
    streamComplete: isStreamComplete(run.id),
    toolProgress: toolProgress(run.id),
    activeToolCall,
    lastCompletedToolCall: completedToolCalls[completedToolCalls.length - 1],
    completedToolCalls,
    timelineRows: run.steps.map((step): RunStepViewModel => ({
      name: step.name,
      status: statusLabel(step.status),
      time: timeLabel(step.startedAt),
      duration: formatDuration(step.durationSeconds),
      cost: step.cost === 0 ? '$0.000' : `$${step.cost.toFixed(3)}`,
    })),
    toolCallRows: runtimeToolRows,
    workflowTimeline: events,
  };
}

export function selectApprovalCenterViewModel() {
  const data = currentData();
  const runtimeApprovals = getRuntimeApprovals();
  const approvalMap = new Map([...data.approvals, ...runtimeApprovals].map((approval) => [approval.id, approval]));
  const approvals = [...approvalMap.values()];
  const queueRows = approvals.map(approvalToQueueRow);
  const highRisk = approvals.filter((approval) => approval.severity === 'high').length;
  const pending = approvals.filter((approval) => approval.status === 'pending').length;
  const budgetApprovals = approvals.filter((approval) => approval.policy.includes('budget') || approval.description.toLowerCase().includes('budget')).length;
  const quotaApprovals = approvals.filter((approval) => approval.policy.includes('quota') || approval.description.toLowerCase().includes('quota')).length;
  const approvalCost = approvals
    .flatMap((approval) => approval.runId ? selectBillingRecordsByRun(approval.runId).filter((record) => record.type === 'approval') : [])
    .reduce((sum, record) => sum + record.actualCost, 0);
  const selectedApproval = queueRows[0];
  const selectedRawApproval = approvals.find((approval) => approval.id === selectedApproval?.id);
  const selectedRunId = selectedRawApproval?.runId;
  const selectedArtifactPreview = selectedRunId ? getArtifactPreviewModel(getPrimaryArtifactForRun(selectedRunId)?.id) : undefined;
  return {
    approvals: queueRows,
    rawApprovals: approvals,
    selectedApproval,
    selectedRawApproval,
    selectedArtifactPreview,
    budgetApprovals,
    quotaApprovals,
    approvalCost,
    kpis: [
      { label: 'Cho phe duyet', value: String(pending), tone: 'blue' },
      { label: 'Rui ro cao', value: String(highRisk), tone: 'red' },
      { label: 'Qua han', value: '3', tone: 'amber' },
      { label: 'Da duyet hom nay', value: '18', tone: 'green' },
      { label: 'Budget / quota', value: String(budgetApprovals + quotaApprovals), tone: 'amber' },
      { label: 'Approval cost', value: currency(approvalCost), tone: 'blue' },
    ] satisfies KpiViewModel[],
  };
}

export function selectApprovalDetailViewModel(approvalId = DEMO_APPROVAL_ID) {
  const data = currentData();
  const approval = getApprovalById(approvalId) ?? data.approvals.find((item) => item.id === approvalId) ?? data.approvals[0];
  const ticket = findTicket(approval.ticketId);
  const agent = findAgent(approval.agentId);
  const baseRun = approval.runId ? data.runs.find((item) => item.id === approval.runId) : undefined;
  const run = approval.runId ? getRunById(approval.runId) ?? baseRun : undefined;
  const events = [
    ...getRuntimeEvents().filter((event) => [approval.id, approval.ticketId, approval.runId].includes(event.entityId)),
    ...getWorkflowState().events.filter((event) => [approval.id, approval.ticketId, approval.runId].includes(event.entityId)),
  ];
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

export function selectCostDashboardViewModel() {
  const data = currentData();
  const analytics = selectWorkspaceAnalytics();
  const topTool = selectTopCostTools(1)[0];
  const topModel = selectTopCostModels(1)[0];
  const topWorkflow = selectTopWorkflows(1)[0];
  const reconciliationReport = selectReconciliationReport();
  const variance = selectCostVariance();
  const costAlerts = selectCostAlerts();
  const budgetUsed = Math.round((data.costBreakdown.total / data.workspace.aiBudgetMonthly) * 100);
  const runSpend = data.runs.reduce((sum, run) => sum + run.cost, 0);
  const ticketSpendRows = data.tickets.map((ticket) => {
    const run = data.runs.find((item) => item.ticketId === ticket.id);
    const agent = findAgent(ticket.ownerAgentId);
    return {
      id: ticket.id,
      code: ticket.code,
      title: ticket.title,
      agent: agent.name,
      status: statusLabel(ticket.status),
      risk: riskLabel(ticket.riskLevel),
      cost: run?.cost ?? 0.06,
    };
  }).sort((a, b) => b.cost - a.cost);

  return {
    workspace: data.workspace,
    costBreakdown: data.costBreakdown,
    budgetUsed,
    runSpend,
    ticketSpendRows,
    agentSpend: data.costBreakdown.byAgent.map((item) => ({
      ...item,
      status: item.percent > 28 ? 'Review' : item.percent > 18 ? 'Watch' : 'On track',
      tone: item.percent > 28 ? 'amber' : item.percent > 18 ? 'blue' : 'green',
    })),
    toolSpend: data.costBreakdown.byTool,
    analytics,
    topTool,
    topModel,
    topWorkflow,
    reconciliationReport,
    variance,
    varianceHistory: selectVarianceHistory(),
    providerCost: selectProviderCost(),
    varianceSeverity: selectVarianceSeverity(),
    costAlerts,
    alerts: [
      ...costAlerts.map((alert) => ({ id: alert.id, title: alert.title, detail: alert.message, severity: alert.severity, tone: alert.severity === 'CRITICAL' ? 'red' : 'amber' })),
      { id: 'budget-velocity', title: 'Monthly budget velocity', detail: `${budgetUsed}% of monthly budget used in ${data.costBreakdown.period}.`, severity: budgetUsed > 75 ? 'High' : 'Medium', tone: budgetUsed > 75 ? 'red' : 'amber' },
      { id: 'research-spike', title: 'Research spend concentration', detail: 'Research and QA runs account for the largest variable spend this period.', severity: 'Medium', tone: 'amber' },
      { id: 'approval-threshold', title: 'Approval threshold active', detail: 'Budget changes above $25 still require reviewer approval.', severity: 'Low', tone: 'green' },
    ],
    kpis: [
      { label: 'Estimated Cost', value: currency(reconciliationReport.estimatedCost || analytics.estimatedCost), tone: 'blue' },
      { label: 'Actual Cost', value: currency(reconciliationReport.actualCost || analytics.actualCost || data.costBreakdown.total), tone: 'cyan' },
      { label: 'Provider Cost', value: currency(reconciliationReport.providerCost), tone: 'purple' },
      { label: 'Variance', value: currency(reconciliationReport.variance), tone: reconciliationReport.severity === 'CRITICAL' ? 'red' : reconciliationReport.severity === 'WARNING' ? 'amber' : 'green' },
      { label: 'Variance %', value: `${reconciliationReport.variancePercent}%`, tone: reconciliationReport.severity === 'CRITICAL' ? 'red' : reconciliationReport.severity === 'WARNING' ? 'amber' : 'green' },
      { label: 'Severity', value: reconciliationReport.severity, tone: reconciliationReport.severity === 'CRITICAL' ? 'red' : reconciliationReport.severity === 'WARNING' ? 'amber' : 'green' },
      { label: 'Top Tool', value: topTool?.toolId ?? 'none', tone: 'amber' },
      { label: 'Top Workflow', value: topWorkflow?.workflowId ?? 'none', tone: 'green' },
    ] satisfies KpiViewModel[],
  };
}

export function selectBudgetSettingsViewModel() {
  const data = currentData();
  const used = data.costBreakdown.total;
  const remaining = Math.max(0, data.workspace.aiBudgetMonthly - used);
  const policyRows = data.agents.map((agent, index) => ({
    id: agent.id,
    agent: agent.name,
    monthlyLimit: Math.round(agent.costMonthToDate * (index % 2 === 0 ? 2.4 : 2.8)),
    used: agent.costMonthToDate,
    approvalThreshold: index % 2 === 0 ? '$25' : '$50',
    status: agent.riskLevel === 'high' ? 'Review' : 'Enabled',
  }));

  return {
    workspace: data.workspace,
    policyRows,
    thresholdRows: [
      { id: 'tool-spend', label: 'Tool call approval', value: '$25', owner: 'Ops reviewer', tone: 'blue' },
      { id: 'external-send', label: 'External send approval', value: '$0', owner: 'Risk reviewer', tone: 'red' },
      { id: 'monthly-alert', label: 'Monthly budget alert', value: '80%', owner: data.currentUser.name, tone: 'amber' },
      { id: 'agent-hard-cap', label: 'Agent hard cap', value: '120%', owner: 'Workspace admin', tone: 'purple' },
    ],
    approvalPolicies: data.approvals.map((approval) => ({
      id: approval.id,
      title: approval.policy,
      severity: riskLabel(approval.severity),
      agent: findAgent(approval.agentId).name,
      status: statusLabel(approval.status),
    })),
    kpis: [
      { label: 'Monthly budget', value: currency(data.workspace.aiBudgetMonthly), tone: 'blue' },
      { label: 'Used', value: currency(used), tone: 'amber' },
      { label: 'Remaining', value: currency(remaining), tone: 'green' },
      { label: 'Guardrails', value: String(data.approvals.length), tone: 'purple' },
    ] satisfies KpiViewModel[],
  };
}

export function selectReportsDashboardViewModel() {
  const data = currentData();
  const artifacts = artifactRows();
  const reportArtifacts = artifacts.filter((artifact) => artifact.type === 'report');
  const scheduled = data.goals.map((goal, index) => ({
    id: `schedule-${goal.id}`,
    title: `${goal.title} weekly report`,
    owner: findAgent(goal.ownerId).name,
    cadence: index % 2 === 0 ? 'Weekly' : 'Bi-weekly',
    nextRun: goal.dueAt.slice(0, 10),
    status: goal.progress > 80 ? 'Ready' : 'Draft',
  }));

  return {
    artifacts: reportArtifacts,
    scheduled,
    recentRuns: data.runs.map((run) => ({
      id: run.id,
      ticket: findTicket(run.ticketId).title,
      agent: findAgent(run.agentId).name,
      status: statusLabel(run.status),
      cost: currency(run.cost),
      duration: formatDuration(run.elapsedSeconds),
    })),
    insightRows: [
      { id: 'quality', label: 'Quality trend', value: `${Math.round(data.agents.reduce((sum, agent) => sum + agent.outputQuality, 0) / data.agents.length)}%`, tone: 'green' },
      { id: 'tickets', label: 'Tickets summarized', value: String(data.tickets.length), tone: 'blue' },
      { id: 'cost', label: 'Cost included', value: currency(data.costBreakdown.total), tone: 'purple' },
    ],
    kpis: [
      { label: 'Reports', value: String(reportArtifacts.length + scheduled.length), tone: 'blue' },
      { label: 'Scheduled', value: String(scheduled.length), tone: 'cyan' },
      { label: 'Delivered', value: String(reportArtifacts.length), tone: 'green' },
      { label: 'Drafts', value: String(scheduled.filter((item) => item.status === 'Draft').length), tone: 'amber' },
    ] satisfies KpiViewModel[],
  };
}

export function selectReportBuilderViewModel() {
  const data = currentData();
  const reportSections = [
    { id: 'executive-summary', title: 'Executive summary', source: 'Goals, risks, approvals', included: true },
    { id: 'agent-performance', title: 'Agent performance', source: 'Agents and runs', included: true },
    { id: 'ticket-progress', title: 'Ticket progress', source: 'Tickets board', included: true },
    { id: 'cost-breakdown', title: 'Cost breakdown', source: 'Cost model', included: true },
    { id: 'audit-evidence', title: 'Audit evidence', source: 'Activities and artifacts', included: false },
  ];

  return {
    workspace: data.workspace,
    templates: [
      { id: 'weekly-ceo', title: 'Weekly CEO Report', owner: data.currentUser.name, cadence: 'Weekly', sections: 5 },
      { id: 'agent-ops', title: 'Agent Operations Review', owner: 'Operations Lead', cadence: 'Weekly', sections: 4 },
      { id: 'risk-cost', title: 'Risk and Cost Digest', owner: 'Risk Reviewer', cadence: 'Monthly', sections: 4 },
    ],
    reportSections,
    recipients: [
      data.currentUser.email,
      'ops@demo-company.local',
      'risk@demo-company.local',
    ],
    preview: {
      title: 'Weekly CEO Report',
      goalCount: data.goals.length,
      agentCount: data.agents.length,
      ticketCount: data.tickets.length,
      cost: currency(data.costBreakdown.total),
    },
    kpis: [
      { label: 'Sections', value: String(reportSections.length), tone: 'blue' },
      { label: 'Recipients', value: '3', tone: 'cyan' },
      { label: 'Data sources', value: '6', tone: 'purple' },
      { label: 'Schedule', value: 'Weekly', tone: 'green' },
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
  const blocked = projects.filter((project) => project.status !== 'On track').length;
  const projectTemplates = [
    { title: 'AI Chatbot Upgrade', column: 'Lên kế hoạch', progress: 18, owner: 'Product Agent', tone: 'blue', cost: '$260', tickets: 15, due: '15/08/2024' },
    { title: 'Data Warehouse Build', column: 'Lên kế hoạch', progress: 22, owner: 'Data Engineer Agent', tone: 'purple', cost: '$220', tickets: 8, due: '20/08/2024' },
    { title: 'HR Onboarding Flow', column: 'Lên kế hoạch', progress: 12, owner: 'HR Agent', tone: 'blue', cost: '$180', tickets: 6, due: '01/09/2024' },
    { title: 'GrowthOS V2 UI Parity', column: 'Đang triển khai', progress: 78, owner: 'CTO Agent', tone: 'cyan', cost: '$1,450', tickets: 16, due: '30/06/2024' },
    { title: 'Weekly CEO Reporting', column: 'Đang triển khai', progress: 84, owner: 'Report Agent', tone: 'blue', cost: '$360', tickets: 6, due: '30/06/2024' },
    { title: 'Marketing Content Factory', column: 'Có rủi ro', progress: 64, owner: 'CMO Agent', tone: 'amber', cost: '$1,120', tickets: 24, due: '15/07/2024' },
    { title: 'Social Media Automation', column: 'Có rủi ro', progress: 45, owner: 'Content Agent', tone: 'amber', cost: '$420', tickets: 9, due: '05/07/2024' },
    { title: 'CRM Automation Setup', column: 'Bị chặn', progress: 52, owner: 'Automation Agent', tone: 'red', cost: '$980', tickets: 18, due: '31/07/2024' },
    { title: 'Billing System Integration', column: 'Bị chặn', progress: 38, owner: 'Finance Agent', tone: 'red', cost: '$310', tickets: 7, due: '12/07/2024' },
    { title: 'Brand Guidelines 2024', column: 'Hoàn thành', progress: 100, owner: 'Design Agent', tone: 'green', cost: '$90', tickets: 3, due: '15/06/2024' },
    { title: 'Website Redesign', column: 'Hoàn thành', progress: 100, owner: 'Web Agent', tone: 'green', cost: '$160', tickets: 4, due: '10/06/2024' },
    { title: 'Lead Scoring Model', column: 'Hoàn thành', progress: 100, owner: 'Data Scientist Agent', tone: 'green', cost: '$130', tickets: 5, due: '05/06/2024' },
  ] satisfies Array<{ title: string; column: string; progress: number; owner: string; tone: Metric['tone']; cost: string; tickets: number; due: string }>;
  const projectColumns = ['Lên kế hoạch', 'Đang triển khai', 'Có rủi ro', 'Bị chặn', 'Hoàn thành'].map((column) => ({
    id: column,
    title: column,
    tone: column === 'Hoàn thành' ? 'green' : column === 'Bị chặn' ? 'red' : column === 'Có rủi ro' ? 'amber' : column === 'Đang triển khai' ? 'cyan' : 'blue',
    items: projectTemplates.filter((project) => project.column === column),
  }));
  const costBars = [
    { label: 'GrowthOS V2 UI Parity', value: 1450 },
    { label: 'Marketing Content Factory', value: 1120 },
    { label: 'CRM Automation Setup', value: 980 },
    { label: 'Weekly CEO Reporting', value: 360 },
    { label: 'Social Media Automation', value: 420 },
    { label: 'Billing System Integration', value: 310 },
    { label: 'AI Chatbot Upgrade', value: 260 },
    { label: 'Data Warehouse Build', value: 220 },
    { label: 'Khác', value: 180 },
  ];
  return {
    projects,
    projectColumns,
    costBars,
    statusBreakdown: [
      { label: 'Đang triển khai', value: 9, tone: 'cyan' },
      { label: 'Có rủi ro', value: 4, tone: 'amber' },
      { label: 'Bị chặn', value: 2, tone: 'red' },
      { label: 'Hoàn thành', value: 3, tone: 'green' },
      { label: 'Lên kế hoạch', value: 4, tone: 'purple' },
    ] satisfies Array<{ label: string; value: number; tone: Metric['tone'] }>,
    kpis: [
      { label: 'Tổng dự án', value: '18', caption: 'Tất cả dự án', tone: 'blue' },
      { label: 'Đang triển khai', value: '9', caption: '50% tổng số', tone: 'cyan' },
      { label: 'Có rủi ro', value: '4', caption: '22% tổng số', tone: 'amber' },
      { label: 'Bị chặn', value: '2', caption: '11% tổng số', tone: 'red' },
      { label: 'Hoàn thành', value: '3', caption: '17% tổng số', tone: 'green' },
      { label: 'Chi phí AI', value: '$6,240', caption: 'Tổng chi phí', tone: 'purple' },
    ] satisfies KpiViewModel[],
    recommendations: [
      { id: 'blocked-projects', title: `${Math.max(2, blocked)} dự án đang bị chặn`, text: 'do chờ approval', tone: 'red' },
      { id: 'late-content', title: 'Marketing Content Factory', text: 'đang chậm 5 ngày', tone: 'amber' },
      { id: 'budget-crm', title: 'CRM Automation đã dùng', text: '84% ngân sách', tone: 'purple' },
      { id: 'qa-agent', title: 'Nên thêm QA Agent vào', text: projects[0]?.title ?? 'GrowthOS V2 UI Parity', tone: 'blue' },
    ] satisfies Array<{ id: string; title: string; text: string; tone: Metric['tone'] }>,
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
  const templateOverrides: Record<string, { name: string; role: string; skills?: string[]; tools?: string[] }> = {
    'agent-hermes-qa': {
      name: 'Hermes QA Template',
      role: 'QA & Governance',
      skills: ['growthos-module-uat', 'ui-parity-audit', 'worktree-clean-check'],
      tools: ['File', 'Browser', 'Terminal'],
    },
    'agent-content': {
      name: 'Content Template',
      role: 'Content Agent',
      skills: ['tiktok-script-factory', 'brand-voice', 'content-calendar'],
      tools: ['Web', 'File', 'Creative'],
    },
    'agent-growth-strategy': {
      name: 'SEO Template',
      role: 'SEO Optimization',
      skills: ['seo-content-brief', 'keyword-research', 'internal-linking'],
      tools: ['Web', 'File'],
    },
    'agent-report': {
      name: 'Report Template',
      role: 'Reporting',
      skills: ['weekly-ceo-report', 'cost-report', 'project-progress-report'],
      tools: ['File', 'Productivity'],
    },
    'agent-research': {
      name: 'Research Template',
      role: 'Research & Strategy',
      skills: ['market-research', 'competitor-analysis', 'customer-insight'],
      tools: ['Web', 'File'],
    },
  };
  const order = ['agent-hermes-qa', 'agent-content', 'agent-growth-strategy', 'template-crm-automation', 'agent-report', 'agent-research'];
  const agentTemplates = data.agents.map((agent) => {
    const override = templateOverrides[agent.id];
    return {
    id: `template-${agent.id}`,
    name: override?.name ?? `${agent.role} Template`,
    agentName: agent.name,
    role: override?.role ?? agent.role,
    skills: override?.skills ?? agent.skills,
    tools: override?.tools ?? agent.tools,
    successRate: agent.successRate,
    tone: agentTone(agent),
    sourceAgentId: agent.id,
  };
  });
  const growthAgent = data.agents.find((agent) => agent.id === 'agent-growth-strategy') ?? data.agents[0];
  if (growthAgent) {
    agentTemplates.push({
      id: 'template-crm-automation',
      name: 'CRM Template',
      agentName: growthAgent.name,
      role: 'Sales & CRM',
      skills: ['crm-lead-segmentation', 'email-nurturing', 'lead-scoring'],
      tools: ['CRM', 'File', 'Web'],
      successRate: 90.6,
      tone: 'blue',
      sourceAgentId: 'template-crm-automation',
    });
  }
  const templates = agentTemplates.sort((a, b) => order.indexOf(a.sourceAgentId) - order.indexOf(b.sourceAgentId));
  return {
    templates,
    categories: ['All', 'Research', 'Content', 'QA', 'Reporting', 'Growth'],
  };
}

export function selectAgentPerformanceViewModel() {
  const data = currentData();
  const targetRows: Record<string, { displayName: string; role: string; completedTasks: number; successRate: number; avgCostPerTask: number; avgRunTime: string; failedRuns: number; reviewRate: number; quality: number; scatterCost: number; scatterQuality: number; order: number }> = {
    'agent-hermes-qa': { displayName: 'Hermes QA Agent', role: 'Quality Assurance', completedTasks: 312, successRate: 97.2, avgCostPerTask: 0.36, avgRunTime: '1m 24s', failedRuns: 5, reviewRate: 8.3, quality: 96.4, scatterCost: 0.35, scatterQuality: 96.4, order: 1 },
    'agent-research': { displayName: 'Research Agent', role: 'Research & Analysis', completedTasks: 286, successRate: 95.6, avgCostPerTask: 0.58, avgRunTime: '2m 13s', failedRuns: 7, reviewRate: 11.2, quality: 93.1, scatterCost: 0.64, scatterQuality: 93.1, order: 2 },
    'agent-content': { displayName: 'Content Agent', role: 'Content Creation', completedTasks: 254, successRate: 93.4, avgCostPerTask: 0.41, avgRunTime: '1m 47s', failedRuns: 9, reviewRate: 17.6, quality: 91.0, scatterCost: 0.42, scatterQuality: 91.0, order: 3 },
    'agent-growth-strategy': { displayName: 'SEO Agent', role: 'SEO Optimization', completedTasks: 198, successRate: 90.4, avgCostPerTask: 0.29, avgRunTime: '1m 32s', failedRuns: 11, reviewRate: 14.3, quality: 88.2, scatterCost: 0.29, scatterQuality: 88.2, order: 4 },
    'agent-report': { displayName: 'Report Agent', role: 'Report Generation', completedTasks: 234, successRate: 92.8, avgCostPerTask: 0.44, avgRunTime: '2m 05s', failedRuns: 6, reviewRate: 10.6, quality: 90.3, scatterCost: 0.45, scatterQuality: 84.0, order: 5 },
  };
  const performanceRows = data.agents.map((agent) => {
    const tickets = data.tickets.filter((ticket) => ticket.ownerAgentId === agent.id);
    const runs = data.runs.filter((run) => run.agentId === agent.id);
    const failedRuns = runs.filter((run) => run.status === 'failed').length + (agent.riskLevel === 'high' ? 1 : 0);
    const reviewRate = Math.max(6, Math.min(19, Math.round(28 - agent.policyCompliance / 4 + failedRuns * 2)));
    const avgCostPerTask = Number((agent.costMonthToDate / Math.max(120, tickets.length * 86 + runs.length * 42 + 150)).toFixed(2));
    const target = targetRows[agent.id];
    return {
      id: agent.id,
      name: target?.displayName ?? agent.name,
      role: target?.role ?? agent.role,
      health: agent.healthScore,
      trust: agent.trustScore,
      quality: target?.quality ?? agent.outputQuality,
      costEfficiency: agent.costEfficiency,
      successRate: target?.successRate ?? agent.successRate,
      completedTasks: target?.completedTasks ?? tickets.length * 78 + runs.length * 26 + Math.round(agent.successRate),
      workload: tickets.length + runs.length,
      cost: agent.costMonthToDate,
      avgCostPerTask: target?.avgCostPerTask ?? avgCostPerTask,
      avgRunTime: target?.avgRunTime ?? `${Math.max(1, Math.round(4 - agent.costEfficiency / 40))}m ${Math.max(12, 72 - agent.healthScore)}s`,
      failedRuns: target?.failedRuns ?? failedRuns,
      reviewRate: target?.reviewRate ?? reviewRate,
      scatterCost: target?.scatterCost ?? avgCostPerTask,
      scatterQuality: target?.scatterQuality ?? agent.outputQuality,
      order: target?.order ?? 99,
      risk: agent.riskLevel,
      tone: agentTone(agent),
    };
  }).sort((a, b) => a.order - b.order);
  const failureReasons = [
    { id: 'workspace-permission', label: 'Workspace permission denied', count: 16, percent: 25, tone: 'red' },
    { id: 'model-timeout', label: 'Model timeout', count: 11, percent: 17.2, tone: 'amber' },
    { id: 'tool-call-failed', label: 'Tool call failed', count: 6, percent: 9.4, tone: 'amber' },
    { id: 'missing-input', label: 'Missing input', count: 4, percent: 6.3, tone: 'blue' },
    { id: 'approval-not-granted', label: 'Approval not granted', count: 3, percent: 4.7, tone: 'cyan' },
    { id: 'invalid-file-path', label: 'Invalid file path', count: 2, percent: 3.1, tone: 'purple' },
  ] satisfies Array<{ id: string; label: string; count: number; percent: number; tone: string }>;
  const attentionAgents = performanceRows
    .filter((row) => row.risk === 'high' || row.failedRuns > 0 || row.reviewRate > 12 || row.costEfficiency < 86)
    .slice(0, 3)
    .map((row) => ({
      id: row.id,
      name: row.name,
      issue: row.risk === 'high' ? 'Failed runs tăng so với kỳ trước' : row.reviewRate > 12 ? `Human review rate cao (${row.reviewRate}%)` : 'Chi phí / task tăng',
      tone: row.risk === 'high' ? 'red' : row.costEfficiency < 86 ? 'cyan' : 'amber',
    }));
  const recommendations = [
    { id: 'hermes-uat', agent: performanceRows[0]?.name ?? 'Hermes QA Agent', text: 'có hiệu suất cao, có thể giao thêm UAT task.', tone: 'blue' },
    { id: 'research-cost', agent: 'Research Agent', text: 'có chi phí tăng, nên dùng model rẻ hơn cho task đơn giản.', tone: 'cyan' },
    { id: 'content-review', agent: 'Content Agent', text: 'có human review rate cao, nên thêm skill brand-voice-qa.', tone: 'green' },
    { id: 'seo-permission', agent: 'SEO Agent', text: 'có failed run tăng, cần kiểm tra web tool permission.', tone: 'purple' },
  ];
  return {
    rows: performanceRows,
    rankingRows: [...performanceRows].sort((a, b) => b.successRate - a.successRate),
    performanceRows,
    failureReasons,
    recommendations,
    attentionAgents,
    qualityCostPoints: performanceRows.map((row) => ({
      id: row.id,
      name: row.name,
      quality: row.scatterQuality,
      cost: row.scatterCost,
      tone: row.tone,
    })),
    kpis: [
      { label: 'Hiệu suất trung bình', value: '91.8%', delta: '+3.2%', tone: 'blue' },
      { label: 'Task hoàn thành', value: '1,284', delta: '+12.4%', tone: 'green' },
      { label: 'Tỷ lệ thành công', value: '93.6%', delta: '+2.8%', tone: 'blue' },
      { label: 'Chi phí / task', value: '$0.42', delta: '-6.1%', tone: 'cyan' },
      { label: 'Run thất bại', value: '38', delta: '-13.6%', tone: 'purple' },
      { label: 'Human intervention', value: '12.4%', delta: '-1.7%', tone: 'blue' },
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

export function selectIntegrationsHubViewModel() {
  const data = currentData();
  const discovery = selectHermesDiscovery();
  const readiness = selectRuntimeReadiness();
  const integrationRows = [
    {
      id: 'hermes',
      name: 'Hermes Runtime',
      category: `${discovery.models.length} models / ${discovery.tools.length} tools`,
      status: discovery.status === 'online' ? 'Connected' : discovery.status === 'missing_config' ? 'Missing config' : statusLabel(discovery.status),
      health: discovery.status === 'online' ? 98 : discovery.status === 'degraded' ? 76 : discovery.status === 'missing_config' ? 58 : 42,
      owner: 'Hermes QA Agent',
      lastSync: discovery.checkedAt.slice(0, 16).replace('T', ' '),
      events: discovery.capabilities.length + discovery.tools.length,
      risk: readiness.canStartRealRun ? 'Low' : 'Medium',
      tone: discovery.status === 'online' ? 'green' : discovery.status === 'degraded' ? 'amber' : 'blue',
    },
    { id: 'github', name: 'GitHub', category: 'Code repository', status: 'Connected', health: 96, owner: data.currentUser.name, lastSync: '12 minutes ago', events: 128, risk: 'Low', tone: 'green' },
    { id: 'slack', name: 'Slack', category: 'Team notifications', status: 'Connected', health: 92, owner: 'Operations Lead', lastSync: '18 minutes ago', events: 84, risk: 'Low', tone: 'green' },
    { id: 'notion', name: 'Notion', category: 'Knowledge base', status: 'Connected', health: 88, owner: 'Research Agent', lastSync: '41 minutes ago', events: 45, risk: 'Medium', tone: 'blue' },
    { id: 'hubspot', name: 'HubSpot CRM', category: 'Customer records', status: 'Review', health: 74, owner: 'Growth Strategy Agent', lastSync: '2 hours ago', events: 31, risk: 'Medium', tone: 'amber' },
    { id: 'gmail', name: 'Gmail', category: 'Customer communication', status: 'Approval required', health: 68, owner: 'Content Agent', lastSync: 'Paused', events: 12, risk: 'High', tone: 'red' },
  ];

  return {
    integrationRows,
    activityRows: getRecentActivities().slice(0, 6).map((activity) => ({
      id: activity.id,
      title: activity.title,
      description: activity.description,
      status: statusLabel(activity.status),
      createdAt: activity.createdAt.slice(0, 16),
    })),
    policyRows: [
      { id: 'write-approval', label: 'Production write approval', value: 'Required', tone: 'amber' },
      { id: 'audit-log', label: 'Audit logging', value: 'Enabled', tone: 'green' },
      { id: 'secret-read', label: 'Secret access', value: 'Blocked', tone: 'red' },
      { id: 'external-send', label: 'External send', value: 'Manual review', tone: 'purple' },
    ],
    kpis: [
      { label: 'Connected', value: String(integrationRows.filter((row) => row.status === 'Connected').length), tone: 'green' },
      { label: 'Needs review', value: String(integrationRows.filter((row) => row.status !== 'Connected').length), tone: 'amber' },
      { label: 'Sync events', value: String(integrationRows.reduce((sum, row) => sum + row.events, 0)), tone: 'blue' },
      { label: 'High risk', value: String(integrationRows.filter((row) => row.risk === 'High').length), tone: 'red' },
    ] satisfies KpiViewModel[],
  };
}

export function selectIntegrationDetailViewModel(integrationId = 'github') {
  const hub = selectIntegrationsHubViewModel();
  const integration = hub.integrationRows.find((row) => row.id === integrationId) ?? hub.integrationRows[0];
  const data = currentData();
  return {
    integration,
    scopes: [
      { id: 'read-metadata', label: 'Read metadata', status: 'Allowed', coverage: 100, tone: 'green' },
      { id: 'read-content', label: 'Read content', status: 'Allowed', coverage: 92, tone: 'green' },
      { id: 'write-content', label: 'Write content', status: 'Approval required', coverage: 64, tone: 'amber' },
      { id: 'admin-change', label: 'Admin changes', status: 'Blocked', coverage: 0, tone: 'red' },
    ],
    syncRuns: data.runs.map((run) => ({
      id: run.id,
      title: findTicket(run.ticketId).title,
      agent: findAgent(run.agentId).name,
      status: statusLabel(run.status),
      cost: currency(run.cost),
      startedAt: run.startedAt.slice(0, 16),
    })),
    auditRows: hub.activityRows,
    kpis: [
      { label: 'Health', value: `${integration.health}%`, tone: integration.tone as Metric['tone'] },
      { label: 'Events', value: String(integration.events), tone: 'blue' },
      { label: 'Scopes', value: '4', tone: 'purple' },
      { label: 'Risk', value: integration.risk, tone: integration.risk === 'High' ? 'red' : integration.risk === 'Medium' ? 'amber' : 'green' },
    ] satisfies KpiViewModel[],
  };
}

export function selectMcpServerManagerViewModel() {
  const data = currentData();
  const servers = [
    { id: 'mcp-filesystem', name: 'Filesystem MCP', environment: 'Local runtime', status: 'Online', latency: 42, tools: 8, owner: 'Hermes QA Agent', risk: 'Medium', tone: 'green' },
    { id: 'mcp-browser', name: 'Browser MCP', environment: 'Playwright runtime', status: 'Online', latency: 56, tools: 6, owner: 'Hermes QA Agent', risk: 'Medium', tone: 'green' },
    { id: 'mcp-docs', name: 'Docs MCP', environment: 'Knowledge workspace', status: 'Online', latency: 75, tools: 5, owner: 'Research Agent', risk: 'Low', tone: 'blue' },
    { id: 'mcp-crm', name: 'CRM MCP', environment: 'Sandbox connector', status: 'Restricted', latency: 120, tools: 4, owner: 'Growth Strategy Agent', risk: 'High', tone: 'amber' },
  ];

  return {
    servers,
    toolRows: [...new Set(data.agents.flatMap((agent) => agent.tools))].map((tool, index) => ({
      id: `mcp-tool-${index + 1}`,
      name: tool,
      server: servers[index % servers.length].name,
      agents: data.agents.filter((agent) => agent.tools.includes(tool)).length,
      status: index % 4 === 0 ? 'Approval required' : 'Enabled',
      tone: index % 4 === 0 ? 'amber' : 'green',
    })),
    policyRows: [
      { id: 'evidence', label: 'Tool call evidence', status: 'Required', tone: 'green' },
      { id: 'external-write', label: 'External writes', status: 'Approval required', tone: 'amber' },
      { id: 'secret-scope', label: 'Secret scopes', status: 'Blocked', tone: 'red' },
    ],
    kpis: [
      { label: 'MCP servers', value: String(servers.length), tone: 'blue' },
      { label: 'Online', value: String(servers.filter((server) => server.status === 'Online').length), tone: 'green' },
      { label: 'Tools', value: String(servers.reduce((sum, server) => sum + server.tools, 0)), tone: 'cyan' },
      { label: 'Restricted', value: String(servers.filter((server) => server.status !== 'Online').length), tone: 'amber' },
    ] satisfies KpiViewModel[],
  };
}

export function selectWorkspacesManagerViewModel() {
  const data = currentData();
  const workspaceRows = [
    { id: data.workspace.id, name: data.workspace.name, plan: data.workspace.plan, owner: data.currentUser.name, agents: data.agents.length, budget: data.workspace.aiBudgetMonthly, status: 'Active', region: 'Asia/Saigon', tone: 'green' },
    { id: 'workspace-growth-lab', name: 'Growth Lab Sandbox', plan: 'team', owner: 'Operations Lead', agents: 3, budget: 8000, status: 'Sandbox', region: 'Singapore', tone: 'blue' },
    { id: 'workspace-client-demo', name: 'Client Demo Workspace', plan: 'trial', owner: 'Risk Reviewer', agents: 2, budget: 3000, status: 'Review', region: 'US West', tone: 'amber' },
  ];

  return {
    workspaceRows,
    members: [
      data.currentUser,
      { id: 'user-ops', name: 'Operations Lead', email: 'ops@demo-company.local', role: 'operator' as const },
      { id: 'user-review', name: 'Risk Reviewer', email: 'risk@demo-company.local', role: 'reviewer' as const },
    ],
    usageRows: data.agents.map((agent) => ({
      id: agent.id,
      agent: agent.name,
      workspace: data.workspace.name,
      tickets: agent.currentTicketIds.length,
      runs: agent.currentRunIds.length,
      cost: currency(agent.costMonthToDate),
    })),
    kpis: [
      { label: 'Workspaces', value: String(workspaceRows.length), tone: 'blue' },
      { label: 'Active agents', value: String(data.agents.length), tone: 'green' },
      { label: 'Members', value: '3', tone: 'purple' },
      { label: 'Monthly budget', value: currency(workspaceRows.reduce((sum, row) => sum + row.budget, 0)), tone: 'cyan' },
    ] satisfies KpiViewModel[],
  };
}

export function selectSecretsManagerViewModel() {
  const data = currentData();
  const secretRows = [
    { id: 'secret-openai', name: 'OPENAI_API_KEY', scope: 'Runtime inference', owner: data.currentUser.name, status: 'Configured', rotation: '18 days', access: 'Runtime only', risk: 'Medium', tone: 'green' },
    { id: 'secret-github', name: 'GITHUB_TOKEN', scope: 'Repository sync', owner: 'Operations Lead', status: 'Configured', rotation: '42 days', access: 'Read metadata', risk: 'Low', tone: 'green' },
    { id: 'secret-crm', name: 'CRM_PRIVATE_APP_TOKEN', scope: 'HubSpot sandbox', owner: 'Growth Strategy Agent', status: 'Needs rotation', rotation: 'Overdue', access: 'Approval required', risk: 'High', tone: 'amber' },
    { id: 'secret-slack', name: 'SLACK_BOT_TOKEN', scope: 'Notifications', owner: 'Operations Lead', status: 'Configured', rotation: '64 days', access: 'Post messages', risk: 'Medium', tone: 'blue' },
  ];

  return {
    secretRows,
    accessRows: data.agents.map((agent) => ({
      id: agent.id,
      agent: agent.name,
      tools: agent.tools.length,
      policy: agent.riskLevel === 'high' ? 'Manual approval' : 'Scoped access',
      risk: riskLabel(agent.riskLevel),
    })),
    auditRows: getRecentActivities().slice(0, 5).map((activity) => ({
      id: activity.id,
      title: activity.title,
      status: statusLabel(activity.status),
      createdAt: activity.createdAt.slice(0, 16),
    })),
    kpis: [
      { label: 'Secrets', value: String(secretRows.length), tone: 'blue' },
      { label: 'Configured', value: String(secretRows.filter((row) => row.status === 'Configured').length), tone: 'green' },
      { label: 'Needs rotation', value: String(secretRows.filter((row) => row.status !== 'Configured').length), tone: 'amber' },
      { label: 'High risk', value: String(secretRows.filter((row) => row.risk === 'High').length), tone: 'red' },
    ] satisfies KpiViewModel[],
  };
}

export function selectTeamMembersViewModel() {
  const data = currentData();
  const members = [
    data.currentUser,
    { id: 'user-ops', name: 'Operations Lead', email: 'ops@demo-company.local', role: 'operator' as const },
    { id: 'user-review', name: 'Risk Reviewer', email: 'risk@demo-company.local', role: 'reviewer' as const },
  ];

  return {
    members: members.map((member, index) => ({
      ...member,
      status: index === 0 ? 'Active now' : index === 1 ? 'Active today' : 'Invited',
      lastSeen: index === 0 ? 'Now' : index === 1 ? '2 hours ago' : 'Pending',
      access: member.role === 'owner' ? 'Full workspace' : member.role === 'operator' ? 'Operations' : 'Review queue',
    })),
    agentOwnership: data.agents.map((agent) => ({
      id: agent.id,
      agent: agent.name,
      owner: agent.riskLevel === 'low' ? 'Operations Lead' : data.currentUser.name,
      tickets: agent.currentTicketIds.length,
      runs: agent.currentRunIds.length,
    })),
    invites: [
      { id: 'invite-finance', email: 'finance@demo-company.local', role: 'reviewer', status: 'Pending' },
      { id: 'invite-admin', email: 'admin@demo-company.local', role: 'operator', status: 'Draft' },
    ],
    kpis: [
      { label: 'Members', value: String(members.length), tone: 'blue' },
      { label: 'Active', value: '2', tone: 'green' },
      { label: 'Invites', value: '2', tone: 'amber' },
      { label: 'Agent owners', value: String(data.agents.length), tone: 'purple' },
    ] satisfies KpiViewModel[],
  };
}

export function selectRolesPermissionsViewModel() {
  const data = currentData();
  const roles = [
    { id: 'role-owner', name: 'Owner', members: 1, permissions: 12, description: 'Workspace, billing, policy and all operational controls.', tone: 'purple' },
    { id: 'role-operator', name: 'Operator', members: 1, permissions: 8, description: 'Agent operations, tickets, runs and reports.', tone: 'blue' },
    { id: 'role-reviewer', name: 'Reviewer', members: 1, permissions: 5, description: 'Approvals, risk review and audit evidence.', tone: 'amber' },
  ];

  return {
    roles,
    permissionRows: [
      { id: 'agent-control', module: 'Agent control', owner: 'Operator', status: 'Allowed', risk: 'Medium', tone: 'green' },
      { id: 'budget-change', module: 'Budget changes', owner: 'Owner', status: 'Approval required', risk: 'High', tone: 'amber' },
      { id: 'secret-access', module: 'Secret access', owner: 'Owner', status: 'Blocked by default', risk: 'High', tone: 'red' },
      { id: 'report-export', module: 'Report export', owner: 'Reviewer', status: 'Allowed', risk: 'Low', tone: 'blue' },
      { id: 'integration-write', module: 'Integration writes', owner: 'Owner', status: 'Manual review', risk: 'High', tone: 'amber' },
    ],
    policyCoverage: data.agents.map((agent) => ({
      id: agent.id,
      label: agent.name,
      value: agent.policyCompliance,
      tone: agent.policyCompliance > 90 ? 'green' : 'amber',
    })),
    kpis: [
      { label: 'Roles', value: String(roles.length), tone: 'blue' },
      { label: 'Permissions', value: String(roles.reduce((sum, role) => sum + role.permissions, 0)), tone: 'purple' },
      { label: 'High risk rules', value: '3', tone: 'red' },
      { label: 'Coverage', value: `${Math.round(data.agents.reduce((sum, agent) => sum + agent.policyCompliance, 0) / data.agents.length)}%`, tone: 'green' },
    ] satisfies KpiViewModel[],
  };
}

export function selectSystemSettingsViewModel() {
  const data = currentData();
  return {
    workspace: data.workspace,
    settings: [
      { id: 'timezone', label: 'Workspace timezone', value: 'Asia/Saigon', status: 'Enabled', tone: 'blue' },
      { id: 'audit-retention', label: 'Audit retention', value: '180 days', status: 'Enabled', tone: 'green' },
      { id: 'workflow-mode', label: 'Workflow mode', value: 'Human-in-the-loop', status: 'Enabled', tone: 'purple' },
      { id: 'failure-policy', label: 'Failure rollback', value: 'Automatic', status: 'Enabled', tone: 'green' },
      { id: 'external-actions', label: 'External actions', value: 'Manual approval', status: 'Restricted', tone: 'amber' },
    ],
    notificationRows: [
      { id: 'approval', label: 'Approval requests', channel: 'In-app + email', status: 'On', tone: 'green' },
      { id: 'budget', label: 'Budget warnings', channel: 'In-app', status: 'On', tone: 'green' },
      { id: 'risk', label: 'Risk alerts', channel: 'In-app + email', status: 'On', tone: 'amber' },
      { id: 'weekly', label: 'Weekly reports', channel: 'Email', status: 'On', tone: 'blue' },
    ],
    kpis: [
      { label: 'Settings', value: '5', tone: 'blue' },
      { label: 'Notifications', value: '4', tone: 'cyan' },
      { label: 'Guardrails', value: String(data.approvals.length), tone: 'purple' },
      { label: 'Audit days', value: '180', tone: 'green' },
    ] satisfies KpiViewModel[],
  };
}

export function selectBillingPlanViewModel() {
  const data = currentData();
  const used = data.costBreakdown.total;
  const planRows = [
    { id: 'current', name: 'Enterprise', price: '$1,250/mo', agents: 'Unlimited', status: 'Current', tone: 'green' },
    { id: 'growth', name: 'Growth', price: '$499/mo', agents: '25 agents', status: 'Available', tone: 'blue' },
    { id: 'demo', name: 'Demo', price: '$99/mo', agents: '5 agents', status: 'Downgrade locked', tone: 'slate' },
  ];

  return {
    workspace: data.workspace,
    planRows,
    invoiceRows: [
      { id: 'invoice-may', period: 'May 2026', amount: '$1,250', status: 'Paid', due: '2026-05-01' },
      { id: 'invoice-apr', period: 'April 2026', amount: '$1,250', status: 'Paid', due: '2026-04-01' },
      { id: 'invoice-mar', period: 'March 2026', amount: '$1,250', status: 'Paid', due: '2026-03-01' },
    ],
    usageRows: data.costBreakdown.byAgent.map((item) => ({
      id: item.id,
      label: item.label,
      value: item.value,
      percent: item.percent,
      tone: item.percent > 28 ? 'amber' : 'blue',
    })),
    kpis: [
      { label: 'Current plan', value: data.workspace.plan, tone: 'purple' },
      { label: 'AI budget', value: currency(data.workspace.aiBudgetMonthly), tone: 'blue' },
      { label: 'MTD usage', value: currency(used), tone: 'amber' },
      { label: 'Remaining', value: currency(Math.max(0, data.workspace.aiBudgetMonthly - used)), tone: 'green' },
    ] satisfies KpiViewModel[],
  };
}

export function selectHelpTemplateCenterViewModel() {
  const data = currentData();
  const templates = [
    { id: 'template-ticket', title: 'Create a scoped AI ticket', category: 'Ticket workflow', owner: 'Operations', status: 'Recommended', tone: 'blue' },
    { id: 'template-agent', title: 'Launch a new agent safely', category: 'Agent setup', owner: 'AI operations', status: 'Popular', tone: 'green' },
    { id: 'template-approval', title: 'Review high-risk approval', category: 'Governance', owner: 'Risk review', status: 'Required', tone: 'amber' },
    { id: 'template-report', title: 'Build weekly executive report', category: 'Reporting', owner: 'Leadership', status: 'Recommended', tone: 'purple' },
  ];

  return {
    templates,
    helpRows: [
      { id: 'getting-started', title: 'Getting started with AI Workforce OS', kind: 'Guide', time: '8 min' },
      { id: 'workflow-actions', title: 'Understanding optimistic workflow actions', kind: 'Guide', time: '6 min' },
      { id: 'structural-gates', title: 'Real UI structural gates and visual polish', kind: 'Reference', time: '10 min' },
      { id: 'security-policy', title: 'Secrets, roles and approval guardrails', kind: 'Policy', time: '7 min' },
    ],
    supportRows: [
      { id: 'support-chat', label: 'Support chat', value: 'Business hours', tone: 'green' },
      { id: 'status-page', label: 'System status', value: 'Operational', tone: 'green' },
      { id: 'feedback', label: 'Product feedback', value: 'Open', tone: 'blue' },
    ],
    kpis: [
      { label: 'Templates', value: String(templates.length), tone: 'blue' },
      { label: 'Guides', value: '4', tone: 'green' },
      { label: 'Agent flows', value: String(data.agents.length), tone: 'purple' },
      { label: 'Support status', value: 'Online', tone: 'cyan' },
    ] satisfies KpiViewModel[],
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
