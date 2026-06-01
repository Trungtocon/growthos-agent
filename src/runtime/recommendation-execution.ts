import type { RecommendationPriority, RecommendationType } from './learning-memory';

export type RecommendationExecutionStatus =
  | 'pending'
  | 'planned'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'verified';

export interface RecommendationExecutionStep {
  id: string;
  executionId: string;
  name: string;
  status: RecommendationExecutionStatus;
  order: number;
  required: boolean;
  completedAt?: string;
}

export interface RecommendationExecutionEvidence {
  id: string;
  executionId: string;
  type: 'note' | 'artifact' | 'metric' | 'governance' | 'cost' | 'outcome';
  title: string;
  description: string;
  createdAt: string;
  createdBy: string;
}

export interface RecommendationImpactResult {
  executionId: string;
  recommendationId: string;
  status: 'pending' | 'improved' | 'unchanged' | 'regressed' | 'inconclusive';
  outcomeId?: string;
  confidenceBefore: number;
  confidenceAfter: number;
  scoreDelta: number;
  verifiedAt?: string;
}

export interface RecommendationExecution {
  id: string;
  recommendationId: string;
  runId: string;
  agentId?: string;
  workflowId?: string;
  recommendationType: RecommendationType;
  priority: RecommendationPriority;
  status: RecommendationExecutionStatus;
  steps: RecommendationExecutionStep[];
  evidence: RecommendationExecutionEvidence[];
  impactResult?: RecommendationImpactResult;
  linkedActionPlanId?: string;
  blockedReason?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  verifiedAt?: string;
}

export interface RecommendationExecutionSummary {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  verified: number;
  failed: number;
  cancelled: number;
  blocked: number;
  averageConfidenceAfter: number;
  generatedAt: string;
}

export function recommendationExecutionId(recommendationId: string): string {
  return `recommendation-execution-${recommendationId}`;
}

export function isHighRiskRecommendation(priority: RecommendationPriority, type: RecommendationType): boolean {
  return priority === 'critical' || type === 'require_approval' || type === 'add_governance_rule';
}
