import { DEMO_AGENT_ID, DEMO_APPROVAL_ID, DEMO_RUN_ID, DEMO_TICKET_ID, demoRuns, demoTickets } from '../../data/demo-fixtures';
import type { Activity, Approval, Artifact, Run, RunLog, RunStatus, ToolCall } from '../../domain/types';
import { createHermesAdapter } from '../hermes/hermes-adapter';
import { discoverHermes } from '../hermes/hermes-discovery-client';
import { buildHermesToolRegistry, getDefaultRuntimeTools, type HermesTool } from '../hermes/hermes-tool-registry';
import { createRunPlan, type RunPlan, type RunPlanStep } from './run-planner';
import { evaluatePlanPolicy, getApprovalRequiredSteps, type PlanExecutionPolicyReport } from './plan-policy';
import type { HermesExecution, HermesTask } from '../hermes/hermes-types';
import { createPaperclipAdapter } from '../paperclip/paperclip-adapter';
import { mapHermesExecutionToRun, mapHermesStatusToLifecycle, mapHermesStatusToRunStatus, mapPaperclipArtifactToArtifact } from './run-event-mapper';
import { mapTicketToHermesTask } from './ticket-to-task-mapper';
import type { RunStreamEvent, RunStreamEventType, RuntimeActionPlan, RuntimeDecisionOutcome, RuntimeMode, RuntimeReadiness, RuntimeRunCommand, RuntimeStreamResult, RuntimeToolCall, RuntimeToolCallStatus } from './runtime-types';
import { resolveRuntimeConfig } from './runtime-config';
import { checkRuntimeHealth } from './runtime-health';
import { getApprovalById, upsertApproval } from '../../runtime-store/approval-store';
import { upsertArtifact } from '../../runtime-store/artifact-store';
import { appendRuntimeEvent } from '../../runtime-store/event-store';
import { getRunById, setRunLifecycle, upsertRun } from '../../runtime-store/run-store';
import type { RuntimeLifecycle } from '../../runtime-store/runtime-persistence';
import { appendStreamEvent, clearStream, getStreamEvents, isStreamComplete, markStreamComplete } from '../../runtime-store/stream-store';
import { clearToolCalls, getToolCallById, upsertRuntimeToolCall } from '../../runtime-store/tool-call-store';
import { getHermesDiscovery, setHermesDiscovery } from '../../runtime-store/hermes-discovery-store';
import { getToolRegistry, setToolRegistry } from '../../runtime-store/tool-registry-store';
import { getRunPlan, markRunPlanApproved, upsertRunPlan } from '../../runtime-store/run-plan-store';
import { upsertPolicyReport } from '../../runtime-store/plan-policy-store';

const runtimeConfig = resolveRuntimeConfig();
const hermes = createHermesAdapter(runtimeConfig.hermes.mode, runtimeConfig.hermes);
const paperclip = createPaperclipAdapter(runtimeConfig.paperclip.mode, runtimeConfig.paperclip);

export async function refreshHermesDiscovery() {
  const discovery = setHermesDiscovery(await discoverHermes());
  setToolRegistry(buildHermesToolRegistry(discovery));
  return discovery;
}

export function createPlanForTicket(ticketId: string, workflowId = 'demo-run-execution'): RunPlan {
  const plan = upsertRunPlan(createRunPlan(ticketId, workflowId));
  const policyReport = upsertPolicyReport(evaluatePlanPolicy(plan.id));
  appendRuntimeEvent({
    command: 'createRunPlan',
    entityType: 'ticket',
    entityId: ticketId,
    actorId: DEMO_AGENT_ID,
    title: policyReport.status === 'blocked' ? `Run plan blocked: ${workflowId}` : `Run plan policy ${policyReport.status}: ${workflowId}`,
    status: policyReport.status === 'blocked' ? 'failed' : policyReport.status === 'warning' ? 'pending' : 'success',
  });
  return plan;
}

export function approveRunPlan(planId: string): RunPlan {
  const plan = markRunPlanApproved(planId);
  upsertPolicyReport(evaluatePlanPolicy(plan.id));
  appendRuntimeEvent({
    command: 'approveRunPlan',
    entityType: 'ticket',
    entityId: plan.ticketId,
    actorId: DEMO_AGENT_ID,
    title: `Run plan approved: ${plan.workflowId}`,
    status: 'success',
  });
  return plan;
}

export function getRuntimeReadiness(): RuntimeReadiness {
  const config = resolveRuntimeConfig();
  const discovery = getHermesDiscovery();
  const canStartRealRun = discovery.status === 'online' || discovery.status === 'degraded';
  const paperclipStatus = config.paperclip.status;
  return {
    mode: config.mode,
    requestedMode: config.requestedMode,
    hermesStatus: discovery.status,
    paperclipStatus,
    canStartRealRun,
    canStartMockRun: true,
    warnings: [
      ...discovery.warnings,
      ...(config.paperclip.reason === 'missing-config' ? ['Paperclip sandbox config missing; mock fallback remains available.'] : []),
    ],
    checkedAt: discovery.checkedAt,
  };
}

export async function discoverRuntime(): Promise<RuntimeReadiness> {
  const [discovery, health] = await Promise.all([
    refreshHermesDiscovery(),
    checkRuntimeHealth().catch(() => undefined),
  ]);
  const readiness = getRuntimeReadiness();
  return {
    ...readiness,
    hermesStatus: discovery.status,
    paperclipStatus: health?.paperclip.status ?? readiness.paperclipStatus,
    warnings: [
      ...discovery.warnings,
      ...(health?.paperclip.status === 'offline' ? [health.paperclip.message] : []),
    ],
    checkedAt: discovery.checkedAt,
  };
}

function runtimeNow() {
  return new Date().toISOString();
}

function runtimeLog(id: string, message: string, level: RunLog['level'] = 'info'): RunLog {
  return { id, timestamp: runtimeNow(), level, message };
}

function runtimeTool(id: string, toolName: string, status: ToolCall['status'], inputSummary: string, outputSummary: string, cost = 0.002): ToolCall {
  const now = runtimeNow();
  return {
    id,
    toolName,
    status,
    inputSummary,
    outputSummary,
    durationMs: status === 'running' ? 900 : 2400,
    cost,
    startedAt: now,
    finishedAt: status === 'running' ? undefined : now,
  };
}

interface StreamToolConfig {
  id: string;
  name: string;
  input: string;
  progress: string;
  output: string;
  cost: number;
  supportsArtifacts: boolean;
  supportsApproval: boolean;
}

function toStreamToolConfig(tool: HermesTool, index: number): StreamToolConfig {
  return {
    id: tool.id,
    name: tool.name,
    input: `${tool.description} Runtime input from ticket context and current run state.`,
    progress: `${tool.name} execution ${index === 0 ? 65 : index === 1 ? 70 : 80}% complete`,
    output: `Completed successfully. ${tool.description}`,
    cost: 0.003 + index * 0.001,
    supportsArtifacts: tool.supportsArtifacts,
    supportsApproval: tool.supportsApproval,
  };
}

function streamToolConfigs(): StreamToolConfig[] {
  return getDefaultRuntimeTools(getToolRegistry(), 3).map(toStreamToolConfig);
}

function streamToolAt(index: number): StreamToolConfig {
  const tools = streamToolConfigs();
  return tools[index] ?? tools[0];
}

function streamArtifactToolId(): string {
  const tools = streamToolConfigs();
  return tools.find((tool) => tool.supportsArtifacts)?.id ?? streamToolAt(2).id;
}

function streamToolConfig(toolId: string): StreamToolConfig {
  const tools = streamToolConfigs();
  return tools.find((tool) => tool.id === toolId) ?? tools[0];
}

function runtimeToolStatusToDomain(status: RuntimeToolCallStatus): ToolCall['status'] {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'failed';
  return 'running';
}

function runtimeToolCall(toolId: string, runId: string, status: RuntimeToolCallStatus, metadata: Record<string, unknown> = {}): RuntimeToolCall {
  const config = streamToolConfig(toolId);
  const existing = getToolCallById(toolId);
  const now = runtimeNow();
  return {
    id: toolId,
    runId,
    toolName: config.name,
    status,
    startedAt: existing?.startedAt ?? now,
    finishedAt: status === 'completed' || status === 'failed' ? now : existing?.finishedAt,
    input: config.input,
    output: status === 'completed' ? config.output : existing?.output,
    durationMs: status === 'completed' || status === 'failed' ? Math.max(1200, new Date(now).getTime() - new Date(existing?.startedAt ?? now).getTime()) : existing?.durationMs,
    metadata: {
      ...existing?.metadata,
      cost: config.cost,
      progress: status === 'completed' ? 100 : status === 'running' ? 55 : 0,
      ...metadata,
    },
  };
}

function runtimeToolCallToDomain(toolCall: RuntimeToolCall): ToolCall {
  const cost = typeof toolCall.metadata?.cost === 'number' ? toolCall.metadata.cost : 0.002;
  return {
    id: toolCall.id,
    toolName: toolCall.toolName,
    status: runtimeToolStatusToDomain(toolCall.status),
    inputSummary: toolCall.input,
    outputSummary: toolCall.output ?? (toolCall.status === 'running' ? 'Tool execution in progress' : 'Queued for execution'),
    durationMs: toolCall.durationMs ?? 0,
    cost,
    startedAt: toolCall.startedAt,
    finishedAt: toolCall.finishedAt,
  };
}

function persistStreamTool(run: Run, toolId: string, status: RuntimeToolCallStatus, metadata?: Record<string, unknown>) {
  const toolCall = upsertRuntimeToolCall(runtimeToolCall(toolId, run.id, status, metadata));
  return {
    toolCall,
    toolCalls: upsertTool(run.toolCalls, runtimeToolCallToDomain(toolCall)),
  };
}

function runtimeOutputArtifacts(runId: string, now = runtimeNow(), toolId?: string): Artifact[] {
  return [
    {
      id: `paperclip-${runId}-qa-packet`,
      runId,
      toolId,
      type: 'markdown',
      name: 'Paperclip_QA_Runtime_Packet.md',
      contentSummary: 'Evidence packet with acceptance checks, risk notes, and recommended follow-up for the Hermes run.',
      contentText: [
        '# Paperclip QA Runtime Packet',
        '',
        '## Verdict',
        'Conditional pass. Hermes completed the runtime checklist and generated a human-readable review packet.',
        '',
        '## Evidence',
        '- Ticket context mapped into Hermes task input.',
        '- Tool calls captured with duration and cost metadata.',
        '- Human approval gate recorded before external execution.',
        '',
        '## Follow-up',
        'Review the JSON trace and patch-style action list before closing the ticket.',
      ].join('\n'),
      language: 'markdown',
      createdAt: now,
      source: 'paperclip',
      sizeBytes: 1842,
    },
    {
      id: `hermes-${runId}-tool-output-json`,
      runId,
      toolId,
      type: 'json',
      name: 'hermes-runtime-output.json',
      contentSummary: 'Structured Hermes tool output normalized for GrowthOS runtime inspection.',
      contentJson: {
        runId,
        verdict: 'conditional_pass',
        checksCompleted: 12,
        approvalRequired: true,
        estimatedRisk: 'medium',
      },
      language: 'json',
      createdAt: now,
      source: 'hermes',
      sizeBytes: 642,
    },
    {
      id: `paperclip-${runId}-follow-up-patch`,
      runId,
      toolId,
      type: 'patch',
      name: 'follow-up-actions.patch',
      contentSummary: 'Patch-style follow-up checklist generated from the Paperclip review packet.',
      contentText: [
        'diff --git a/runtime-checklist.md b/runtime-checklist.md',
        '--- a/runtime-checklist.md',
        '+++ b/runtime-checklist.md',
        '@@ -1,3 +1,6 @@',
        ' - Verify generated artifact lineage',
        ' - Attach QA packet to ticket timeline',
        '+- Confirm approval gate decision',
        '+- Capture final Hermes run status',
        '+- Archive runtime JSON output',
      ].join('\n'),
      language: 'diff',
      createdAt: now,
      source: 'paperclip',
      sizeBytes: 512,
    },
  ];
}

function mergeArtifacts(primary: Artifact[], secondary: Artifact[]): Artifact[] {
  const seen = new Set<string>();
  return [...primary, ...secondary].filter((artifact) => {
    if (seen.has(artifact.id)) return false;
    seen.add(artifact.id);
    return true;
  });
}

function fallbackTask(ticketId: string): HermesTask {
  return {
    id: `hermes-task-${ticketId}`,
    ticketId,
    agentId: DEMO_AGENT_ID,
    title: 'Runtime ticket execution',
    prompt: 'Simulated Sprint 6A Hermes runtime task.',
    priority: 'high',
    riskLevel: 'medium',
    acceptanceCriteria: ['Map ticket', 'Run Hermes tool chain', 'Create Paperclip artifact', 'Open approval gate'],
    tags: ['runtime', 'paperclip', 'hermes'],
  };
}

function createRuntimeRun(existingRun: Run, task: HermesTask): Run {
  const now = runtimeNow();
  const artifacts = mergeArtifacts(runtimeOutputArtifacts(existingRun.id, now), existingRun.artifacts);

  return {
    ...existingRun,
    status: 'running',
    currentStep: 'Waiting for human approval gate',
    elapsedSeconds: Math.max(existingRun.elapsedSeconds, 18),
    cost: Math.max(existingRun.cost, 0.038),
    riskLevel: task.riskLevel,
    steps: [
      { id: 'runtime-step-context', name: 'Mapped ticket into Hermes task', status: 'success', startedAt: now, durationSeconds: 2, cost: 0.001 },
      { id: 'runtime-step-tools', name: 'Selected runtime tools', status: 'success', startedAt: now, durationSeconds: 3, cost: 0.002 },
      { id: 'runtime-step-approval', name: 'Human approval required', status: 'warning', startedAt: now, durationSeconds: 1, cost: 0 },
      ...existingRun.steps.filter((step) => !step.id.startsWith('runtime-step-')),
    ],
    toolCalls: [
      runtimeTool('runtime-tool-read-context', 'Read Context', 'success', task.title, 'Ticket context loaded into Hermes runtime'),
      runtimeTool('runtime-tool-plan', 'Plan Execution', 'success', 'acceptance criteria', 'Execution checklist generated', 0.004),
      runtimeTool('runtime-tool-approval', 'Request Approval', 'warning', 'terminal command approval', 'Human approval gate opened', 0),
      ...existingRun.toolCalls.filter((tool) => !tool.id.startsWith('runtime-tool-')),
    ],
    logs: [
      runtimeLog('runtime-log-started', `Hermes accepted task ${task.id}`),
      runtimeLog('runtime-log-context', 'Mapped ticket context and criteria'),
      runtimeLog('runtime-log-approval', 'Approval required before external tool execution', 'warn'),
      ...existingRun.logs.filter((log) => !log.id.startsWith('runtime-log-')),
    ],
    artifacts,
  };
}

function persistRuntimeBundle(run: Run, approval?: Approval) {
  const lifecycle = run.currentStep.toLowerCase().includes('approval') ? 'WAITING_APPROVAL' : 'RUNNING';
  upsertRun(run, lifecycle);
  run.artifacts.forEach((artifact) => upsertArtifact(artifact));
  if (approval) upsertApproval(approval);
}

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  return items.some((item) => item.id === next.id)
    ? items.map((item) => item.id === next.id ? next : item)
    : [next, ...items];
}

function activity(id: string, title: string, description: string, relatedTicketId?: string, relatedRunId?: string): Activity {
  return {
    id,
    type: 'run',
    title,
    description,
    actorAgentId: DEMO_AGENT_ID,
    relatedTicketId,
    relatedRunId,
    createdAt: runtimeNow(),
    status: 'running',
  };
}

function runtimeApproval(existing: Approval | undefined, ticketId: string, runId: string, agentId: string, toolId?: string): Approval {
  const now = runtimeNow();
  return {
    id: existing?.id ?? DEMO_APPROVAL_ID,
    ticketId,
    runId,
    toolId,
    agentId,
    title: 'Hermes runtime approval required',
    description: 'Paperclip captured a runtime evidence packet. Hermes needs human approval before external command execution.',
    status: 'pending',
    severity: 'medium',
    requestedAt: now,
    requestedBy: agentId,
    policy: 'human-approval-runtime-tool-call',
    auditTrail: [
      ...(existing?.auditTrail ?? []),
      { id: `audit-runtime-${runId}`, actorId: agentId, action: 'created Hermes runtime approval gate', createdAt: now },
    ],
  };
}

function planPolicyApproval(plan: RunPlan, runId: string, step: RunPlanStep): Approval {
  const now = runtimeNow();
  const approval: Approval = {
    id: `approval-policy-${plan.id}-${step.id}`,
    ticketId: plan.ticketId,
    runId,
    toolId: step.toolId,
    agentId: DEMO_AGENT_ID,
    title: `Plan policy approval: ${step.name}`,
    description: `Run plan ${plan.workflowId} requires human approval before executing ${step.name}.`,
    status: 'pending',
    severity: step.capabilityId === 'deployment' ? 'high' : 'medium',
    requestedAt: now,
    requestedBy: DEMO_AGENT_ID,
    policy: 'plan-execution-policy',
    auditTrail: [
      {
        id: `audit-policy-${plan.id}-${step.id}`,
        actorId: DEMO_AGENT_ID,
        action: 'created plan execution policy approval gate',
        createdAt: now,
      },
    ],
  };
  return { ...approval, planId: plan.id, stepId: step.id } as Approval;
}

function budgetPolicyApproval(plan: RunPlan, runId: string, estimateCost: number): Approval {
  const now = runtimeNow();
  const approval: Approval = {
    id: `approval-budget-${plan.id}`,
    ticketId: plan.ticketId,
    runId,
    agentId: DEMO_AGENT_ID,
    title: `Budget approval: ${plan.workflowId}`,
    description: `Estimated runtime cost $${estimateCost.toFixed(3)} requires budget review before execution continues.`,
    status: 'pending',
    severity: estimateCost > 0.1 ? 'high' : 'medium',
    requestedAt: now,
    requestedBy: DEMO_AGENT_ID,
    policy: 'budget-execution-review',
    auditTrail: [
      {
        id: `audit-budget-${plan.id}-${now}`,
        actorId: DEMO_AGENT_ID,
        action: 'created execution budget approval gate',
        createdAt: now,
      },
    ],
  };
  return { ...approval, planId: plan.id } as Approval;
}

function baseRunForTicket(ticketId: string): Run | undefined {
  const ticket = demoTickets.find((item) => item.id === ticketId);
  const runId = ticket?.runId ?? (ticketId === DEMO_TICKET_ID ? DEMO_RUN_ID : undefined);
  return runId ? getRunById(runId) ?? demoRuns.find((run) => run.id === runId) : undefined;
}

function baseRunById(runId: string): Run | undefined {
  return getRunById(runId) ?? demoRuns.find((run) => run.id === runId);
}

function executionWithApprovalSignal(execution: HermesExecution): HermesExecution {
  const indicatesApproval = execution.status === 'waiting_for_approval' || execution.currentStep.toLowerCase().includes('approval');
  return indicatesApproval ? { ...execution, status: 'waiting_for_approval' } : execution;
}

function appendLifecycleEvent(command: Parameters<typeof appendRuntimeEvent>[0]['command'], run: Run, title: string, status: 'pending' | 'success' | 'failed' = 'success') {
  appendRuntimeEvent({
    command,
    entityType: 'run',
    entityId: run.id,
    actorId: run.agentId,
    title,
    status,
  });
}

function appendStreamLifecycleEvent(run: Run, type: RunStreamEventType, message: string, payload?: Record<string, unknown>): RunStreamEvent {
  const event = appendStreamEvent(run.id, { type, message, payload });
  appendRuntimeEvent({
    command: type,
    entityType: 'run',
    entityId: run.id,
    actorId: run.agentId,
    title: message,
    status: type === 'run.failed' ? 'failed' : ['run.queued', 'tool.started', 'tool.progress', 'approval.requested'].includes(type) ? 'pending' : 'success',
  });
  return event;
}

function appendExecutionEvents(run: Run) {
  run.toolCalls.forEach((tool) => {
    appendRuntimeEvent({
      command: tool.status === 'running' ? 'tool.started' : 'tool.completed',
      entityType: 'run',
      entityId: run.id,
      actorId: run.agentId,
      title: `${tool.toolName}: ${tool.outputSummary}`,
      status: tool.status === 'failed' ? 'failed' : tool.status === 'running' ? 'pending' : 'success',
    });
  });
  run.artifacts.forEach((artifact) => {
    appendRuntimeEvent({
      command: 'artifact.created',
      entityType: 'run',
      entityId: run.id,
      actorId: run.agentId,
      title: `Artifact created: ${artifact.name}`,
      status: 'success',
    });
  });
}

function streamStep(runId: string, name: string, status: Run['steps'][number]['status'], durationSeconds = 1, cost = 0): Run['steps'][number] {
  return { id: `stream-step-${runId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, status, startedAt: runtimeNow(), durationSeconds, cost };
}

function upsertStep(steps: Run['steps'], next: Run['steps'][number]): Run['steps'] {
  return upsertById(steps, next);
}

function upsertTool(tools: ToolCall[], next: ToolCall): ToolCall[] {
  return upsertById(tools, next);
}

function updateStreamRun(run: Run, patch: Partial<Run>, lifecycle: RuntimeLifecycle): Run {
  const nextRun = {
    ...run,
    ...patch,
    logs: patch.logs ?? run.logs,
    steps: patch.steps ?? run.steps,
    toolCalls: patch.toolCalls ?? run.toolCalls,
    artifacts: patch.artifacts ?? run.artifacts,
  };
  upsertRun(nextRun, lifecycle);
  nextRun.artifacts.forEach((artifact) => upsertArtifact(artifact));
  return nextRun;
}

function streamResult(run: Run, event: RunStreamEvent, complete = false): RuntimeStreamResult {
  return {
    runId: run.id,
    status: run.status,
    message: event.message,
    event,
    complete,
  };
}

function currentStreamSequence(runId: string): number {
  return getStreamEvents(runId).length;
}

function createQueuedStreamRun(ticketId: string): Run {
  const ticket = demoTickets.find((item) => item.id === ticketId);
  const existingRun = baseRunForTicket(ticketId);
  if (!ticket || !existingRun) {
    throw new Error(`Cannot start streaming run for missing ticket ${ticketId}`);
  }
  const task = mapTicketToHermesTask(ticket);
  return {
    ...existingRun,
    ticketId: ticket.id,
    agentId: task.agentId,
    status: 'queued',
    currentStep: 'Live stream queued',
    elapsedSeconds: 0,
    logs: [
      runtimeLog(`stream-log-queued-${ticket.id}`, 'Streaming Hermes run queued'),
      ...existingRun.logs.filter((log) => !log.id.startsWith('stream-log-')),
    ],
    steps: [
      streamStep(existingRun.id, 'Streaming run queued', 'running', 0, 0),
      ...existingRun.steps.filter((step) => !step.id.startsWith('stream-step-')),
    ],
  };
}

export async function startStreamingRun(ticketId: string): Promise<RuntimeStreamResult> {
  const queuedRun = createQueuedStreamRun(ticketId);
  clearStream(queuedRun.id);
  clearToolCalls(queuedRun.id);
  const run = updateStreamRun(queuedRun, {}, 'QUEUED');
  const event = appendStreamLifecycleEvent(run, 'run.queued', 'Hermes live stream queued', { ticketId });
  return streamResult(run, event);
}

function seedPlanToolCalls(plan: RunPlan, runId: string) {
  const registry = getToolRegistry();
  const now = runtimeNow();
  plan.steps
    .filter((step) => step.toolId && step.status === 'planned')
    .forEach((step) => {
      const tool = registry.tools.find((item) => item.id === step.toolId);
      upsertRuntimeToolCall({
        id: `${runId}-${step.id}`,
        runId,
        toolName: tool?.name ?? step.toolId ?? step.name,
        status: 'queued',
        startedAt: now,
        input: `${step.name} for ${plan.workflowId}`,
        output: undefined,
        durationMs: 0,
        metadata: {
          sourcePlanId: plan.id,
          planStepId: step.id,
          capabilityId: step.capabilityId,
          expectedOutputType: step.expectedOutputType,
          requiresApproval: step.requiresApproval,
          modelId: step.modelId,
          cost: 0,
          progress: 0,
        },
      });
    });
}

export async function startRunFromPlan(planId: string): Promise<RuntimeStreamResult> {
  const plan = getRunPlan(planId);
  if (!plan) throw new Error(`Cannot start missing run plan ${planId}`);
  const policyReport: PlanExecutionPolicyReport = upsertPolicyReport(evaluatePlanPolicy(plan.id));
  if (plan.status === 'blocked' || policyReport.status === 'blocked') {
    appendRuntimeEvent({
      command: 'startRunFromPlan',
      entityType: 'run',
      entityId: plan.id,
      actorId: DEMO_AGENT_ID,
      title: `Run plan blocked by policy: ${policyReport.blockingReasons.join(', ') || plan.missingCapabilities.join(', ') || 'blocked steps'}`,
      status: 'failed',
    });
    throw new Error(`Cannot start blocked run plan ${planId}: ${policyReport.blockingReasons.join(', ') || plan.missingCapabilities.join(', ') || 'blocked steps'}`);
  }
  const result = await startStreamingRun(plan.ticketId);
  seedPlanToolCalls(plan, result.runId);
  const approvalSteps = getApprovalRequiredSteps(plan);
  const budgetEstimateCost = policyReport.executionEstimate?.estimatedCost ?? 0;
  const needsBudgetApproval = budgetEstimateCost > 0.05;
  if (approvalSteps.length) {
    approvalSteps.forEach((step) => {
      const approval = planPolicyApproval(plan, result.runId, step);
      upsertApproval(approval);
      appendRuntimeEvent({
        command: 'approval.requested',
        entityType: 'run',
        entityId: result.runId,
        actorId: DEMO_AGENT_ID,
        title: `Plan policy approval requested: ${step.name}`,
        status: 'pending',
      });
    });
    setRunLifecycle(result.runId, 'WAITING_APPROVAL');
  }
  if (needsBudgetApproval) {
    const approval = budgetPolicyApproval(plan, result.runId, budgetEstimateCost);
    upsertApproval(approval);
    appendRuntimeEvent({
      command: 'approval.requested',
      entityType: 'run',
      entityId: result.runId,
      actorId: DEMO_AGENT_ID,
      title: `Budget approval requested: ${plan.workflowId}`,
      status: 'pending',
    });
    setRunLifecycle(result.runId, 'WAITING_APPROVAL');
  }
  appendRuntimeEvent({
    command: 'startRunFromPlan',
    entityType: 'run',
    entityId: result.runId,
    actorId: DEMO_AGENT_ID,
    title: approvalSteps.length || needsBudgetApproval ? `Run waiting on execution governance: ${plan.workflowId}` : `Run started from plan: ${plan.workflowId}`,
    status: approvalSteps.length || needsBudgetApproval ? 'pending' : 'success',
  });
  return result;
}

export async function nextStreamTick(runId: string): Promise<RuntimeStreamResult> {
  const run = baseRunById(runId);
  if (!run) throw new Error(`Cannot advance missing stream run ${runId}`);
  if (isStreamComplete(runId)) {
    const events = getStreamEvents(runId);
    const lastEvent = events[events.length - 1] ?? appendStreamLifecycleEvent(run, 'run.completed', 'Stream already completed');
    return streamResult(run, lastEvent, true);
  }

  const nextSequence = currentStreamSequence(runId) + 1;
  if (nextSequence <= 1) {
    const event = appendStreamLifecycleEvent(run, 'run.queued', 'Hermes live stream queued');
    return streamResult(updateStreamRun(run, { status: 'queued', currentStep: 'Live stream queued' }, 'QUEUED'), event);
  }

  if (nextSequence === 2) {
    const nextRun = updateStreamRun(run, {
      status: 'running',
      currentStep: 'Hermes live stream started',
      elapsedSeconds: Math.max(run.elapsedSeconds, 4),
      steps: upsertStep(run.steps, streamStep(run.id, 'Hermes live stream started', 'running', 1, 0.001)),
      logs: [runtimeLog(`stream-log-started-${run.id}`, 'Hermes streaming channel opened'), ...run.logs],
    }, 'RUNNING');
    const event = appendStreamLifecycleEvent(nextRun, 'run.started', 'Hermes live stream started');
    return streamResult(nextRun, event);
  }

  if (nextSequence === 3) {
    const { toolCall, toolCalls } = persistStreamTool(run, streamToolAt(0).id, 'running', { phase: 'started' });
    const nextRun = updateStreamRun(run, {
      status: 'running',
      currentStep: 'Searching knowledge base',
      elapsedSeconds: Math.max(run.elapsedSeconds, 18),
      steps: upsertStep(run.steps, streamStep(run.id, `${toolCall.toolName} running`, 'running', 3, 0.003)),
      toolCalls,
      logs: [runtimeLog(`stream-log-tool-start-${run.id}`, `${toolCall.toolName} tool started`), ...run.logs],
    }, 'RUNNING');
    const event = appendStreamLifecycleEvent(nextRun, 'tool.started', `${toolCall.toolName} started`, { toolCallId: toolCall.id, toolName: toolCall.toolName });
    return streamResult(nextRun, event);
  }

  if (nextSequence === 4) {
    const { toolCall, toolCalls } = persistStreamTool(run, streamToolAt(0).id, 'running', { phase: 'progress', progress: 65 });
    const nextRun = updateStreamRun(run, {
      status: 'running',
      currentStep: `${toolCall.toolName} 65% complete`,
      elapsedSeconds: Math.max(run.elapsedSeconds, 36),
      toolCalls,
      logs: [runtimeLog(`stream-log-progress-${run.id}`, `${toolCall.toolName} progress 65%`), ...run.logs],
    }, 'RUNNING');
    const event = appendStreamLifecycleEvent(nextRun, 'tool.progress', `${toolCall.toolName} progress 65%`, { progress: 65, toolCallId: toolCall.id, toolName: toolCall.toolName });
    return streamResult(nextRun, event);
  }

  if (nextSequence === 5) {
    const { toolCall, toolCalls } = persistStreamTool(run, streamToolAt(0).id, 'completed');
    const nextRun = updateStreamRun(run, {
      status: 'running',
      currentStep: `${toolCall.toolName} completed`,
      elapsedSeconds: Math.max(run.elapsedSeconds, 48),
      steps: upsertStep(run.steps, streamStep(run.id, `${toolCall.toolName} completed`, 'success', 8, 0.003)),
      toolCalls,
      logs: [runtimeLog(`stream-log-tool-complete-${run.id}`, `${toolCall.toolName} completed`), ...run.logs],
    }, 'RUNNING');
    const event = appendStreamLifecycleEvent(nextRun, 'tool.completed', `${toolCall.toolName} completed`, { toolCallId: toolCall.id, toolName: toolCall.toolName });
    return streamResult(nextRun, event);
  }

  if (nextSequence === 6) {
    const { toolCall, toolCalls } = persistStreamTool(run, streamToolAt(1).id, 'running', { phase: 'started' });
    const nextRun = updateStreamRun(run, {
      status: 'running',
      currentStep: 'Generating execution plan',
      elapsedSeconds: Math.max(run.elapsedSeconds, 56),
      steps: upsertStep(run.steps, streamStep(run.id, `${toolCall.toolName} running`, 'running', 4, 0.004)),
      toolCalls,
      logs: [runtimeLog(`stream-log-plan-start-${run.id}`, `${toolCall.toolName} tool started`), ...run.logs],
    }, 'RUNNING');
    const event = appendStreamLifecycleEvent(nextRun, 'tool.started', `${toolCall.toolName} started`, { toolCallId: toolCall.id, toolName: toolCall.toolName });
    return streamResult(nextRun, event);
  }

  if (nextSequence === 7) {
    const { toolCall, toolCalls } = persistStreamTool(run, streamToolAt(1).id, 'running', { phase: 'progress', progress: 70 });
    const nextRun = updateStreamRun(run, {
      status: 'running',
      currentStep: `${toolCall.toolName} 70% complete`,
      elapsedSeconds: Math.max(run.elapsedSeconds, 64),
      toolCalls,
      logs: [runtimeLog(`stream-log-plan-progress-${run.id}`, `${toolCall.toolName} progress 70%`), ...run.logs],
    }, 'RUNNING');
    const event = appendStreamLifecycleEvent(nextRun, 'tool.progress', `${toolCall.toolName} progress 70%`, { progress: 70, toolCallId: toolCall.id, toolName: toolCall.toolName });
    return streamResult(nextRun, event);
  }

  if (nextSequence === 8) {
    const { toolCall, toolCalls } = persistStreamTool(run, streamToolAt(1).id, 'completed');
    const nextRun = updateStreamRun(run, {
      status: 'running',
      currentStep: `${toolCall.toolName} completed`,
      elapsedSeconds: Math.max(run.elapsedSeconds, 72),
      steps: upsertStep(run.steps, streamStep(run.id, `${toolCall.toolName} completed`, 'success', 7, 0.004)),
      toolCalls,
      logs: [runtimeLog(`stream-log-plan-complete-${run.id}`, `${toolCall.toolName} completed`), ...run.logs],
    }, 'RUNNING');
    const event = appendStreamLifecycleEvent(nextRun, 'tool.completed', `${toolCall.toolName} completed`, { toolCallId: toolCall.id, toolName: toolCall.toolName });
    return streamResult(nextRun, event);
  }

  if (nextSequence === 9) {
    const { toolCall, toolCalls } = persistStreamTool(run, streamToolAt(2).id, 'running', { phase: 'started' });
    const nextRun = updateStreamRun(run, {
      status: 'running',
      currentStep: `${toolCall.toolName} running`,
      elapsedSeconds: Math.max(run.elapsedSeconds, 80),
      steps: upsertStep(run.steps, streamStep(run.id, `${toolCall.toolName} running`, 'running', 5, 0.006)),
      toolCalls,
      logs: [runtimeLog(`stream-log-artifact-tool-start-${run.id}`, `${toolCall.toolName} tool started`), ...run.logs],
    }, 'RUNNING');
    const event = appendStreamLifecycleEvent(nextRun, 'tool.started', `${toolCall.toolName} started`, { toolCallId: toolCall.id, toolName: toolCall.toolName });
    return streamResult(nextRun, event);
  }

  if (nextSequence === 10) {
    const { toolCall, toolCalls } = persistStreamTool(run, streamToolAt(2).id, 'running', { phase: 'progress', progress: 80 });
    const nextRun = updateStreamRun(run, {
      status: 'running',
      currentStep: `${toolCall.toolName} 80% complete`,
      elapsedSeconds: Math.max(run.elapsedSeconds, 88),
      toolCalls,
      logs: [runtimeLog(`stream-log-artifact-tool-progress-${run.id}`, `${toolCall.toolName} progress 80%`), ...run.logs],
    }, 'RUNNING');
    const event = appendStreamLifecycleEvent(nextRun, 'tool.progress', `${toolCall.toolName} progress 80%`, { progress: 80, toolCallId: toolCall.id, toolName: toolCall.toolName });
    return streamResult(nextRun, event);
  }

  if (nextSequence === 11) {
    const { toolCall, toolCalls } = persistStreamTool(run, streamToolAt(2).id, 'completed');
    const nextRun = updateStreamRun(run, {
      status: 'running',
      currentStep: `${toolCall.toolName} completed`,
      elapsedSeconds: Math.max(run.elapsedSeconds, 96),
      steps: upsertStep(run.steps, streamStep(run.id, `${toolCall.toolName} completed`, 'success', 7, 0.006)),
      toolCalls,
      logs: [runtimeLog(`stream-log-artifact-tool-complete-${run.id}`, `${toolCall.toolName} completed`), ...run.logs],
    }, 'RUNNING');
    const event = appendStreamLifecycleEvent(nextRun, 'tool.completed', `${toolCall.toolName} completed`, { toolCallId: toolCall.id, toolName: toolCall.toolName });
    return streamResult(nextRun, event);
  }

  if (nextSequence === 12) {
    const artifact = runtimeOutputArtifacts(run.id, runtimeNow(), streamArtifactToolId())[0];
    const artifacts = mergeArtifacts([artifact], run.artifacts);
    const nextRun = updateStreamRun(run, {
      status: 'running',
      currentStep: 'Paperclip artifact generated',
      elapsedSeconds: Math.max(run.elapsedSeconds, 108),
      artifacts,
      steps: upsertStep(run.steps, streamStep(run.id, 'Paperclip artifact generated', 'success', 2, 0.001)),
      logs: [runtimeLog(`stream-log-artifact-${run.id}`, `Artifact created: ${artifact.name}`), ...run.logs],
    }, 'RUNNING');
    const event = appendStreamLifecycleEvent(nextRun, 'artifact.created', `Artifact created: ${artifact.name}`, { artifactId: artifact.id, toolCallId: artifact.toolId });
    return streamResult(nextRun, event);
  }

  if (nextSequence === 13) {
    const approval = runtimeApproval(getApprovalById(DEMO_APPROVAL_ID), run.ticketId, run.id, run.agentId, streamArtifactToolId());
    upsertApproval(approval);
    const nextRun = updateStreamRun(run, {
      status: 'warning',
      currentStep: 'Waiting for human approval gate',
      elapsedSeconds: Math.max(run.elapsedSeconds, 118),
      steps: upsertStep(run.steps, streamStep(run.id, 'Human approval requested', 'warning', 1, 0)),
      logs: [runtimeLog(`stream-log-approval-${run.id}`, 'Human approval requested by Hermes stream', 'warn'), ...run.logs],
    }, 'WAITING_APPROVAL');
    const event = appendStreamLifecycleEvent(nextRun, 'approval.requested', `Approval requested: ${approval.title}`, { approvalId: approval.id, toolCallId: approval.toolId });
    return streamResult(nextRun, event);
  }

  const nextRun = updateStreamRun(run, {
    status: 'success',
    currentStep: 'Streaming run completed',
    finishedAt: runtimeNow(),
    elapsedSeconds: Math.max(run.elapsedSeconds, 132),
    steps: upsertStep(run.steps, streamStep(run.id, 'Streaming run completed', 'success', 1, 0.001)),
    logs: [runtimeLog(`stream-log-completed-${run.id}`, 'Hermes live stream completed'), ...run.logs],
  }, 'COMPLETED');
  const event = appendStreamLifecycleEvent(nextRun, 'run.completed', 'Hermes live stream completed');
  markStreamComplete(run.id);
  return streamResult(nextRun, event, true);
}

export async function completeStreamingRun(runId: string): Promise<RuntimeStreamResult> {
  let result = await nextStreamTick(runId);
  for (let guard = 0; guard < 20 && !result.complete; guard += 1) {
    result = await nextStreamTick(runId);
  }
  return result;
}

export async function failStreamingRun(runId: string): Promise<RuntimeStreamResult> {
  const run = baseRunById(runId);
  if (!run) throw new Error(`Cannot fail missing stream run ${runId}`);
  const nextRun = updateStreamRun(run, {
    status: 'failed',
    currentStep: 'Streaming run failed',
    finishedAt: runtimeNow(),
    logs: [runtimeLog(`stream-log-failed-${run.id}`, 'Hermes live stream failed', 'error'), ...run.logs],
  }, 'FAILED');
  const event = appendStreamLifecycleEvent(nextRun, 'run.failed', 'Hermes live stream failed');
  markStreamComplete(run.id);
  return streamResult(nextRun, event, true);
}

async function createPaperclipRuntimeArtifact(run: Run) {
  const artifact = await paperclip.createArtifact({
    runId: run.id,
    type: 'markdown',
    name: 'Paperclip_QA_Runtime_Packet.md',
    contentSummary: `Runtime evidence packet for ${run.currentStep}`,
    contentText: runtimeOutputArtifacts(run.id)[0]?.contentText,
    language: 'markdown',
    sizeBytes: 1842,
  });
  return mapPaperclipArtifactToArtifact(artifact);
}

async function persistSandboxExecution(execution: HermesExecution, baseRun: Run): Promise<Run> {
  const normalizedExecution = executionWithApprovalSignal(execution);
  const lifecycle = mapHermesStatusToLifecycle(normalizedExecution.status);
  const mappedRun = mapHermesExecutionToRun(normalizedExecution, baseRun);
  const paperclipArtifact = await createPaperclipRuntimeArtifact(mappedRun);
  const fallbackArtifacts = runtimeOutputArtifacts(mappedRun.id, runtimeNow());
  const nextRun = {
    ...mappedRun,
    artifacts: mergeArtifacts([paperclipArtifact, ...fallbackArtifacts], mappedRun.artifacts),
  };
  upsertRun(nextRun, lifecycle);
  nextRun.artifacts.forEach((artifact) => upsertArtifact(artifact));
  appendExecutionEvents(nextRun);

  if (lifecycle === 'WAITING_APPROVAL') {
    const approval = runtimeApproval(getApprovalById(DEMO_APPROVAL_ID), nextRun.ticketId, nextRun.id, nextRun.agentId);
    upsertApproval(approval);
    appendRuntimeEvent({
      command: 'approval.requested',
      entityType: 'run',
      entityId: nextRun.id,
      actorId: nextRun.agentId,
      title: `Approval requested: ${approval.title}`,
      status: 'pending',
    });
  }

  if (lifecycle === 'COMPLETED') appendLifecycleEvent('run.completed', nextRun, 'Hermes run completed');
  if (lifecycle === 'FAILED') appendLifecycleEvent('run.failed', nextRun, 'Hermes run failed', 'failed');
  if (lifecycle === 'REJECTED') appendLifecycleEvent('run.cancelled', nextRun, 'Hermes run cancelled', 'failed');
  return nextRun;
}

export function createRuntimeAdapters(mode: RuntimeMode = 'mock') {
  const config = resolveRuntimeConfig({ VITE_RUNTIME_MODE: mode });
  return {
    hermes: createHermesAdapter(config.hermes.mode, config.hermes),
    paperclip: createPaperclipAdapter(config.paperclip.mode, config.paperclip),
  };
}

export async function startSandboxRun(ticketId: string) {
  const ticket = demoTickets.find((item) => item.id === ticketId);
  const existingRun = baseRunForTicket(ticketId);
  if (!ticket || !existingRun) {
    throw new Error(`Cannot start sandbox run for missing ticket ${ticketId}`);
  }
  const task = mapTicketToHermesTask(ticket);
  const createdRun = { ...existingRun, status: 'queued' as const, currentStep: 'Hermes task created and queued' };
  upsertRun(createdRun, 'CREATED');
  appendLifecycleEvent('run.created', createdRun, `Created Hermes task ${task.id}`, 'success');
  setRunLifecycle(createdRun.id, 'QUEUED');
  appendLifecycleEvent('run.queued', createdRun, 'Hermes run queued', 'pending');
  const execution = await hermes.startTask(task);
  const startedRun = await persistSandboxExecution(execution, createdRun);
  appendLifecycleEvent('run.started', startedRun, 'Hermes run started');
  return executionToRuntimeResult({ ...execution, id: startedRun.id });
}

export async function pollSandboxRun(runId: string) {
  const existingRun = baseRunById(runId);
  if (!existingRun) throw new Error(`Cannot poll missing run ${runId}`);
  const execution = await hermes.getRun(runId);
  const nextRun = await persistSandboxExecution(execution, existingRun);
  return executionToRuntimeResult({ ...execution, id: nextRun.id });
}

export async function syncSandboxRun(runId: string) {
  return pollSandboxRun(runId);
}

export async function cancelSandboxRun(runId: string) {
  const existingRun = baseRunById(runId);
  if (!existingRun) throw new Error(`Cannot cancel missing run ${runId}`);
  const execution = await hermes.cancelRun(runId);
  const cancelledExecution: HermesExecution = { ...execution, id: runId, status: 'cancelled', currentStep: execution.currentStep || 'Cancelled by operator' };
  const nextRun = await persistSandboxExecution(cancelledExecution, existingRun);
  setRunLifecycle(nextRun.id, 'REJECTED');
  return executionToRuntimeResult(cancelledExecution);
}

export function startAgentRun(ticketId: string): RuntimeActionPlan {
  return {
    applyOptimistic: (data) => {
      const ticket = data.tickets.find((item) => item.id === ticketId);
      if (!ticket) return data;

      const task = mapTicketToHermesTask(ticket);
      const runId = ticket.runId ?? DEMO_RUN_ID;
      const existingRun = data.runs.find((item) => item.id === runId) ?? data.runs.find((item) => item.id === DEMO_RUN_ID);
      if (!existingRun) return data;

      const nextRun = createRuntimeRun({ ...existingRun, id: runId, ticketId: ticket.id, agentId: task.agentId }, task);
      const existingApproval = data.approvals.find((approval) => approval.id === ticket.approvalId || approval.runId === nextRun.id);
      const nextApproval = runtimeApproval(existingApproval, ticket.id, nextRun.id, task.agentId);
      persistRuntimeBundle(nextRun, nextApproval);
      appendRuntimeEvent({
        command: 'startAgentRun',
        entityType: 'run',
        entityId: nextRun.id,
        actorId: task.agentId,
        title: 'Hermes runtime persisted',
        status: 'success',
      });

      return {
        ...data,
        agents: data.agents.map((agent) => agent.id !== task.agentId ? agent : {
          ...agent,
          status: 'running',
          currentRunIds: agent.currentRunIds.includes(nextRun.id) ? agent.currentRunIds : [...agent.currentRunIds, nextRun.id],
          currentTicketIds: agent.currentTicketIds.includes(ticket.id) ? agent.currentTicketIds : [...agent.currentTicketIds, ticket.id],
        }),
        tickets: data.tickets.map((item) => item.id !== ticket.id ? item : {
          ...item,
          status: 'in_progress',
          runId: nextRun.id,
          approvalId: nextApproval.id,
          updatedAt: runtimeNow(),
        }),
        runs: upsertById(data.runs, nextRun),
        approvals: upsertById(data.approvals, nextApproval),
        activities: [
          activity(`activity-runtime-${ticket.id}`, 'Hermes runtime started', 'Hermes accepted a ticket and Paperclip generated an evidence packet.', ticket.id, nextRun.id),
          ...data.activities,
        ],
      };
    },
    async commit() {
      const task = fallbackTask(ticketId);
      await hermes.startTask(task);
      await paperclip.createArtifact({
        runId: ticketId === DEMO_TICKET_ID ? DEMO_RUN_ID : `run-${ticketId}-hermes`,
        type: 'report',
        name: 'Paperclip_QA_Runtime_Packet.md',
      });
    },
  };
}

export function applyRunCommand(runId: string, command: RuntimeRunCommand): RuntimeActionPlan {
  return {
    applyOptimistic: (data) => {
      let nextLifecycle: RuntimeLifecycle = 'RUNNING';
      const nextData = {
        ...data,
        runs: data.runs.map((run) => {
        if (run.id !== runId) return run;
        const status: RunStatus = command === 'pause' ? 'paused' : command === 'cancel' ? 'failed' : 'running';
        nextLifecycle = command === 'pause' ? 'WAITING_APPROVAL' : command === 'cancel' ? 'FAILED' : 'RUNNING';
        const currentStep = command === 'pause'
          ? 'Paused at Hermes checkpoint'
          : command === 'cancel'
            ? 'Cancelled by operator'
            : command === 'retry'
              ? 'Retrying Hermes execution'
              : 'Resumed Hermes execution';
        return {
          ...run,
          status,
          currentStep,
          logs: [runtimeLog(`runtime-log-${command}`, `Hermes ${command} command queued`, command === 'cancel' ? 'warn' : 'info'), ...run.logs],
        };
      }),
      };
      const nextRun = nextData.runs.find((run) => run.id === runId);
      if (nextRun) {
        upsertRun(nextRun, nextLifecycle);
        appendRuntimeEvent({
          command: command === 'pause' ? 'pauseRun' : command === 'resume' ? 'resumeRun' : command === 'retry' ? 'retryRun' : 'cancelAgentRun',
          entityType: 'run',
          entityId: runId,
          actorId: nextRun.agentId,
          title: `Runtime ${command} persisted`,
          status: 'success',
        });
      } else {
        setRunLifecycle(runId, nextLifecycle);
      }
      return nextData;
    },
    async commit() {
      await hermes.sendRunCommand(runId, command);
    },
  };
}

export function pauseAgentRun(runId: string) {
  return applyRunCommand(runId, 'pause');
}

export function resumeAgentRun(runId: string) {
  return applyRunCommand(runId, 'resume');
}

export function retryAgentRun(runId: string) {
  return applyRunCommand(runId, 'retry');
}

export function cancelAgentRun(runId: string) {
  return applyRunCommand(runId, 'cancel');
}

export function approveRunAction(approvalId: string): RuntimeActionPlan {
  return decisionAction(approvalId, 'approved');
}

export function rejectRunAction(approvalId: string): RuntimeActionPlan {
  return decisionAction(approvalId, 'rejected');
}

function decisionAction(approvalId: string, outcome: RuntimeDecisionOutcome): RuntimeActionPlan {
  return {
    applyOptimistic: (data) => data,
    async commit() {
      const command = outcome === 'approved' ? 'resume' : 'pause';
      await hermes.sendRunCommand(approvalId, command);
      const approval = getApprovalById(approvalId);
      if (!approval) return;
      const decidedAt = runtimeNow();
      upsertApproval({
        ...approval,
        status: outcome,
        decision: {
          decidedAt,
          decidedBy: approval.requestedBy,
          outcome,
          note: 'Runtime approval reconciled after mock Hermes mutation.',
        },
        auditTrail: [
          ...approval.auditTrail,
          {
            id: `audit-runtime-decision-${approval.id}-${decidedAt}`,
            actorId: approval.requestedBy,
            action: outcome === 'approved' ? 'approved runtime action' : 'rejected runtime action',
            createdAt: decidedAt,
          },
        ],
      });
      if (approval.runId) {
        setRunLifecycle(approval.runId, outcome === 'approved' ? 'APPROVED' : 'REJECTED');
      }
    },
  };
}

export function executionToRuntimeResult(execution: HermesExecution) {
  return {
    runId: execution.id,
    status: mapHermesStatusToRunStatus(execution.status),
    message: execution.currentStep,
  };
}
