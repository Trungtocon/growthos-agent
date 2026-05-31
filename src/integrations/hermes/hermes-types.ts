import type { ArtifactType, RiskLevel, RunStatus, ToolCallStatus } from '../../domain/types';
import type { RuntimeServiceHealth } from '../growthos-runtime/runtime-types';

export type HermesTaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type HermesExecutionStatus =
  | RunStatus
  | 'created'
  | 'queued'
  | 'waiting_for_approval'
  | 'completed'
  | 'cancelled';

export interface HermesTask {
  id: string;
  ticketId: string;
  title: string;
  prompt: string;
  agentId: string;
  priority: HermesTaskPriority;
  riskLevel: RiskLevel;
  acceptanceCriteria: string[];
  tags: string[];
}

export interface HermesToolCall {
  id: string;
  toolName: string;
  status: ToolCallStatus;
  inputSummary: string;
  outputSummary: string;
  durationMs: number;
  cost: number;
  startedAt?: string;
  finishedAt?: string;
}

export interface HermesArtifactLike {
  id: string;
  runId?: string;
  type?: ArtifactType;
  name: string;
  url?: string;
  contentSummary?: string;
  createdAt?: string;
  source?: 'hermes' | 'paperclip' | 'mock';
}

export interface HermesExecutionStep {
  id: string;
  name: string;
  status: RunStatus;
  durationSeconds: number;
  cost: number;
}

export interface HermesExecutionLog {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface HermesExecution {
  id: string;
  taskId: string;
  ticketId: string;
  agentId: string;
  status: HermesExecutionStatus;
  currentStep: string;
  elapsedSeconds: number;
  cost: number;
  riskLevel: RiskLevel;
  steps: HermesExecutionStep[];
  toolCalls: HermesToolCall[];
  logs: HermesExecutionLog[];
  artifacts?: HermesArtifactLike[];
}

export interface HermesClient {
  healthCheck(): Promise<RuntimeServiceHealth>;
  createTask(task: HermesTask): Promise<HermesTask>;
  startRun(taskId: string): Promise<HermesExecution>;
  getRun(runId: string): Promise<HermesExecution>;
  cancelRun(runId: string): Promise<HermesExecution>;
  startTask(task: HermesTask): Promise<HermesExecution>;
  sendRunCommand(runId: string, command: 'pause' | 'resume' | 'retry' | 'cancel'): Promise<HermesExecution>;
}
