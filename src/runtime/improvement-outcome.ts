import type { RunEvaluation, RunEvaluationDimension } from './run-evaluation';

export type OutcomeVerificationStatus = 'unverified' | 'improved' | 'unchanged' | 'regressed' | 'inconclusive';

export interface ImprovementMetricDelta {
  dimension: RunEvaluationDimension;
  before: number;
  after: number;
  delta: number;
  improved: boolean;
}

export interface ImprovementComparison {
  beforeRunId: string;
  afterRunId: string;
  beforeEvaluationId?: string;
  afterEvaluationId?: string;
  overallDelta: number;
  metricDeltas: ImprovementMetricDelta[];
  comparedAt: string;
}

export interface OutcomeEvidence {
  id: string;
  outcomeId: string;
  type: 'evaluation' | 'metric_delta' | 'completion_evidence' | 'cost' | 'artifact' | 'governance' | 'replay';
  title: string;
  description: string;
  createdAt: string;
}

export interface RegressionFinding {
  id: string;
  outcomeId: string;
  dimension: RunEvaluationDimension;
  severity: 'warning' | 'critical';
  description: string;
  before: number;
  after: number;
}

export interface ImprovementOutcome {
  id: string;
  actionExecutionId: string;
  actionTaskExecutionId?: string;
  runId: string;
  status: OutcomeVerificationStatus;
  targetDimensions: RunEvaluationDimension[];
  comparison?: ImprovementComparison;
  evidence: OutcomeEvidence[];
  regressions: RegressionFinding[];
  verifiedAt: string;
  updatedAt: string;
}

export interface WorkspaceImprovementOutcomeSummary {
  workspaceId: string;
  outcomeCount: number;
  improved: number;
  unchanged: number;
  regressed: number;
  inconclusive: number;
  evidenceCount: number;
  generatedAt: string;
}

export function improvementOutcomeId(actionExecutionId: string): string {
  return `improvement-outcome-${actionExecutionId}`;
}

export function outcomeStatusFromComparison(
  comparison: ImprovementComparison | undefined,
  regressions: RegressionFinding[],
): OutcomeVerificationStatus {
  if (!comparison) return 'inconclusive';
  if (regressions.some((finding) => finding.severity === 'critical')) return 'regressed';
  if (comparison.overallDelta > 0 || comparison.metricDeltas.some((delta) => delta.delta > 0)) return 'improved';
  if (comparison.overallDelta === 0 && comparison.metricDeltas.every((delta) => delta.delta === 0)) return 'unchanged';
  return regressions.length ? 'regressed' : 'unchanged';
}

export function cloneEvaluationWithScoreAdjustments(
  evaluation: RunEvaluation,
  adjustments: Partial<Record<RunEvaluationDimension, number>>,
): RunEvaluation {
  const scores = evaluation.scores.map((score) => {
    const adjustment = adjustments[score.dimension] ?? 0;
    const value = Math.max(0, Math.min(100, score.value + adjustment));
    return {
      ...score,
      value,
      status: value >= 90 ? 'excellent' as const : value >= 75 ? 'good' as const : value >= 60 ? 'warning' as const : 'poor' as const,
      evidence: adjustment ? `${score.evidence} Outcome adjustment ${adjustment > 0 ? '+' : ''}${adjustment}.` : score.evidence,
    };
  });
  const dimensionScores = scores.filter((score) => score.dimension !== 'overall_score');
  const overall = Math.round(dimensionScores.reduce((total, score) => total + score.value, 0) / Math.max(1, dimensionScores.length));
  const finalScores = scores.map((score) => score.dimension === 'overall_score'
    ? { ...score, value: overall, status: overall >= 90 ? 'excellent' as const : overall >= 75 ? 'good' as const : overall >= 60 ? 'warning' as const : 'poor' as const }
    : score);
  return {
    ...evaluation,
    id: `${evaluation.id}-after`,
    scores: finalScores,
    overallScore: overall,
    artifactCompleteness: finalScores.find((score) => score.dimension === 'artifact_quality')?.value ?? evaluation.artifactCompleteness,
    approvalCompliance: finalScores.find((score) => score.dimension === 'approval_compliance')?.value ?? evaluation.approvalCompliance,
    governanceCompliance: finalScores.find((score) => score.dimension === 'governance_compliance')?.value ?? evaluation.governanceCompliance,
    costEfficiency: finalScores.find((score) => score.dimension === 'cost_efficiency')?.value ?? evaluation.costEfficiency,
    replayIntegrity: finalScores.find((score) => score.dimension === 'replay_integrity')?.value ?? evaluation.replayIntegrity,
    evaluatedAt: new Date().toISOString(),
  };
}
