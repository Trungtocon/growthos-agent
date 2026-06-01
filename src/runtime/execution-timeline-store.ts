import { DEMO_AGENT_ID, DEMO_RUN_ID, DEMO_TICKET_ID, demoWorkspace } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import { getWorkflowData } from '../state/workflow-engine';
import { getApprovals } from '../runtime-store/approval-store';
import { getRunById, getRuns } from '../runtime-store/run-store';
import { getCurrentPlanForTicket } from '../runtime-store/run-plan-store';
import { getStreamEvents } from '../runtime-store/stream-store';
import { getToolCallsByRun } from '../runtime-store/tool-call-store';
import { getBillingLedger, getUsageByRun } from '../runtime-store/usage-ledger-store';
import { getGovernanceDecisionHistory } from './governance-decision-store';
import { getBlockedRuns, getEnforcementEvents, getTerminatedRuns } from './governance-enforcement-store';
import { registerArtifact, searchArtifacts } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import {
  executionTimelineEventId,
  executionTimelineId,
  type ExecutionReplayFrame,
  type ExecutionReplayState,
  type ExecutionReplaySummary,
  type ExecutionTimeline,
  type ExecutionTimelineEvent,
  type ExecutionTimelineEventType,
  type ExecutionTimelineSeverity,
  type ExecutionTimelineSource,
  type ExecutionTimelineSummary,
} from './execution-timeline';

const TIMELINE_STORAGE_KEY = 'uikigai-execution-timeline-v1';

interface TimelineState {
  timelines: Record<string, ExecutionTimeline>;
  framesByRun: Record<string, ExecutionReplayFrame[]>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): TimelineState {
  return { timelines: {}, framesByRun: {}, updatedAt: new Date().toISOString() };
}

function readState(): TimelineState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(TIMELINE_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<TimelineState>;
    return {
      timelines: parsed.timelines ?? {},
      framesByRun: parsed.framesByRun ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: TimelineState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(state));
}

function persistTimeline(timeline: ExecutionTimeline): ExecutionTimeline {
  const state = readState();
  writeState({
    timelines: { ...state.timelines, [timeline.id]: timeline },
    framesByRun: timeline.runId ? { ...state.framesByRun, [timeline.runId]: timeline.replayFrames } : state.framesByRun,
    updatedAt: new Date().toISOString(),
  });
  return clone(timeline);
}

function sortEvents(events: ExecutionTimelineEvent[]): ExecutionTimelineEvent[] {
  return [...new Map(events.map((event) => [event.id, event])).values()]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
}

function currentRun(runId: string) {
  const runtimeRun = getRunById(runId);
  if (runtimeRun) return runtimeRun;
  return getWorkflowData().runs.find((run) => run.id === runId);
}

function eventAt(base: string, offsetSeconds: number): string {
  const value = Date.parse(base);
  if (Number.isNaN(value)) return new Date().toISOString();
  return new Date(value + offsetSeconds * 1000).toISOString();
}

function severityFor(type: ExecutionTimelineEventType, status?: string): ExecutionTimelineSeverity {
  if (type === 'RUN_FAILED' || type === 'RUN_CANCELLED' || status?.toLowerCase().includes('deny')) return 'danger';
  if (type === 'APPROVAL_REQUESTED' || type === 'GOVERNANCE_DECISION') return 'warning';
  if (type === 'TOOL_COMPLETED' || type === 'ARTIFACT_CREATED' || type === 'RUN_COMPLETED' || type === 'APPROVAL_APPROVED') return 'success';
  return 'info';
}

function addEvent(
  events: Map<string, ExecutionTimelineEvent>,
  input: Omit<ExecutionTimelineEvent, 'id' | 'severity'> & {
    id?: string;
    entityId: string;
    severity?: ExecutionTimelineSeverity;
  },
) {
  const id = input.id ?? executionTimelineEventId(input.runId, input.type, input.entityId);
  events.set(id, {
    ...input,
    id,
    severity: input.severity ?? severityFor(input.type, input.metadata?.status as string | undefined),
  });
}

function sourceForArtifact(record: ArtifactRecord): ExecutionTimelineSource {
  const source = String(record.metadata.source ?? '').toLowerCase();
  if (source === 'paperclip') return 'paperclip';
  if (source === 'hermes') return 'hermes';
  return 'artifact';
}

function timelineSummary(workspaceId: string, timelines: ExecutionTimeline[]): ExecutionTimelineSummary {
  const events = timelines.flatMap((timeline) => timeline.events);
  return {
    workspaceId,
    timelineCount: timelines.length,
    eventCount: events.length,
    runCount: new Set(events.map((event) => event.runId)).size,
    artifactEvents: events.filter((event) => event.type === 'ARTIFACT_CREATED').length,
    approvalEvents: events.filter((event) => event.source === 'approval').length,
    governanceEvents: events.filter((event) => event.source === 'governance').length,
    warningEvents: events.filter((event) => event.severity === 'warning').length,
    dangerEvents: events.filter((event) => event.severity === 'danger').length,
    generatedAt: new Date().toISOString(),
  };
}

export function buildReplayFrames(runId = DEMO_RUN_ID): ExecutionReplayFrame[] {
  const timeline = getExecutionTimeline(executionTimelineId('run', runId)) ?? buildTimelineForRun(runId);
  const initial: ExecutionReplayState = {
    runId,
    runStatus: 'created',
    completedSteps: [],
    completedTools: [],
    producedArtifacts: [],
    accumulatedCost: 0,
    accumulatedUsage: 0,
    lastEventType: 'RUN_CREATED',
  };
  let state = initial;
  return timeline.events.map((event, index) => {
    const next: ExecutionReplayState = {
      ...state,
      completedSteps: [...state.completedSteps],
      completedTools: [...state.completedTools],
      producedArtifacts: [...state.producedArtifacts],
      lastEventType: event.type,
    };
    if (event.type === 'RUN_CREATED') next.runStatus = 'created';
    if (event.type === 'PLAN_CREATED') next.runStatus = 'planned';
    if (event.type === 'STEP_STARTED' && event.stepId) {
      next.currentStep = event.title;
      if (!next.completedSteps.includes(event.stepId)) next.completedSteps.push(event.stepId);
    }
    if (event.type === 'TOOL_STARTED') next.activeTool = event.title;
    if (event.type === 'TOOL_COMPLETED') {
      next.activeTool = undefined;
      if (event.toolCallId && !next.completedTools.includes(event.toolCallId)) next.completedTools.push(event.toolCallId);
    }
    if (event.type === 'ARTIFACT_CREATED' && event.artifactId && !next.producedArtifacts.includes(event.artifactId)) next.producedArtifacts.push(event.artifactId);
    if (event.type === 'APPROVAL_REQUESTED') next.approvalStatus = 'requested';
    if (event.type === 'APPROVAL_APPROVED') next.approvalStatus = 'approved';
    if (event.type === 'APPROVAL_REJECTED') next.approvalStatus = 'rejected';
    if (event.type === 'GOVERNANCE_DECISION') next.governanceDecision = event.title;
    if (event.type === 'USAGE_RECORDED') {
      next.accumulatedUsage = Number((next.accumulatedUsage + Number(event.metadata?.quantity ?? 0)).toFixed(4));
      next.accumulatedCost = Number((next.accumulatedCost + Number(event.metadata?.actualCost ?? 0)).toFixed(4));
    }
    if (event.type === 'COST_RECORDED') next.accumulatedCost = Number(event.metadata?.actualCost ?? next.accumulatedCost);
    if (event.type === 'RUN_COMPLETED') next.runStatus = 'completed';
    if (event.type === 'RUN_FAILED') next.runStatus = 'failed';
    if (event.type === 'RUN_CANCELLED') next.runStatus = 'cancelled';
    state = next;
    return {
      id: `replay-${runId}-${index + 1}`,
      runId,
      frameIndex: index + 1,
      eventId: event.id,
      timestamp: event.timestamp,
      title: event.title,
      state: clone(next),
    };
  });
}

function replaySummary(runId: string, frames: ExecutionReplayFrame[]): ExecutionReplaySummary {
  const finalState = frames[frames.length - 1]?.state;
  return {
    runId,
    frameCount: frames.length,
    finalStatus: finalState?.runStatus ?? 'unknown',
    artifactCount: finalState?.producedArtifacts.length ?? 0,
    approvalCount: finalState?.approvalStatus ? 1 : 0,
    totalCost: Number((finalState?.accumulatedCost ?? 0).toFixed(4)),
    totalUsage: Number((finalState?.accumulatedUsage ?? 0).toFixed(4)),
    generatedAt: new Date().toISOString(),
  };
}

export function buildTimelineForRun(runId = DEMO_RUN_ID): ExecutionTimeline {
  const data = getWorkflowData();
  const run = currentRun(runId);
  if (!run) throw new Error(`Cannot build execution timeline for missing run: ${runId}`);
  const workspaceId = data.workspace.id ?? demoWorkspace.id;
  const ticket = data.tickets.find((item) => item.id === run.ticketId);
  const agent = data.agents.find((item) => item.id === run.agentId);
  const plan = ticket ? getCurrentPlanForTicket(ticket.id) : undefined;
  const toolCalls = getToolCallsByRun(run.id);
  const artifacts = searchArtifacts({ runId: run.id });
  const approvals = getApprovals().filter((approval) => approval.runId === run.id || approval.ticketId === run.ticketId);
  const usage = getUsageByRun(run.id);
  const ledger = getBillingLedger(run.id);
  const governance = getGovernanceDecisionHistory().filter((report) => [run.id, plan?.id, run.ticketId].includes(report.targetId));
  const blocks = [...getBlockedRuns(), ...getTerminatedRuns()].filter((block) => [run.id, plan?.id].includes(block.targetId));
  const enforcement = getEnforcementEvents().filter((event) => [run.id, plan?.id].includes(event.targetId));
  const streamEvents = getStreamEvents(run.id);
  const baseTime = run.startedAt ?? new Date().toISOString();
  const events = new Map<string, ExecutionTimelineEvent>();

  addEvent(events, {
    type: 'RUN_CREATED',
    runId: run.id,
    agentId: run.agentId,
    ticketId: run.ticketId,
    entityId: run.id,
    timestamp: run.startedAt,
    title: `Run created: ${run.id}`,
    description: `${agent?.name ?? run.agentId} started work on ${ticket?.title ?? run.ticketId}.`,
    source: 'runtime',
    metadata: { status: run.status },
  });

  if (plan) {
    addEvent(events, {
      type: 'PLAN_CREATED',
      runId: run.id,
      agentId: run.agentId,
      ticketId: run.ticketId,
      planId: plan.id,
      entityId: plan.id,
      timestamp: plan.createdAt,
      title: `Plan created: ${plan.workflowId}`,
      description: `${plan.steps.length} execution steps planned with ${plan.availableCapabilities.length} available capabilities.`,
      source: 'runtime',
      metadata: { status: plan.status, estimatedCost: plan.estimatedCost },
    });
    plan.steps.forEach((step, index) => addEvent(events, {
      type: 'STEP_STARTED',
      runId: run.id,
      agentId: run.agentId,
      ticketId: run.ticketId,
      planId: plan.id,
      stepId: step.id,
      entityId: step.id,
      timestamp: eventAt(plan.createdAt, 10 + index * 20),
      title: step.name,
      description: `Capability ${step.capabilityId} mapped to ${step.toolId ?? 'manual runtime step'}.`,
      source: 'runtime',
      metadata: { status: step.status, expectedOutputType: step.expectedOutputType },
    }));
  }

  toolCalls.forEach((tool, index) => {
    addEvent(events, {
      type: 'TOOL_STARTED',
      runId: run.id,
      agentId: run.agentId,
      ticketId: run.ticketId,
      planId: plan?.id,
      stepId: String(tool.metadata?.stepId ?? ''),
      toolCallId: tool.id,
      entityId: `${tool.id}-started`,
      timestamp: tool.startedAt ?? eventAt(baseTime, 30 + index * 30),
      title: tool.toolName,
      description: tool.input,
      source: 'hermes',
      metadata: { status: tool.status },
    });
    if (tool.status === 'completed' || tool.finishedAt) addEvent(events, {
      type: 'TOOL_COMPLETED',
      runId: run.id,
      agentId: run.agentId,
      ticketId: run.ticketId,
      planId: plan?.id,
      stepId: String(tool.metadata?.stepId ?? ''),
      toolCallId: tool.id,
      entityId: `${tool.id}-completed`,
      timestamp: tool.finishedAt ?? eventAt(baseTime, 45 + index * 30),
      title: tool.toolName,
      description: tool.output ?? 'Tool completed.',
      source: 'hermes',
      metadata: { status: tool.status, durationMs: tool.durationMs },
    });
  });

  artifacts.forEach((artifact, index) => addEvent(events, {
    type: 'ARTIFACT_CREATED',
    runId: run.id,
    agentId: run.agentId,
    ticketId: run.ticketId,
    planId: String(artifact.metadata.planId ?? plan?.id ?? ''),
    stepId: String(artifact.metadata.stepId ?? ''),
    toolCallId: String(artifact.metadata.toolId ?? ''),
    artifactId: artifact.id,
    entityId: artifact.id,
    timestamp: artifact.createdAt ?? eventAt(baseTime, 120 + index * 8),
    title: artifact.name,
    description: artifact.metadata.contentSummary ?? artifact.name,
    source: sourceForArtifact(artifact),
    metadata: { type: artifact.type, lifecycle: artifact.lifecycle },
  }));

  approvals.forEach((approval) => addEvent(events, {
    type: approval.status === 'approved' ? 'APPROVAL_APPROVED' : approval.status === 'rejected' ? 'APPROVAL_REJECTED' : 'APPROVAL_REQUESTED',
    runId: run.id,
    agentId: run.agentId,
    ticketId: run.ticketId,
    planId: String((approval as { planId?: string }).planId ?? plan?.id ?? ''),
    stepId: String((approval as { stepId?: string }).stepId ?? ''),
    toolCallId: approval.toolId,
    approvalId: approval.id,
    entityId: approval.id,
    timestamp: approval.decision?.decidedAt ?? approval.requestedAt,
    title: approval.title,
    description: approval.description,
    source: 'approval',
    metadata: { status: approval.status, policy: approval.policy },
  }));

  governance.forEach((report) => addEvent(events, {
    type: 'GOVERNANCE_DECISION',
    runId: run.id,
    agentId: run.agentId,
    ticketId: run.ticketId,
    planId: plan?.id,
    entityId: report.id,
    timestamp: report.evaluatedAt,
    title: report.finalDecision,
    description: `${report.action} on ${report.targetType} ${report.targetId}.`,
    source: 'governance',
    metadata: { status: report.finalDecision, targetId: report.targetId },
  }));

  [...blocks, ...enforcement].forEach((block, index) => addEvent(events, {
    type: 'GOVERNANCE_DECISION',
    runId: run.id,
    agentId: run.agentId,
    ticketId: run.ticketId,
    planId: plan?.id,
    entityId: block.id,
    timestamp: block.createdAt ?? eventAt(baseTime, 150 + index),
    title: 'BLOCKED_BY_GOVERNANCE',
    description: 'reasons' in block ? block.reasons.join('; ') : block.decisionReasons.join('; '),
    source: 'governance',
    severity: 'danger',
    metadata: { status: 'blocked' },
  }));

  usage.forEach((record) => addEvent(events, {
    type: 'USAGE_RECORDED',
    runId: run.id,
    agentId: run.agentId,
    ticketId: run.ticketId,
    toolCallId: record.toolId,
    artifactId: record.artifactId,
    entityId: record.id,
    timestamp: record.createdAt,
    title: `${record.type}: ${record.quantity} ${record.unit}`,
    description: `Actual cost $${record.actualCost.toFixed(4)}.`,
    source: 'usage',
    metadata: { quantity: record.quantity, actualCost: record.actualCost, estimatedCost: record.estimatedCost },
  }));

  if (ledger.records.length || ledger.actualTotal > 0) addEvent(events, {
    type: 'COST_RECORDED',
    runId: run.id,
    agentId: run.agentId,
    ticketId: run.ticketId,
    entityId: `${run.id}-ledger`,
    timestamp: eventAt(baseTime, 260),
    title: `Cost $${ledger.actualTotal.toFixed(4)}`,
    description: `Estimated $${ledger.estimatedTotal.toFixed(4)}, variance $${ledger.variance.toFixed(4)}.`,
    source: 'usage',
    metadata: { actualCost: ledger.actualTotal, estimatedTotal: ledger.estimatedTotal, variance: ledger.variance },
  });

  streamEvents.forEach((stream) => {
    const map: Partial<Record<string, ExecutionTimelineEventType>> = {
      'run.completed': 'RUN_COMPLETED',
      'run.failed': 'RUN_FAILED',
    };
    const type = map[stream.type];
    if (!type) return;
    addEvent(events, {
      type,
      runId: run.id,
      agentId: run.agentId,
      ticketId: run.ticketId,
      entityId: stream.id,
      timestamp: stream.timestamp,
      title: stream.message,
      description: stream.type,
      source: 'runtime',
      metadata: stream.payload,
    });
  });

  const lifecycle = (run as { lifecycle?: string }).lifecycle;
  if (run.status === 'success' || lifecycle === 'COMPLETED') addEvent(events, {
    type: 'RUN_COMPLETED',
    runId: run.id,
    agentId: run.agentId,
    ticketId: run.ticketId,
    entityId: `${run.id}-completed`,
    timestamp: run.finishedAt ?? eventAt(baseTime, 320),
    title: 'Run completed',
    description: `${run.currentStep} reached terminal completed state.`,
    source: 'runtime',
  });
  if (run.status === 'failed' || lifecycle === 'FAILED') addEvent(events, {
    type: 'RUN_FAILED',
    runId: run.id,
    agentId: run.agentId,
    ticketId: run.ticketId,
    entityId: `${run.id}-failed`,
    timestamp: run.finishedAt ?? eventAt(baseTime, 320),
    title: 'Run failed',
    description: run.currentStep,
    source: 'runtime',
  });
  if (lifecycle === 'REJECTED') addEvent(events, {
    type: 'RUN_CANCELLED',
    runId: run.id,
    agentId: run.agentId,
    ticketId: run.ticketId,
    entityId: `${run.id}-cancelled`,
    timestamp: run.finishedAt ?? eventAt(baseTime, 320),
    title: 'Run cancelled',
    description: run.currentStep,
    source: 'runtime',
  });

  const sortedEvents = sortEvents([...events.values()]);
  const timeline: ExecutionTimeline = {
    id: executionTimelineId('run', run.id),
    workspaceId,
    runId: run.id,
    agentId: run.agentId,
    ticketId: run.ticketId,
    events: sortedEvents,
    replayFrames: [],
    summary: { runId: run.id, frameCount: 0, finalStatus: 'unknown', artifactCount: 0, approvalCount: 0, totalCost: 0, totalUsage: 0, generatedAt: new Date().toISOString() },
    generatedAt: new Date().toISOString(),
  };
  const persisted = persistTimeline(timeline);
  const frames = buildReplayFrames(run.id);
  return persistTimeline({ ...persisted, replayFrames: frames, summary: replaySummary(run.id, frames) });
}

export function buildTimelineForAgent(agentId = DEMO_AGENT_ID): ExecutionTimeline {
  const data = getWorkflowData();
  const runs = [...data.runs, ...getRuns()].filter((run) => run.agentId === agentId);
  const timelines = runs.map((run) => buildTimelineForRun(run.id));
  const events = sortEvents(timelines.flatMap((timeline) => timeline.events));
  return persistTimeline({
    id: executionTimelineId('agent', agentId),
    workspaceId: data.workspace.id,
    agentId,
    events,
    replayFrames: [],
    summary: replaySummary(DEMO_RUN_ID, buildReplayFrames(DEMO_RUN_ID)),
    generatedAt: new Date().toISOString(),
  });
}

export function buildTimelineForTicket(ticketId = DEMO_TICKET_ID): ExecutionTimeline {
  const data = getWorkflowData();
  const runs = [...data.runs, ...getRuns()].filter((run) => run.ticketId === ticketId);
  const timelines = runs.map((run) => buildTimelineForRun(run.id));
  const events = sortEvents(timelines.flatMap((timeline) => timeline.events));
  return persistTimeline({
    id: executionTimelineId('ticket', ticketId),
    workspaceId: data.workspace.id,
    ticketId,
    events,
    replayFrames: [],
    summary: replaySummary(DEMO_RUN_ID, buildReplayFrames(DEMO_RUN_ID)),
    generatedAt: new Date().toISOString(),
  });
}

export function getExecutionTimeline(timelineId: string): ExecutionTimeline | undefined {
  const timeline = readState().timelines[timelineId];
  return timeline ? clone(timeline) : undefined;
}

export function getReplayState(runId = DEMO_RUN_ID, frameIndex = -1): ExecutionReplayState | undefined {
  const frames = getReplayFrames(runId);
  const index = frameIndex < 0 ? frames.length - 1 : frameIndex;
  return frames[index]?.state ? clone(frames[index].state) : undefined;
}

export function getReplayFrames(runId = DEMO_RUN_ID): ExecutionReplayFrame[] {
  const frames = readState().framesByRun[runId];
  return frames?.length ? clone(frames) : buildReplayFrames(runId);
}

export function getTimelineSummary(workspaceId = demoWorkspace.id): ExecutionTimelineSummary {
  const timelines = Object.values(readState().timelines).filter((timeline) => timeline.workspaceId === workspaceId);
  return timelineSummary(workspaceId, timelines);
}

export function getTimelineEventsBySeverity(severity: ExecutionTimelineSeverity, runId = DEMO_RUN_ID): ExecutionTimelineEvent[] {
  return buildTimelineForRun(runId).events.filter((event) => event.severity === severity);
}

export function getTimelineEventsBySource(source: ExecutionTimelineSource, runId = DEMO_RUN_ID): ExecutionTimelineEvent[] {
  return buildTimelineForRun(runId).events.filter((event) => event.source === source);
}

export function exportExecutionTimelineJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify(buildTimelineForRun(runId), null, 2);
}

export function exportExecutionTimelineMarkdown(runId = DEMO_RUN_ID): string {
  const rows = buildTimelineForRun(runId).events.map((event) => `| ${event.timestamp} | ${event.type} | ${event.title} | ${event.severity} | ${event.source} |`);
  return ['# Execution Timeline', '', `Run: ${runId}`, '', '| Time | Type | Title | Severity | Source |', '|---|---|---|---|---|', ...rows, ''].join('\n');
}

export function exportExecutionReplayJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify(getReplayFrames(runId), null, 2);
}

export function exportExecutionReplaySummaryMarkdown(runId = DEMO_RUN_ID): string {
  const summary = replaySummary(runId, getReplayFrames(runId));
  return ['# Execution Replay Summary', '', `Run: ${runId}`, '', '| Metric | Value |', '|---|---:|', `| Frames | ${summary.frameCount} |`, `| Final status | ${summary.finalStatus} |`, `| Artifacts | ${summary.artifactCount} |`, `| Approvals | ${summary.approvalCount} |`, `| Total cost | $${summary.totalCost.toFixed(4)} |`, ''].join('\n');
}

function exportArtifact(id: string, runId: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return {
    id,
    runId,
    type,
    name,
    source: 'mock',
    contentSummary: `Execution timeline export for ${runId}`,
    contentText,
    createdAt: new Date().toISOString(),
  };
}

export function registerExecutionTimelineExports(runId = DEMO_RUN_ID): ArtifactRecord[] {
  buildTimelineForRun(runId);
  const exports = [
    exportArtifact(`artifact-${runId}-execution-timeline-json`, runId, 'execution-timeline.json', exportExecutionTimelineJson(runId), 'json'),
    exportArtifact(`artifact-${runId}-execution-timeline-md`, runId, 'execution-timeline.md', exportExecutionTimelineMarkdown(runId), 'markdown'),
    exportArtifact(`artifact-${runId}-execution-replay-json`, runId, 'execution-replay.json', exportExecutionReplayJson(runId), 'json'),
    exportArtifact(`artifact-${runId}-execution-replay-summary-md`, runId, 'execution-replay-summary.md', exportExecutionReplaySummaryMarkdown(runId), 'markdown'),
  ];
  return exports.map((artifact) => registerArtifact(artifact, { type: 'EXPORT', metadata: { runId, tags: ['execution-timeline', 'replay', 'export'] } }));
}

export function clearExecutionTimelineStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(TIMELINE_STORAGE_KEY);
}
