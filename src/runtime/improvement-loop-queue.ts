export type ImprovementLoopQueueStatus =
  | 'queued'
  | 'scheduled'
  | 'waiting_governance'
  | 'waiting_approval'
  | 'running'
  | 'retrying'
  | 'paused'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'killed';

export type ImprovementLoopQueuePriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';

export interface ImprovementLoopRetryPolicy {
  maxRetries: number;
  retryCount: number;
  backoffMs: number;
  nextRetryAt?: string;
}

export interface ImprovementLoopScheduleWindow {
  id: string;
  startAt: string;
  endAt: string;
  timezone: string;
  enabled: boolean;
}

export interface ImprovementLoopQueueItem {
  id: string;
  loopId: string;
  recommendationId: string;
  priority: ImprovementLoopQueuePriority;
  status: ImprovementLoopQueueStatus;
  scheduledFor?: string;
  scheduleWindow?: ImprovementLoopScheduleWindow;
  retryPolicy: ImprovementLoopRetryPolicy;
  enqueuedAt: string;
  startedAt?: string;
  completedAt?: string;
  lastRunId?: string;
  lastDecision?: string;
  blocker?: string;
  order: number;
  updatedAt: string;
}

export interface ImprovementLoopQueueAuditEvent {
  id: string;
  itemId?: string;
  loopId?: string;
  action: string;
  status: ImprovementLoopQueueStatus;
  message: string;
  createdAt: string;
}

export interface ImprovementLoopQueueHealthSummary {
  total: number;
  queued: number;
  scheduled: number;
  waitingGovernance: number;
  waitingApproval: number;
  running: number;
  blocked: number;
  completed: number;
  failed: number;
  cancelled: number;
  killed: number;
  generatedAt: string;
}

export interface ImprovementLoopQueueConcurrencyStatus {
  maxConcurrency: number;
  activeCount: number;
  availableSlots: number;
  saturated: boolean;
}

export function queuePriorityRank(priority: ImprovementLoopQueuePriority): number {
  if (priority === 'critical') return 5;
  if (priority === 'urgent') return 4;
  if (priority === 'high') return 3;
  if (priority === 'normal') return 2;
  return 1;
}

export function queueItemId(loopId: string): string {
  return `improvement-loop-queue-${loopId}`;
}
