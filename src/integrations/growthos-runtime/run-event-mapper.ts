import type { Approval, Artifact, Run, RunStatus, ToolCall, ToolCallStatus } from '../../domain/types';
import type { HermesExecution, HermesExecutionStep, HermesToolCall } from '../hermes/hermes-types';
import type { PaperclipArtifact } from '../paperclip/paperclip-types';
import type { HumanApprovalGate } from './runtime-types';

function mapToolStatus(status: HermesToolCall['status']): ToolCallStatus {
  return status;
}

function mapStepStatus(status: HermesExecutionStep['status']): RunStatus {
  return status;
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
  };
}

export function mapHermesExecutionToRun(execution: HermesExecution, existingRun: Run, now = new Date().toISOString()): Run {
  return {
    ...existingRun,
    status: execution.status,
    currentStep: execution.currentStep,
    startedAt: existingRun.startedAt,
    finishedAt: execution.status === 'success' || execution.status === 'failed' ? now : undefined,
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
    })),
    logs: execution.logs.map((log) => ({ ...log, timestamp: now })),
    cost: execution.cost,
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
    createdAt: artifact.createdAt,
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
