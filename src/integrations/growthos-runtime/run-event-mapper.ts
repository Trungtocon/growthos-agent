import type { Approval, Artifact, Run, RunStatus, ToolCall, ToolCallStatus } from '../../domain/types';
import type { HermesArtifactLike, HermesExecution, HermesExecutionStatus, HermesExecutionStep, HermesToolCall } from '../hermes/hermes-types';
import type { PaperclipArtifact } from '../paperclip/paperclip-types';
import type { HumanApprovalGate } from './runtime-types';
import type { RuntimeLifecycle } from '../../runtime-store/runtime-persistence';

function mapToolStatus(status: HermesToolCall['status']): ToolCallStatus {
  return status;
}

export function mapHermesStatusToRunStatus(status: HermesExecutionStatus): RunStatus {
  if (status === 'created' || status === 'queued') return 'queued';
  if (status === 'waiting_for_approval') return 'paused';
  if (status === 'completed') return 'success';
  if (status === 'cancelled') return 'failed';
  return status;
}

export function mapHermesStatusToLifecycle(status: HermesExecutionStatus): RuntimeLifecycle {
  if (status === 'created') return 'CREATED';
  if (status === 'queued') return 'QUEUED';
  if (status === 'running') return 'RUNNING';
  if (status === 'waiting_for_approval' || status === 'paused' || status === 'warning') return 'WAITING_APPROVAL';
  if (status === 'completed' || status === 'success') return 'COMPLETED';
  if (status === 'cancelled') return 'REJECTED';
  if (status === 'failed') return 'FAILED';
  return 'CREATED';
}

function mapStepStatus(status: HermesExecutionStep['status']): RunStatus {
  return mapHermesStatusToRunStatus(status);
}

export function mapToolCallToHermesToolCall(toolCall: ToolCall): HermesToolCall {
  return {
    id: toolCall.id,
    toolName: toolCall.toolName,
    status: toolCall.status,
    inputSummary: toolCall.inputSummary,
    outputSummary: toolCall.outputSummary,
    durationMs: toolCall.durationMs,
    cost: toolCall.cost,
    startedAt: toolCall.startedAt,
    finishedAt: toolCall.finishedAt,
  };
}

export function mapRunToHermesExecution(run: Run): HermesExecution {
  return {
    id: `hermes-${run.id}`,
    taskId: `hermes-task-${run.ticketId}`,
    ticketId: run.ticketId,
    agentId: run.agentId,
    status: run.status,
    currentStep: run.currentStep,
    elapsedSeconds: run.elapsedSeconds,
    cost: run.cost,
    riskLevel: run.riskLevel,
    steps: run.steps.map((step) => ({
      id: step.id,
      name: step.name,
      status: step.status,
      durationSeconds: step.durationSeconds,
      cost: step.cost,
    })),
    toolCalls: run.toolCalls.map(mapToolCallToHermesToolCall),
    logs: run.logs,
    artifacts: run.artifacts.map((artifact) => ({
      id: artifact.id,
      runId: artifact.runId,
      type: artifact.type,
      name: artifact.name,
      url: artifact.url,
      contentSummary: artifact.contentSummary,
      createdAt: artifact.createdAt,
      source: artifact.source ?? 'mock',
    })),
  };
}

export function mapHermesExecutionToRun(execution: HermesExecution, existingRun: Run, now = new Date().toISOString()): Run {
  const runStatus = mapHermesStatusToRunStatus(execution.status);
  return {
    ...existingRun,
    status: runStatus,
    currentStep: execution.currentStep,
    startedAt: existingRun.startedAt,
    finishedAt: runStatus === 'success' || runStatus === 'failed' ? now : undefined,
    elapsedSeconds: execution.elapsedSeconds,
    steps: execution.steps.map((step) => ({
      id: step.id,
      name: step.name,
      status: mapStepStatus(step.status),
      startedAt: now,
      durationSeconds: step.durationSeconds,
      cost: step.cost,
    })),
    toolCalls: execution.toolCalls.map((tool) => ({
      id: tool.id,
      toolName: tool.toolName,
      status: mapToolStatus(tool.status),
      inputSummary: tool.inputSummary,
      outputSummary: tool.outputSummary,
      durationMs: tool.durationMs,
      cost: tool.cost,
      startedAt: tool.startedAt ?? now,
      finishedAt: tool.status === 'running' ? undefined : tool.finishedAt ?? now,
    })),
    logs: execution.logs.map((log) => ({ ...log, timestamp: now })),
    artifacts: [
      ...existingRun.artifacts,
      ...(execution.artifacts ?? []).map((artifact) => mapHermesArtifactToArtifact(artifact, execution.id, now)),
    ],
    cost: execution.cost,
  };
}

export function mapHermesArtifactToArtifact(artifact: HermesArtifactLike, runId: string, now = new Date().toISOString()): Artifact {
  return {
    id: artifact.id,
    runId: artifact.runId ?? runId,
    type: artifact.type ?? 'report',
    name: artifact.name,
    url: artifact.url,
    contentSummary: artifact.contentSummary,
    source: artifact.source ?? 'hermes',
    createdAt: artifact.createdAt ?? now,
  };
}

export function mapArtifactToPaperclipArtifact(artifact: Artifact): PaperclipArtifact {
  return {
    id: `paperclip-${artifact.id}`,
    runId: artifact.runId,
    type: artifact.type,
    name: artifact.name,
    url: artifact.url,
    createdAt: artifact.createdAt,
    source: 'paperclip',
  };
}

export function mapPaperclipArtifactToArtifact(artifact: PaperclipArtifact): Artifact {
  return {
    id: artifact.id,
    runId: artifact.runId,
    type: artifact.type,
    name: artifact.name,
    url: artifact.url,
    contentSummary: artifact.contentSummary,
    createdAt: artifact.createdAt,
    source: artifact.source,
  };
}

export function mapApprovalToHumanApprovalGate(approval: Approval): HumanApprovalGate {
  return {
    id: `human-gate-${approval.id}`,
    approvalId: approval.id,
    ticketId: approval.ticketId,
    runId: approval.runId,
    agentId: approval.agentId,
    title: approval.title,
    policy: approval.policy,
    severity: approval.severity,
    status: approval.status,
    requestedAt: approval.requestedAt,
  };
}
