import { DEMO_RUN_ID, demoWorkspace } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import { getApprovals } from '../runtime-store/approval-store';
import { getRunById, getRuns } from '../runtime-store/run-store';
import { getToolCallsByRun } from '../runtime-store/tool-call-store';
import { getBillingLedger, getUsageByRun } from '../runtime-store/usage-ledger-store';
import { getWorkflowData } from '../state/workflow-engine';
import { searchArtifacts, registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import { getGovernanceDecisionHistory } from './governance-decision-store';
import { getBlockedRuns, getTerminatedRuns } from './governance-enforcement-store';
import { buildTimelineForRun, getReplayFrames, getReplayState } from './execution-timeline-store';
import {
  normalizeScore,
  runEvaluationId,
  scoreStatus,
  type RunEvaluation,
  type RunEvaluationDimension,
  type RunEvaluationIssue,
  type RunEvaluationRecommendation,
  type RunEvaluationScore,
  type WorkspaceEvaluationSummary,
} from './run-evaluation';

const RUN_EVALUATION_STORAGE_KEY = 'uikigai-run-evaluation-v1';

interface RunEvaluationStoreState {
  evaluations: Record<string, RunEvaluation>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): RunEvaluationStoreState {
  return { evaluations: {}, updatedAt: new Date().toISOString() };
}

function readState(): RunEvaluationStoreState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(RUN_EVALUATION_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<RunEvaluationStoreState>;
    return {
      evaluations: parsed.evaluations ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: RunEvaluationStoreState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(RUN_EVALUATION_STORAGE_KEY, JSON.stringify(state));
}

function persistEvaluation(evaluation: RunEvaluation): RunEvaluation {
  const state = readState();
  writeState({
    evaluations: { ...state.evaluations, [evaluation.id]: evaluation },
    updatedAt: new Date().toISOString(),
  });
  return clone(evaluation);
}

function currentRun(runId: string) {
  return getRunById(runId) ?? getWorkflowData().runs.find((run) => run.id === runId);
}

function score(
  dimension: RunEvaluationDimension,
  value: number,
  evidence: string,
): RunEvaluationScore {
  const normalized = normalizeScore(value);
  return {
    dimension,
    value: normalized,
    max: 100,
    status: scoreStatus(normalized),
    evidence,
  };
}

function issue(
  dimension: RunEvaluationDimension,
  severity: RunEvaluationIssue['severity'],
  title: string,
  description: string,
  entityId?: string,
): RunEvaluationIssue {
  return {
    id: `run-eval-issue-${dimension}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    dimension,
    severity,
    title,
    description,
    entityId,
  };
}

function recommendation(
  dimension: RunEvaluationDimension,
  priority: RunEvaluationRecommendation['priority'],
  title: string,
  description: string,
): RunEvaluationRecommendation {
  return {
    id: `run-eval-rec-${dimension}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    dimension,
    title,
    description,
    priority,
  };
}

export function evaluateArtifactCompleteness(runId = DEMO_RUN_ID): RunEvaluationScore {
  const artifacts = searchArtifacts({ runId });
  const richArtifacts = artifacts.filter((artifact) => artifact.metadata.contentSummary || artifact.metadata.url || artifact.metadata.sourceType);
  const value = artifacts.length === 0 ? 40 : 70 + Math.min(30, richArtifacts.length * 10);
  return score('artifact_quality', value, `${artifacts.length} registered artifacts, ${richArtifacts.length} with previewable metadata.`);
}

export function evaluateToolFailures(runId = DEMO_RUN_ID): RunEvaluationScore {
  const tools = getToolCallsByRun(runId);
  const failed = tools.filter((tool) => tool.status === 'failed').length;
  const completed = tools.filter((tool) => tool.status === 'completed').length;
  const value = tools.length === 0 ? 60 : ((completed / tools.length) * 100) - (failed * 15);
  return score('tool_success', value, `${completed}/${tools.length} tool calls completed; ${failed} failed.`);
}

export function evaluateApprovalCompliance(runId = DEMO_RUN_ID): RunEvaluationScore {
  const approvals = getApprovals().filter((approval) => approval.runId === runId);
  const pending = approvals.filter((approval) => approval.status === 'pending').length;
  const rejected = approvals.filter((approval) => approval.status === 'rejected').length;
  const value = approvals.length === 0 ? 95 : 100 - pending * 12 - rejected * 25;
  return score('approval_compliance', value, `${approvals.length} approvals linked; ${pending} pending; ${rejected} rejected.`);
}

export function evaluateGovernanceCompliance(runId = DEMO_RUN_ID): RunEvaluationScore {
  const decisions = getGovernanceDecisionHistory().filter((decision) => decision.targetId === runId);
  const blocked = [...getBlockedRuns(), ...getTerminatedRuns()].filter((block) => block.targetId === runId);
  const denied = decisions.filter((decision) => decision.finalDecision !== 'ALLOW').length;
  const value = 100 - blocked.length * 40 - denied * 20;
  return score('governance_compliance', value, `${decisions.length} governance decisions; ${blocked.length} enforcement blocks; ${denied} non-allow decisions.`);
}

export function evaluateCostEfficiency(runId = DEMO_RUN_ID): RunEvaluationScore {
  const ledger = getBillingLedger(runId);
  const usage = getUsageByRun(runId);
  const estimate = ledger.estimatedTotal || usage.reduce((total, record) => total + record.estimatedCost, 0);
  const actual = ledger.actualTotal || usage.reduce((total, record) => total + record.actualCost, 0);
  const variancePercent = estimate > 0 ? Math.abs(actual - estimate) / estimate : 0;
  const value = usage.length === 0 ? 75 : 100 - variancePercent * 100;
  return score('cost_efficiency', value, `Estimated $${estimate.toFixed(4)}, actual $${actual.toFixed(4)}, variance ${(variancePercent * 100).toFixed(1)}%.`);
}

export function evaluateReplayIntegrity(runId = DEMO_RUN_ID): RunEvaluationScore {
  const timeline = buildTimelineForRun(runId);
  const frames = getReplayFrames(runId);
  const finalState = getReplayState(runId);
  const hasTerminal = timeline.events.some((event) => ['RUN_COMPLETED', 'RUN_FAILED', 'RUN_CANCELLED'].includes(event.type));
  const value = frames.length === timeline.events.length && frames.length > 0
    ? hasTerminal ? 100 : 88
    : frames.length > 0 ? 72 : 35;
  return score('replay_integrity', value, `${frames.length} replay frames for ${timeline.events.length} timeline events; final state ${finalState?.runStatus ?? 'unknown'}.`);
}

function evaluateTaskCompletion(runId: string): RunEvaluationScore {
  const run = currentRun(runId);
  const finalStatus = String(run?.status ?? (run as { lifecycle?: string } | undefined)?.lifecycle ?? '').toLowerCase();
  const replayState = getReplayState(runId);
  const completed = finalStatus.includes('success') || finalStatus.includes('completed') || replayState?.runStatus === 'completed';
  const value = completed ? 96 : finalStatus.includes('failed') ? 35 : 72;
  return score('task_completion', value, `Run status ${run?.status ?? 'unknown'}; replay status ${replayState?.runStatus ?? 'unknown'}.`);
}

function buildIssues(scores: RunEvaluationScore[], runId: string): RunEvaluationIssue[] {
  return scores
    .filter((item) => item.dimension !== 'overall_score' && item.value < 90)
    .map((item) => issue(
      item.dimension,
      item.value < 60 ? 'critical' : 'warning',
      `${item.dimension.replace(/_/g, ' ')} below target`,
      item.evidence,
      runId,
    ));
}

function buildRecommendations(scores: RunEvaluationScore[]): RunEvaluationRecommendation[] {
  return scores
    .filter((item) => item.dimension !== 'overall_score' && item.value < 90)
    .map((item) => recommendation(
      item.dimension,
      item.value < 60 ? 'high' : 'medium',
      `Improve ${item.dimension.replace(/_/g, ' ')}`,
      `Review evidence: ${item.evidence}`,
    ));
}

export function evaluateRun(runId = DEMO_RUN_ID): RunEvaluation {
  const run = currentRun(runId);
  if (!run) throw new Error(`Cannot evaluate missing run: ${runId}`);
  const dimensionScores = [
    evaluateTaskCompletion(runId),
    evaluateArtifactCompleteness(runId),
    evaluateToolFailures(runId),
    evaluateApprovalCompliance(runId),
    evaluateGovernanceCompliance(runId),
    evaluateCostEfficiency(runId),
    evaluateReplayIntegrity(runId),
  ];
  const overall = normalizeScore(dimensionScores.reduce((total, item) => total + item.value, 0) / dimensionScores.length);
  const overallScore = score('overall_score', overall, `Average of ${dimensionScores.length} dimensions.`);
  const scores = [...dimensionScores, overallScore];
  const issues = buildIssues(scores, runId);
  const recommendations = buildRecommendations(scores);
  const status: RunEvaluation['status'] = overall >= 85 && !issues.some((item) => item.severity === 'critical')
    ? 'passed'
    : overall >= 65 ? 'needs_review' : 'failed';
  return persistEvaluation({
    id: runEvaluationId(runId),
    runId,
    ticketId: run.ticketId,
    agentId: run.agentId,
    status,
    scores,
    issues,
    recommendations,
    overallScore: overall,
    artifactCompleteness: scores.find((item) => item.dimension === 'artifact_quality')?.value ?? 0,
    toolFailureCount: getToolCallsByRun(runId).filter((tool) => tool.status === 'failed').length,
    approvalCompliance: scores.find((item) => item.dimension === 'approval_compliance')?.value ?? 0,
    governanceCompliance: scores.find((item) => item.dimension === 'governance_compliance')?.value ?? 0,
    costEfficiency: scores.find((item) => item.dimension === 'cost_efficiency')?.value ?? 0,
    replayIntegrity: scores.find((item) => item.dimension === 'replay_integrity')?.value ?? 0,
    evaluatedAt: new Date().toISOString(),
  });
}

export function getRunEvaluation(runId = DEMO_RUN_ID): RunEvaluation {
  return readState().evaluations[runEvaluationId(runId)] ? clone(readState().evaluations[runEvaluationId(runId)]) : evaluateRun(runId);
}

export function getRunEvaluationScore(runId = DEMO_RUN_ID, dimension?: RunEvaluationDimension): RunEvaluationScore[] {
  const scores = getRunEvaluation(runId).scores;
  return dimension ? scores.filter((scoreItem) => scoreItem.dimension === dimension) : scores;
}

export function getRunEvaluationIssues(runId = DEMO_RUN_ID): RunEvaluationIssue[] {
  return getRunEvaluation(runId).issues;
}

export function getRunEvaluationRecommendations(runId = DEMO_RUN_ID): RunEvaluationRecommendation[] {
  return getRunEvaluation(runId).recommendations;
}

export function getRunsByEvaluationScore(minScore = 0): RunEvaluation[] {
  const data = getWorkflowData();
  const runIds = [...new Set([...data.runs, ...getRuns()].map((run) => run.id))];
  return runIds
    .map((runId) => getRunEvaluation(runId))
    .filter((evaluation) => evaluation.overallScore >= minScore)
    .sort((a, b) => b.overallScore - a.overallScore);
}

export function getWorkspaceEvaluationSummary(workspaceId = demoWorkspace.id): WorkspaceEvaluationSummary {
  const evaluations = getRunsByEvaluationScore(0);
  const averageScore = evaluations.length ? evaluations.reduce((total, evaluation) => total + evaluation.overallScore, 0) / evaluations.length : 0;
  const issues = evaluations.flatMap((evaluation) => evaluation.issues);
  return {
    workspaceId,
    evaluationCount: evaluations.length,
    averageScore: normalizeScore(averageScore),
    passed: evaluations.filter((evaluation) => evaluation.status === 'passed').length,
    needsReview: evaluations.filter((evaluation) => evaluation.status === 'needs_review').length,
    failed: evaluations.filter((evaluation) => evaluation.status === 'failed').length,
    criticalIssues: issues.filter((item) => item.severity === 'critical').length,
    warningIssues: issues.filter((item) => item.severity === 'warning').length,
    generatedAt: new Date().toISOString(),
  };
}

export function exportRunEvaluationJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify(getRunEvaluation(runId), null, 2);
}

export function exportRunEvaluationSummaryMarkdown(runId = DEMO_RUN_ID): string {
  const evaluation = getRunEvaluation(runId);
  return [
    '# Run Evaluation Summary',
    '',
    `Run: ${runId}`,
    `Overall score: ${evaluation.overallScore}`,
    `Status: ${evaluation.status}`,
    '',
    '| Dimension | Score | Status | Evidence |',
    '|---|---:|---|---|',
    ...evaluation.scores.map((item) => `| ${item.dimension} | ${item.value} | ${item.status} | ${item.evidence} |`),
    '',
  ].join('\n');
}

export function exportRunQualityReportMarkdown(runId = DEMO_RUN_ID): string {
  const evaluation = getRunEvaluation(runId);
  return [
    '# Run Quality Report',
    '',
    `Run: ${runId}`,
    `Evaluation: ${evaluation.status}`,
    '',
    '## Issues',
    ...evaluation.issues.map((item) => `- ${item.severity.toUpperCase()}: ${item.title} - ${item.description}`),
    '',
    '## Recommendations',
    ...evaluation.recommendations.map((item) => `- ${item.priority.toUpperCase()}: ${item.title} - ${item.description}`),
    '',
  ].join('\n');
}

export function exportEvaluationIssuesJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify(getRunEvaluationIssues(runId), null, 2);
}

function exportArtifact(id: string, runId: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return {
    id,
    runId,
    type,
    name,
    source: 'mock',
    contentSummary: `Run evaluation export for ${runId}`,
    contentText,
    createdAt: new Date().toISOString(),
  };
}

export function registerRunEvaluationExports(runId = DEMO_RUN_ID): ArtifactRecord[] {
  const exports = [
    exportArtifact(`artifact-${runId}-run-evaluation-json`, runId, 'run-evaluation.json', exportRunEvaluationJson(runId), 'json'),
    exportArtifact(`artifact-${runId}-run-evaluation-summary-md`, runId, 'run-evaluation-summary.md', exportRunEvaluationSummaryMarkdown(runId), 'markdown'),
    exportArtifact(`artifact-${runId}-run-quality-report-md`, runId, 'run-quality-report.md', exportRunQualityReportMarkdown(runId), 'report'),
    exportArtifact(`artifact-${runId}-evaluation-issues-json`, runId, 'evaluation-issues.json', exportEvaluationIssuesJson(runId), 'json'),
  ];
  return exports.map((artifact) => registerArtifact(artifact, { type: 'EXPORT', metadata: { runId, tags: ['run-evaluation', 'quality', 'export'] } }));
}

export function clearRunEvaluationStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(RUN_EVALUATION_STORAGE_KEY);
}
