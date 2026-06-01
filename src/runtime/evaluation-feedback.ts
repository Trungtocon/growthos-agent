import type { RunEvaluationIssue, RunEvaluationRecommendation } from './run-evaluation';

export type FeedbackCategory =
  | 'prompt_improvement'
  | 'tool_selection'
  | 'artifact_quality'
  | 'approval_process'
  | 'governance_policy'
  | 'cost_optimization'
  | 'replay_integrity'
  | 'workflow_design';

export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ImprovementSuggestion {
  id: string;
  category: FeedbackCategory;
  priority: FeedbackPriority;
  title: string;
  description: string;
  expectedImpact: number;
  sourceIssueId?: string;
  sourceRecommendationId?: string;
}

export interface FeedbackAction {
  id: string;
  suggestionId: string;
  title: string;
  owner: 'agent_ops' | 'governance' | 'runtime' | 'cost_ops';
  status: 'open' | 'queued' | 'done';
  dueInDays: number;
}

export interface FeedbackLearning {
  id: string;
  category: FeedbackCategory;
  summary: string;
  evidence: string;
  createdAt: string;
}

export interface EvaluationFeedback {
  id: string;
  runId: string;
  evaluationId: string;
  version: number;
  suggestions: ImprovementSuggestion[];
  actions: FeedbackAction[];
  learnings: FeedbackLearning[];
  generatedAt: string;
  updatedAt: string;
}

export interface WorkspaceFeedbackSummary {
  workspaceId: string;
  feedbackCount: number;
  suggestionCount: number;
  actionCount: number;
  criticalCount: number;
  highCount: number;
  topCategories: Array<{ category: FeedbackCategory; count: number }>;
  generatedAt: string;
}

export function evaluationFeedbackId(runId: string): string {
  return `evaluation-feedback-${runId}`;
}

export function feedbackPriorityWeight(priority: FeedbackPriority): number {
  if (priority === 'critical') return 4;
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

export function priorityFromScore(score: number): FeedbackPriority {
  if (score < 50) return 'critical';
  if (score < 65) return 'high';
  if (score < 82) return 'medium';
  return 'low';
}

export function priorityFromIssue(issue: RunEvaluationIssue): FeedbackPriority {
  return issue.severity === 'critical' ? 'critical' : 'high';
}

export function priorityFromRecommendation(recommendation: RunEvaluationRecommendation): FeedbackPriority {
  if (recommendation.priority === 'high') return 'high';
  if (recommendation.priority === 'medium') return 'medium';
  return 'low';
}
