import { demoWorkspace, DEMO_RUN_ID } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import type { ArtifactRecord } from './artifact-registry';
import { registerArtifact } from './artifact-registry-store';
import { getBillingLedger } from '../runtime-store/usage-ledger-store';
import type { ActionPlanExecution, ActionTaskExecution } from './action-plan-execution';
import { getActionPlanExecutionByRun } from './action-plan-execution-store';
import { getFeedbackActionPlan, getFeedbackActionPlanByRun } from './feedback-action-planner-store';
import type { FeedbackCategory } from './evaluation-feedback';
import {
  cloneEvaluationWithScoreAdjustments,
  improvementOutcomeId,
  outcomeStatusFromComparison,
  type ImprovementComparison,
  type ImprovementMetricDelta,
  type ImprovementOutcome,
  type OutcomeEvidence,
  type OutcomeVerificationStatus,
  type RegressionFinding,
  type WorkspaceImprovementOutcomeSummary,
} from './improvement-outcome';
import type { RunEvaluation, RunEvaluationDimension } from './run-evaluation';
import { getRunEvaluation } from './run-evaluation-store';

const IMPROVEMENT_OUTCOME_STORAGE_KEY = 'uikigai-improvement-outcome-v1';

interface ImprovementOutcomeStoreState {
  outcomes: Record<string, ImprovementOutcome>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): ImprovementOutcomeStoreState {
  return { outcomes: {}, updatedAt: new Date().toISOString() };
}

function readState(): ImprovementOutcomeStoreState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(IMPROVEMENT_OUTCOME_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ImprovementOutcomeStoreState>;
    return {
      outcomes: parsed.outcomes ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ImprovementOutcomeStoreState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(IMPROVEMENT_OUTCOME_STORAGE_KEY, JSON.stringify(state));
}

function persistOutcome(outcome: ImprovementOutcome): ImprovementOutcome {
  const state = readState();
  writeState({
    outcomes: { ...state.outcomes, [outcome.id]: outcome },
    updatedAt: new Date().toISOString(),
  });
  return clone(outcome);
}

function categoryTarget(category?: FeedbackCategory): RunEvaluationDimension {
  if (category === 'artifact_quality') return 'artifact_quality';
  if (category === 'approval_process') return 'approval_compliance';
  if (category === 'governance_policy') return 'governance_compliance';
  if (category === 'cost_optimization') return 'cost_efficiency';
  if (category === 'replay_integrity') return 'replay_integrity';
  if (category === 'tool_selection') return 'tool_success';
  return 'task_completion';
}

function completedTaskTargets(execution: ActionPlanExecution, task?: ActionTaskExecution): RunEvaluationDimension[] {
  const plan = getFeedbackActionPlan(execution.planId) ?? getFeedbackActionPlanByRun(execution.runId);
  const sourceTasks = task ? [task] : execution.tasks.filter((item) => item.status === 'completed');
  const dimensions = sourceTasks.map((item) => {
    const planTask = plan.tasks.find((candidate) => candidate.id === item.taskId);
    return categoryTarget(planTask?.category);
  });
  return [...new Set(dimensions.length ? dimensions : ['overall_score' as RunEvaluationDimension])];
}

function findExecutionById(actionExecutionId: string): ActionPlanExecution | undefined {
  const byRun = getActionPlanExecutionByRun(DEMO_RUN_ID);
  if (byRun.id === actionExecutionId) return byRun;
  return undefined;
}

function findTaskExecution(taskExecutionId: string): { execution: ActionPlanExecution; task: ActionTaskExecution } | undefined {
  const execution = getActionPlanExecutionByRun(DEMO_RUN_ID);
  const task = execution.tasks.find((item) => item.id === taskExecutionId || item.taskId === taskExecutionId);
  return task ? { execution, task } : undefined;
}

function improvementAdjustments(targets: RunEvaluationDimension[], taskCount: number): Partial<Record<RunEvaluationDimension, number>> {
  const adjustment = Math.min(18, Math.max(6, taskCount * 6));
  return Object.fromEntries(targets.filter((dimension) => dimension !== 'overall_score').map((dimension) => [dimension, adjustment]));
}

export function calculateMetricDeltas(beforeEvaluation: RunEvaluation, afterEvaluation: RunEvaluation): ImprovementMetricDelta[] {
  return beforeEvaluation.scores.map((beforeScore) => {
    const afterScore = afterEvaluation.scores.find((score) => score.dimension === beforeScore.dimension);
    const after = afterScore?.value ?? beforeScore.value;
    return {
      dimension: beforeScore.dimension,
      before: beforeScore.value,
      after,
      delta: after - beforeScore.value,
      improved: after > beforeScore.value,
    };
  });
}

export function compareRunEvaluationBeforeAfter(beforeRunId: string, afterRunId: string): ImprovementComparison {
  const beforeEvaluation = getRunEvaluation(beforeRunId);
  const afterEvaluation = beforeRunId === afterRunId
    ? cloneEvaluationWithScoreAdjustments(beforeEvaluation, { task_completion: 4 })
    : getRunEvaluation(afterRunId);
  const metricDeltas = calculateMetricDeltas(beforeEvaluation, afterEvaluation);
  return {
    beforeRunId,
    afterRunId,
    beforeEvaluationId: beforeEvaluation.id,
    afterEvaluationId: afterEvaluation.id,
    overallDelta: metricDeltas.find((delta) => delta.dimension === 'overall_score')?.delta ?? afterEvaluation.overallScore - beforeEvaluation.overallScore,
    metricDeltas,
    comparedAt: new Date().toISOString(),
  };
}

function compareEvaluationWithAdjustments(runId: string, targets: RunEvaluationDimension[], taskCount: number): ImprovementComparison {
  const beforeEvaluation = getRunEvaluation(runId);
  const afterEvaluation = cloneEvaluationWithScoreAdjustments(beforeEvaluation, improvementAdjustments(targets, taskCount));
  const metricDeltas = calculateMetricDeltas(beforeEvaluation, afterEvaluation);
  return {
    beforeRunId: runId,
    afterRunId: `${runId}-after-improvement`,
    beforeEvaluationId: beforeEvaluation.id,
    afterEvaluationId: afterEvaluation.id,
    overallDelta: metricDeltas.find((delta) => delta.dimension === 'overall_score')?.delta ?? afterEvaluation.overallScore - beforeEvaluation.overallScore,
    metricDeltas,
    comparedAt: new Date().toISOString(),
  };
}

export function detectRegressionFindings(metricDeltas: ImprovementMetricDelta[], outcomeId = 'pending-outcome'): RegressionFinding[] {
  return metricDeltas
    .filter((delta) => delta.delta < -5 || (delta.dimension !== 'overall_score' && delta.after < 60))
    .map((delta) => ({
      id: `regression-${outcomeId}-${delta.dimension}`,
      outcomeId,
      dimension: delta.dimension,
      severity: delta.after < 60 ? 'critical' : 'warning',
      description: `${delta.dimension.replace(/_/g, ' ')} changed from ${delta.before} to ${delta.after}.`,
      before: delta.before,
      after: delta.after,
    }));
}

export function generateOutcomeEvidence(outcomeId: string): OutcomeEvidence[] {
  const outcome = getImprovementOutcomeByAction(outcomeId.replace(/^improvement-outcome-/, ''));
  if (!outcome?.comparison) {
    return [{
      id: `outcome-evidence-${outcomeId}-inconclusive`,
      outcomeId,
      type: 'evaluation',
      title: 'Outcome inconclusive',
      description: 'Before/after evaluation data was not available.',
      createdAt: new Date().toISOString(),
    }];
  }
  const ledger = getBillingLedger(outcome.runId);
  return [
    {
      id: `outcome-evidence-${outcomeId}-comparison`,
      outcomeId,
      type: 'evaluation',
      title: 'Before/after evaluation comparison',
      description: `Overall score delta ${outcome.comparison.overallDelta}.`,
      createdAt: new Date().toISOString(),
    },
    {
      id: `outcome-evidence-${outcomeId}-metrics`,
      outcomeId,
      type: 'metric_delta',
      title: 'Metric delta report',
      description: `${outcome.comparison.metricDeltas.length} metrics compared.`,
      createdAt: new Date().toISOString(),
    },
    {
      id: `outcome-evidence-${outcomeId}-cost`,
      outcomeId,
      type: 'cost',
      title: 'Estimated vs actual cost',
      description: `Estimated $${ledger.estimatedTotal.toFixed(4)}, actual $${ledger.actualTotal.toFixed(4)}.`,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function createOutcomeVerification(actionExecutionId: string): ImprovementOutcome {
  const existing = readState().outcomes[improvementOutcomeId(actionExecutionId)];
  if (existing) return clone(existing);
  const execution = findExecutionById(actionExecutionId) ?? getActionPlanExecutionByRun(DEMO_RUN_ID);
  const completed = execution.tasks.filter((task) => task.status === 'completed');
  const targets = completedTaskTargets(execution);
  let comparison: ImprovementComparison | undefined;
  let regressions: RegressionFinding[] = [];
  try {
    comparison = completed.length ? compareEvaluationWithAdjustments(execution.runId, targets, completed.length) : undefined;
    regressions = comparison ? detectRegressionFindings(comparison.metricDeltas, improvementOutcomeId(actionExecutionId)) : [];
  } catch {
    comparison = undefined;
  }
  const id = improvementOutcomeId(actionExecutionId);
  const status: OutcomeVerificationStatus = completed.length ? outcomeStatusFromComparison(comparison, regressions) : 'inconclusive';
  const outcome: ImprovementOutcome = {
    id,
    actionExecutionId,
    runId: execution.runId,
    status,
    targetDimensions: targets,
    comparison,
    evidence: [],
    regressions,
    verifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const withEvidence = { ...outcome, evidence: generateEvidenceForOutcome(outcome) };
  return persistOutcome(withEvidence);
}

function generateEvidenceForOutcome(outcome: ImprovementOutcome): OutcomeEvidence[] {
  if (!outcome.comparison) {
    return [{
      id: `outcome-evidence-${outcome.id}-inconclusive`,
      outcomeId: outcome.id,
      type: 'evaluation',
      title: 'Outcome inconclusive',
      description: 'Before/after evaluation data was not available.',
      createdAt: new Date().toISOString(),
    }];
  }
  const ledger = getBillingLedger(outcome.runId);
  return [
    {
      id: `outcome-evidence-${outcome.id}-comparison`,
      outcomeId: outcome.id,
      type: 'evaluation',
      title: 'Before/after evaluation comparison',
      description: `Overall score delta ${outcome.comparison.overallDelta}.`,
      createdAt: new Date().toISOString(),
    },
    {
      id: `outcome-evidence-${outcome.id}-metrics`,
      outcomeId: outcome.id,
      type: 'metric_delta',
      title: 'Metric delta report',
      description: `${outcome.comparison.metricDeltas.length} metrics compared.`,
      createdAt: new Date().toISOString(),
    },
    {
      id: `outcome-evidence-${outcome.id}-cost`,
      outcomeId: outcome.id,
      type: 'cost',
      title: 'Estimated vs actual cost',
      description: `Estimated $${ledger.estimatedTotal.toFixed(4)}, actual $${ledger.actualTotal.toFixed(4)}.`,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function verifyCompletedActionImpact(actionTaskExecutionId: string): ImprovementOutcome {
  const located = findTaskExecution(actionTaskExecutionId);
  if (!located || located.task.status !== 'completed') {
    const id = improvementOutcomeId(actionTaskExecutionId);
    return persistOutcome({
      id,
      actionExecutionId: actionTaskExecutionId,
      actionTaskExecutionId,
      runId: DEMO_RUN_ID,
      status: 'inconclusive',
      targetDimensions: [],
      evidence: generateEvidenceForOutcome({
        id,
        actionExecutionId: actionTaskExecutionId,
        actionTaskExecutionId,
        runId: DEMO_RUN_ID,
        status: 'inconclusive',
        targetDimensions: [],
        evidence: [],
        regressions: [],
        verifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      regressions: [],
      verifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  const id = improvementOutcomeId(actionTaskExecutionId);
  const existing = readState().outcomes[id];
  if (existing) return clone(existing);
  const targets = completedTaskTargets(located.execution, located.task);
  const comparison = compareEvaluationWithAdjustments(located.execution.runId, targets, 1);
  const regressions = detectRegressionFindings(comparison.metricDeltas, id);
  const outcome: ImprovementOutcome = {
    id,
    actionExecutionId: located.execution.id,
    actionTaskExecutionId,
    runId: located.execution.runId,
    status: outcomeStatusFromComparison(comparison, regressions),
    targetDimensions: targets,
    comparison,
    evidence: [],
    regressions,
    verifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return persistOutcome({ ...outcome, evidence: generateEvidenceForOutcome(outcome) });
}

export function getImprovementOutcomeByAction(actionExecutionId: string): ImprovementOutcome | undefined {
  const outcome = readState().outcomes[improvementOutcomeId(actionExecutionId)] ?? Object.values(readState().outcomes).find((item) => item.actionExecutionId === actionExecutionId || item.actionTaskExecutionId === actionExecutionId);
  return outcome ? clone(outcome) : undefined;
}

export function getOutcomesByRun(runId = DEMO_RUN_ID): ImprovementOutcome[] {
  const outcomes = Object.values(readState().outcomes).filter((outcome) => outcome.runId === runId);
  if (outcomes.length) return outcomes.map(clone);
  return [createOutcomeVerification(getActionPlanExecutionByRun(runId).id)];
}

export function getImprovedOutcomes(runId = DEMO_RUN_ID): ImprovementOutcome[] {
  return getOutcomesByRun(runId).filter((outcome) => outcome.status === 'improved');
}

export function getRegressedOutcomes(runId = DEMO_RUN_ID): ImprovementOutcome[] {
  return getOutcomesByRun(runId).filter((outcome) => outcome.status === 'regressed');
}

export function getInconclusiveOutcomes(runId = DEMO_RUN_ID): ImprovementOutcome[] {
  return getOutcomesByRun(runId).filter((outcome) => outcome.status === 'inconclusive');
}

export function getMetricDeltas(actionExecutionId: string): ImprovementMetricDelta[] {
  return getImprovementOutcomeByAction(actionExecutionId)?.comparison?.metricDeltas ?? [];
}

export function getOutcomeEvidence(actionExecutionId: string): OutcomeEvidence[] {
  return getImprovementOutcomeByAction(actionExecutionId)?.evidence ?? [];
}

export function generateWorkspaceImprovementOutcomeSummary(workspaceId = demoWorkspace.id): WorkspaceImprovementOutcomeSummary {
  const outcomes = Object.values(readState().outcomes);
  return {
    workspaceId,
    outcomeCount: outcomes.length,
    improved: outcomes.filter((outcome) => outcome.status === 'improved').length,
    unchanged: outcomes.filter((outcome) => outcome.status === 'unchanged').length,
    regressed: outcomes.filter((outcome) => outcome.status === 'regressed').length,
    inconclusive: outcomes.filter((outcome) => outcome.status === 'inconclusive').length,
    evidenceCount: outcomes.flatMap((outcome) => outcome.evidence).length,
    generatedAt: new Date().toISOString(),
  };
}

export function exportImprovementOutcomeJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify(getOutcomesByRun(runId), null, 2);
}

export function exportImprovementOutcomeSummaryMarkdown(runId = DEMO_RUN_ID): string {
  const outcomes = getOutcomesByRun(runId);
  return [
    '# Improvement Outcome Summary',
    '',
    `Run: ${runId}`,
    '',
    '| Outcome | Status | Overall Delta |',
    '|---|---|---:|',
    ...outcomes.map((outcome) => `| ${outcome.id} | ${outcome.status} | ${outcome.comparison?.overallDelta ?? 0} |`),
    '',
  ].join('\n');
}

export function exportMetricDeltaReportJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify(getOutcomesByRun(runId).flatMap((outcome) => outcome.comparison?.metricDeltas ?? []), null, 2);
}

export function exportRegressionFindingsMarkdown(runId = DEMO_RUN_ID): string {
  const regressions = getOutcomesByRun(runId).flatMap((outcome) => outcome.regressions);
  return [
    '# Regression Findings',
    '',
    ...regressions.map((finding) => `- ${finding.severity.toUpperCase()}: ${finding.dimension} ${finding.before} -> ${finding.after}`),
    regressions.length ? '' : 'No regression findings.',
  ].join('\n');
}

export function exportOutcomeEvidenceMarkdown(runId = DEMO_RUN_ID): string {
  return [
    '# Outcome Evidence',
    '',
    ...getOutcomesByRun(runId).flatMap((outcome) => outcome.evidence.map((evidence) => `- ${evidence.type}: ${evidence.title} - ${evidence.description}`)),
    '',
  ].join('\n');
}

function exportArtifact(id: string, runId: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return {
    id,
    runId,
    type,
    name,
    source: 'mock',
    contentSummary: `Improvement outcome export for ${runId}`,
    contentText,
    createdAt: new Date().toISOString(),
  };
}

export function registerImprovementOutcomeExports(runId = DEMO_RUN_ID): ArtifactRecord[] {
  const exports = [
    exportArtifact(`artifact-${runId}-improvement-outcome-json`, runId, 'improvement-outcome.json', exportImprovementOutcomeJson(runId), 'json'),
    exportArtifact(`artifact-${runId}-improvement-outcome-summary-md`, runId, 'improvement-outcome-summary.md', exportImprovementOutcomeSummaryMarkdown(runId), 'markdown'),
    exportArtifact(`artifact-${runId}-metric-delta-report-json`, runId, 'metric-delta-report.json', exportMetricDeltaReportJson(runId), 'json'),
    exportArtifact(`artifact-${runId}-regression-findings-md`, runId, 'regression-findings.md', exportRegressionFindingsMarkdown(runId), 'markdown'),
    exportArtifact(`artifact-${runId}-outcome-evidence-md`, runId, 'outcome-evidence.md', exportOutcomeEvidenceMarkdown(runId), 'markdown'),
  ];
  return exports.map((artifact) => registerArtifact(artifact, { type: 'EXPORT', metadata: { runId, tags: ['improvement-outcome', 'verification', 'export'] } }));
}

export function clearImprovementOutcomeStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(IMPROVEMENT_OUTCOME_STORAGE_KEY);
}
