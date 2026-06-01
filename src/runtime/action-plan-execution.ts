import type { FeedbackActionOwner, FeedbackActionTask } from './feedback-action-planner';

export type ActionTaskLifecycleStatus = 'pending' | 'ready' | 'in_progress' | 'blocked' | 'review' | 'completed' | 'cancelled';

export interface ActionCompletionEvidence {
  id: string;
  taskId: string;
  type: 'note' | 'artifact' | 'checklist' | 'metric' | 'link';
  title: string;
  description: string;
  artifactId?: string;
  createdAt: string;
  createdBy: string;
}

export interface ActionExecutionEvent {
  id: string;
  planId: string;
  taskId?: string;
  type: 'plan.started' | 'task.started' | 'task.paused' | 'task.blocked' | 'task.completed' | 'task.cancelled' | 'progress.updated';
  message: string;
  status: ActionTaskLifecycleStatus;
  timestamp: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface ActionTaskExecution {
  id: string;
  planId: string;
  taskId: string;
  title: string;
  owner: FeedbackActionOwner;
  priority: FeedbackActionTask['priority'];
  status: ActionTaskLifecycleStatus;
  progress: number;
  blocker?: string;
  pauseReason?: string;
  cancelReason?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  notes: string[];
  evidence: ActionCompletionEvidence[];
}

export interface ActionProgressSnapshot {
  planId: string;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  inProgressTasks: number;
  weightedProgress: number;
  progressPercent: number;
  readiness: 'not_started' | 'in_progress' | 'blocked' | 'review' | 'completed';
  generatedAt: string;
}

export interface ActionPlanExecution {
  id: string;
  planId: string;
  runId: string;
  status: ActionProgressSnapshot['readiness'];
  progress: ActionProgressSnapshot;
  tasks: ActionTaskExecution[];
  timeline: ActionExecutionEvent[];
  startedAt: string;
  updatedAt: string;
}

export interface WorkspaceImprovementProgress {
  workspaceId: string;
  executionCount: number;
  taskCount: number;
  completedTasks: number;
  blockedTasks: number;
  averageProgress: number;
  evidenceCount: number;
  generatedAt: string;
}

export function actionPlanExecutionId(planId: string): string {
  return `action-execution-${planId}`;
}

export function actionTaskExecutionId(taskId: string): string {
  return `action-task-execution-${taskId}`;
}
