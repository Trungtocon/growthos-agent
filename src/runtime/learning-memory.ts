import type { OutcomeVerificationStatus } from './improvement-outcome';
import type { RunEvaluationDimension } from './run-evaluation';

export type LearningSignalType =
  | 'improved_outcome'
  | 'regressed_outcome'
  | 'unchanged_outcome'
  | 'prompt_improvement'
  | 'tool_selection'
  | 'cost_optimization'
  | 'governance_policy'
  | 'approval_process'
  | 'replay_integrity'
  | 'workflow_design';

export type RecommendationType =
  | 'use_tool'
  | 'avoid_tool'
  | 'adjust_prompt'
  | 'require_approval'
  | 'reduce_cost'
  | 'change_workflow'
  | 'add_governance_rule'
  | 'improve_artifact_quality'
  | 'rerun_with_constraints';

export type RecommendationPriority = 'low' | 'medium' | 'high' | 'critical';
export type RecommendationStatus = 'proposed' | 'accepted' | 'rejected';

export interface RecommendationContext {
  runId?: string;
  agentId?: string;
  workflowId?: string;
  outcomeId?: string;
  dimensions: RunEvaluationDimension[];
}

export interface LearningSignal {
  id: string;
  outcomeId: string;
  runId: string;
  agentId?: string;
  workflowId?: string;
  type: LearningSignalType;
  sourceStatus: OutcomeVerificationStatus;
  strength: number;
  targetDimensions: RunEvaluationDimension[];
  evidenceIds: string[];
  createdAt: string;
}

export interface RecommendationEvidence {
  id: string;
  signalId: string;
  outcomeId: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface RecommendationImpact {
  confidence: number;
  priority: RecommendationPriority;
  expectedScoreDelta: number;
  expectedCostDelta: number;
  riskReduction: number;
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  context: RecommendationContext;
  status: RecommendationStatus;
  confidence: number;
  impact: RecommendationImpact;
  evidence: RecommendationEvidence[];
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface RecommendationRule {
  id: string;
  signalType: LearningSignalType;
  recommendationType: RecommendationType;
  description: string;
  priority: RecommendationPriority;
}

export interface LearningMemory {
  id: string;
  workspaceId: string;
  signals: LearningSignal[];
  recommendations: Recommendation[];
  updatedAt: string;
}

export interface LearningMemorySummary {
  workspaceId: string;
  signalCount: number;
  recommendationCount: number;
  proposed: number;
  accepted: number;
  rejected: number;
  averageConfidence: number;
  generatedAt: string;
}

export function learningSignalId(outcomeId: string): string {
  return `learning-signal-${outcomeId}`;
}

export function recommendationContextKey(type: RecommendationType, context: RecommendationContext): string {
  return [
    type,
    context.runId ?? 'run-any',
    context.agentId ?? 'agent-any',
    context.workflowId ?? 'workflow-any',
    context.dimensions.slice().sort().join('-') || 'overall',
  ].join('__');
}

export function recommendationId(type: RecommendationType, context: RecommendationContext): string {
  return `recommendation-${recommendationContextKey(type, context).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

export function priorityRank(priority: RecommendationPriority): number {
  if (priority === 'critical') return 4;
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

export function signalTypeFromOutcome(status: OutcomeVerificationStatus): LearningSignalType {
  if (status === 'improved') return 'improved_outcome';
  if (status === 'regressed') return 'regressed_outcome';
  return 'unchanged_outcome';
}
