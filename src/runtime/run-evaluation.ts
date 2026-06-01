export type RunEvaluationDimension =
  | 'task_completion'
  | 'artifact_quality'
  | 'tool_success'
  | 'approval_compliance'
  | 'governance_compliance'
  | 'cost_efficiency'
  | 'replay_integrity'
  | 'overall_score';

export type RunEvaluationIssueSeverity = 'info' | 'warning' | 'critical';

export interface RunEvaluationScore {
  dimension: RunEvaluationDimension;
  value: number;
  max: number;
  status: 'excellent' | 'good' | 'warning' | 'poor';
  evidence: string;
}

export interface RunEvaluationIssue {
  id: string;
  dimension: RunEvaluationDimension;
  severity: RunEvaluationIssueSeverity;
  title: string;
  description: string;
  entityId?: string;
}

export interface RunEvaluationRecommendation {
  id: string;
  dimension: RunEvaluationDimension;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

export interface RunEvaluation {
  id: string;
  runId: string;
  ticketId?: string;
  agentId?: string;
  status: 'passed' | 'needs_review' | 'failed';
  scores: RunEvaluationScore[];
  issues: RunEvaluationIssue[];
  recommendations: RunEvaluationRecommendation[];
  overallScore: number;
  artifactCompleteness: number;
  toolFailureCount: number;
  approvalCompliance: number;
  governanceCompliance: number;
  costEfficiency: number;
  replayIntegrity: number;
  evaluatedAt: string;
}

export interface WorkspaceEvaluationSummary {
  workspaceId: string;
  evaluationCount: number;
  averageScore: number;
  passed: number;
  needsReview: number;
  failed: number;
  criticalIssues: number;
  warningIssues: number;
  generatedAt: string;
}

export function runEvaluationId(runId: string): string {
  return `run-evaluation-${runId}`;
}

export function normalizeScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreStatus(value: number): RunEvaluationScore['status'] {
  if (value >= 90) return 'excellent';
  if (value >= 75) return 'good';
  if (value >= 60) return 'warning';
  return 'poor';
}
