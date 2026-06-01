import type { FeedbackCategory, FeedbackPriority } from './evaluation-feedback';

export type FeedbackActionStatus = 'draft' | 'ready' | 'blocked' | 'in_progress' | 'completed' | 'cancelled';
export type FeedbackActionOwner = 'agent_ops' | 'governance' | 'runtime' | 'cost_ops';

export interface FeedbackActionAcceptanceCriteria {
  id: string;
  taskId: string;
  description: string;
  required: boolean;
  completed: boolean;
}

export interface FeedbackActionTask {
  id: string;
  planId: string;
  suggestionId: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  priority: FeedbackPriority;
  owner: FeedbackActionOwner;
  status: FeedbackActionStatus;
  expectedImpact: number;
  acceptanceCriteria: FeedbackActionAcceptanceCriteria[];
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackActionDependency {
  id: string;
  planId: string;
  taskId: string;
  dependsOnTaskId: string;
  reason: string;
  blocking: boolean;
}

export interface FeedbackActionPlan {
  id: string;
  feedbackId: string;
  runId: string;
  status: FeedbackActionStatus;
  readiness: 'ready' | 'blocked' | 'draft';
  version: number;
  tasks: FeedbackActionTask[];
  dependencies: FeedbackActionDependency[];
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackActionPlanSummary {
  workspaceId: string;
  planCount: number;
  taskCount: number;
  readyTasks: number;
  blockedTasks: number;
  completedTasks: number;
  totalExpectedImpact: number;
  generatedAt: string;
}

export function feedbackActionPlanId(feedbackId: string): string {
  return `feedback-action-plan-${feedbackId}`;
}

export function actionStatusRank(status: FeedbackActionStatus): number {
  if (status === 'ready') return 5;
  if (status === 'in_progress') return 4;
  if (status === 'blocked') return 3;
  if (status === 'draft') return 2;
  if (status === 'completed') return 1;
  return 0;
}
