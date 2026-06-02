import type { ImprovementLoopQueueItem } from './improvement-loop-queue';

export type WorkerStatus =
  | 'idle'
  | 'polling'
  | 'executing'
  | 'waiting_governance'
  | 'waiting_approval'
  | 'retrying'
  | 'paused'
  | 'stopped'
  | 'failed';

export type WorkerFailureReason =
  | 'none'
  | 'kill_switch_enabled'
  | 'governance_block'
  | 'approval_required'
  | 'concurrency_saturated'
  | 'schedule_window_closed'
  | 'queue_empty'
  | 'execution_failed'
  | 'retry_exhausted'
  | 'stale_worker';

export interface ImprovementLoopWorker {
  id: string;
  status: WorkerStatus;
  activeQueueItemId?: string;
  startedAt?: string;
  stoppedAt?: string;
  pausedAt?: string;
  lastHeartbeatAt?: string;
  blockedReason?: WorkerFailureReason;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerTick {
  id: string;
  workerId: string;
  sequence: number;
  status: WorkerStatus;
  queueItemId?: string;
  message: string;
  createdAt: string;
}

export interface WorkerExecutionResult {
  id: string;
  workerId: string;
  queueItemId?: string;
  loopId?: string;
  status: 'started' | 'completed' | 'failed' | 'retrying' | 'blocked' | 'waiting_approval' | 'skipped';
  reason?: WorkerFailureReason;
  message: string;
  startedAt: string;
  completedAt?: string;
}

export interface WorkerHeartbeat {
  id: string;
  workerId: string;
  status: WorkerStatus;
  activeQueueItemId?: string;
  recordedAt: string;
}

export interface WorkerExecutionSummary {
  totalTicks: number;
  totalResults: number;
  started: number;
  completed: number;
  failed: number;
  retrying: number;
  blocked: number;
  waitingApproval: number;
  generatedAt: string;
}

export interface StaleWorkerWarning {
  workerId: string;
  lastHeartbeatAt?: string;
  staleForMs: number;
  reason: WorkerFailureReason;
}

export function defaultWorkerId(): string {
  return 'improvement-loop-worker-default';
}

export function isTerminalWorkerStatus(status: WorkerStatus): boolean {
  return status === 'stopped' || status === 'failed';
}

export function queueItemWorkerMessage(item?: ImprovementLoopQueueItem): string {
  if (!item) return 'No eligible improvement loop queue item is available.';
  return `${item.priority} queue item ${item.id} is ${item.status}.`;
}
