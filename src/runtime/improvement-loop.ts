import type { RecommendationPriority } from './learning-memory';

export type ImprovementLoopStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'waiting_review'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ImprovementLoopTriggerType =
  | 'manual'
  | 'scheduled'
  | 'low_score'
  | 'failed_recommendation'
  | 'regression_detected'
  | 'budget_variance'
  | 'governance_warning'
  | 'learning_signal';

export type ImprovementLoopScheduleFrequency = 'manual' | 'hourly' | 'daily' | 'weekly';
export type ImprovementLoopOutcomeStatus = 'pending' | 'improved' | 'regressed' | 'failed' | 'cancelled';

export interface ImprovementLoopTrigger {
  id: string;
  type: ImprovementLoopTriggerType;
  sourceId?: string;
  description: string;
  createdAt: string;
}

export interface ImprovementLoopPolicy {
  id: string;
  name: string;
  threshold?: number;
  severity: 'info' | 'warning' | 'blocking';
  passed: boolean;
  requiresApproval: boolean;
  message: string;
}

export interface ImprovementLoopSchedule {
  id: string;
  loopId: string;
  frequency: ImprovementLoopScheduleFrequency;
  nextRunAt: string;
  timezone: string;
  status: 'active' | 'paused' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface ImprovementLoopRun {
  id: string;
  loopId: string;
  recommendationExecutionId?: string;
  status: ImprovementLoopStatus;
  attempt: number;
  startedAt?: string;
  completedAt?: string;
  evidence: string[];
  failureReason?: string;
  outcomeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImprovementLoopOutcome {
  id: string;
  loopId: string;
  runId: string;
  status: ImprovementLoopOutcomeStatus;
  improvementOutcomeId?: string;
  recommendationExecutionId?: string;
  confidenceBefore: number;
  confidenceAfter: number;
  scoreDelta: number;
  createdAt: string;
}

export interface ImprovementLoop {
  id: string;
  recommendationId: string;
  recommendationExecutionId?: string;
  runId: string;
  agentId?: string;
  workflowId?: string;
  status: ImprovementLoopStatus;
  priority: RecommendationPriority;
  confidenceAtCreation: number;
  trigger: ImprovementLoopTrigger;
  policies: ImprovementLoopPolicy[];
  scheduleId?: string;
  runIds: string[];
  outcomeIds: string[];
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
}

export interface ImprovementLoopReadiness {
  loopId: string;
  status: 'ready' | 'approval_required' | 'blocked';
  ready: boolean;
  blockers: string[];
  warnings: string[];
  policies: ImprovementLoopPolicy[];
}

export interface ImprovementLoopOutcomeSummary {
  total: number;
  improved: number;
  regressed: number;
  failed: number;
  pending: number;
  averageConfidenceDelta: number;
  generatedAt: string;
}

export interface ImprovementLoopScheduleSummary {
  total: number;
  active: number;
  paused: number;
  cancelled: number;
  nextRunAt?: string;
  generatedAt: string;
}

export interface WorkspaceImprovementLoopSummary {
  workspaceId: string;
  total: number;
  active: number;
  paused: number;
  waitingReview: number;
  completed: number;
  failed: number;
  cancelled: number;
  outcomes: ImprovementLoopOutcomeSummary;
  schedules: ImprovementLoopScheduleSummary;
  generatedAt: string;
}

export function improvementLoopId(recommendationId: string): string {
  return `improvement-loop-${recommendationId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

export function improvementLoopRunId(loopId: string, attempt: number): string {
  return `${loopId}-run-${attempt}`;
}
