import { DEMO_RUN_ID } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import type { ArtifactRecord } from './artifact-registry';
import { registerArtifact } from './artifact-registry-store';
import { createOutcomeVerification } from './improvement-outcome-store';
import {
  getRecommendations,
  markRecommendationAccepted,
  updateRecommendationConfidence,
} from './learning-memory-store';
import type { Recommendation } from './learning-memory';
import {
  isHighRiskRecommendation,
  recommendationExecutionId,
  type RecommendationExecution,
  type RecommendationExecutionEvidence,
  type RecommendationExecutionStatus,
  type RecommendationExecutionStep,
  type RecommendationExecutionSummary,
  type RecommendationImpactResult,
} from './recommendation-execution';

const RECOMMENDATION_EXECUTION_STORAGE_KEY = 'uikigai-recommendation-execution-v1';

interface RecommendationExecutionStoreState {
  executions: Record<string, RecommendationExecution>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyState(): RecommendationExecutionStoreState {
  return { executions: {}, updatedAt: nowIso() };
}

function readState(): RecommendationExecutionStoreState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(RECOMMENDATION_EXECUTION_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<RecommendationExecutionStoreState>;
    return {
      executions: parsed.executions ?? {},
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: RecommendationExecutionStoreState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(RECOMMENDATION_EXECUTION_STORAGE_KEY, JSON.stringify(state));
}

function findRecommendation(recommendationId: string): Recommendation | undefined {
  return getRecommendations().find((recommendation) => recommendation.id === recommendationId);
}

function persistExecution(execution: RecommendationExecution): RecommendationExecution {
  const state = readState();
  writeState({
    executions: { ...state.executions, [execution.id]: execution },
    updatedAt: nowIso(),
  });
  return clone(execution);
}

function buildSteps(executionId: string, recommendation: Recommendation): RecommendationExecutionStep[] {
  const highRisk = isHighRiskRecommendation(recommendation.impact.priority, recommendation.type);
  const base: Omit<RecommendationExecutionStep, 'id' | 'executionId' | 'order'>[] = [
    { name: 'Review recommendation evidence', status: 'planned', required: true },
    ...(highRisk ? [{ name: 'Run governance preflight', status: 'planned' as RecommendationExecutionStatus, required: true }] : []),
    { name: 'Apply improvement action', status: 'planned', required: true },
    { name: 'Capture execution evidence', status: 'planned', required: true },
    { name: 'Verify measurable impact', status: 'planned', required: true },
  ];
  return base.map((step, index) => ({
    ...step,
    id: `${executionId}-step-${index + 1}`,
    executionId,
    order: index + 1,
  }));
}

function getExecutionByRecommendationId(recommendationId: string): RecommendationExecution | undefined {
  return Object.values(readState().executions).find((execution) => execution.recommendationId === recommendationId);
}

function setStepStatus(steps: RecommendationExecutionStep[], names: string[], status: RecommendationExecutionStatus): RecommendationExecutionStep[] {
  const now = nowIso();
  return steps.map((step) => names.includes(step.name) ? { ...step, status, completedAt: status === 'completed' || status === 'verified' ? now : step.completedAt } : step);
}

function evidenceFromInput(executionId: string, evidence: Omit<RecommendationExecutionEvidence, 'id' | 'executionId' | 'createdAt'>): RecommendationExecutionEvidence {
  return {
    id: `recommendation-execution-evidence-${executionId}-${Date.now()}`,
    executionId,
    createdAt: nowIso(),
    ...evidence,
  };
}

export function createExecutionFromRecommendation(recommendationId: string): RecommendationExecution {
  const existing = getExecutionByRecommendationId(recommendationId);
  if (existing) return clone(existing);
  const recommendation = findRecommendation(recommendationId);
  if (!recommendation) throw new Error(`Cannot execute missing recommendation: ${recommendationId}`);
  if (recommendation.status === 'rejected') throw new Error(`Rejected recommendation cannot execute: ${recommendationId}`);
  if (recommendation.status !== 'accepted') throw new Error(`Only accepted recommendations can execute: ${recommendationId}`);
  const id = recommendationExecutionId(recommendation.id);
  const timestamp = nowIso();
  return persistExecution({
    id,
    recommendationId: recommendation.id,
    runId: recommendation.context.runId ?? DEMO_RUN_ID,
    agentId: recommendation.context.agentId,
    workflowId: recommendation.context.workflowId,
    recommendationType: recommendation.type,
    priority: recommendation.impact.priority,
    status: 'planned',
    steps: buildSteps(id, recommendation),
    evidence: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function startRecommendationExecution(executionId: string): RecommendationExecution {
  const state = readState();
  const execution = state.executions[executionId];
  if (!execution) throw new Error(`Cannot start missing recommendation execution: ${executionId}`);
  if (!['pending', 'planned', 'blocked'].includes(execution.status)) return clone(execution);
  const highRisk = isHighRiskRecommendation(execution.priority, execution.recommendationType);
  const steps = setStepStatus(
    execution.steps,
    highRisk ? ['Review recommendation evidence', 'Run governance preflight'] : ['Review recommendation evidence'],
    'completed',
  ).map((step) => step.name === 'Apply improvement action' ? { ...step, status: 'in_progress' as RecommendationExecutionStatus } : step);
  return persistExecution({
    ...execution,
    status: 'in_progress',
    steps,
    startedAt: execution.startedAt ?? nowIso(),
    blockedReason: undefined,
    updatedAt: nowIso(),
  });
}

export function completeRecommendationExecution(
  executionId: string,
  evidence: Omit<RecommendationExecutionEvidence, 'id' | 'executionId' | 'createdAt'>,
): RecommendationExecution {
  const state = readState();
  const execution = state.executions[executionId];
  if (!execution) throw new Error(`Cannot complete missing recommendation execution: ${executionId}`);
  const nextEvidence = evidenceFromInput(execution.id, evidence);
  const steps = setStepStatus(execution.steps, ['Apply improvement action', 'Capture execution evidence'], 'completed');
  return persistExecution({
    ...execution,
    status: 'completed',
    steps,
    evidence: [...execution.evidence, nextEvidence],
    completedAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export function failRecommendationExecution(executionId: string, reason: string): RecommendationExecution {
  const state = readState();
  const execution = state.executions[executionId];
  if (!execution) throw new Error(`Cannot fail missing recommendation execution: ${executionId}`);
  const updatedRecommendation = updateRecommendationConfidence(execution.recommendationId, -8);
  return persistExecution({
    ...execution,
    status: 'failed',
    failureReason: reason,
    impactResult: {
      executionId: execution.id,
      recommendationId: execution.recommendationId,
      status: 'regressed',
      confidenceBefore: execution.impactResult?.confidenceBefore ?? updatedRecommendation.confidence + 8,
      confidenceAfter: updatedRecommendation.confidence,
      scoreDelta: -4,
      verifiedAt: nowIso(),
    },
    updatedAt: nowIso(),
  });
}

export function cancelRecommendationExecution(executionId: string): RecommendationExecution {
  const state = readState();
  const execution = state.executions[executionId];
  if (!execution) throw new Error(`Cannot cancel missing recommendation execution: ${executionId}`);
  return persistExecution({
    ...execution,
    status: 'cancelled',
    updatedAt: nowIso(),
  });
}

export function verifyRecommendationImpact(executionId: string): RecommendationExecution {
  const state = readState();
  const execution = state.executions[executionId];
  if (!execution) throw new Error(`Cannot verify missing recommendation execution: ${executionId}`);
  if (execution.status !== 'completed' && execution.status !== 'verified') throw new Error(`Recommendation execution must be completed before verification: ${executionId}`);
  const recommendation = findRecommendation(execution.recommendationId);
  const before = recommendation?.confidence ?? 0;
  const outcome = createOutcomeVerification(execution.id);
  const scoreDelta = outcome.comparison?.overallDelta ?? (outcome.status === 'improved' ? 4 : 0);
  const confidenceDelta = outcome.status === 'improved' ? 7 : outcome.status === 'regressed' ? -8 : 1;
  const updatedRecommendation = updateRecommendationConfidence(execution.recommendationId, confidenceDelta);
  const impactResult: RecommendationImpactResult = {
    executionId,
    recommendationId: execution.recommendationId,
    status: outcome.status === 'improved' ? 'improved' : outcome.status === 'regressed' ? 'regressed' : outcome.status === 'unchanged' ? 'unchanged' : 'inconclusive',
    outcomeId: outcome.id,
    confidenceBefore: before,
    confidenceAfter: updatedRecommendation.confidence,
    scoreDelta,
    verifiedAt: nowIso(),
  };
  const steps = setStepStatus(execution.steps, ['Verify measurable impact'], 'verified');
  return persistExecution({
    ...execution,
    status: 'verified',
    steps,
    impactResult,
    verifiedAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export function linkRecommendationToActionPlan(recommendationId: string, actionPlanId: string): RecommendationExecution {
  const execution = getExecutionByRecommendationId(recommendationId) ?? createExecutionFromRecommendation(recommendationId);
  return persistExecution({
    ...execution,
    linkedActionPlanId: actionPlanId,
    updatedAt: nowIso(),
  });
}

export function getRecommendationExecutions(): RecommendationExecution[] {
  return Object.values(readState().executions).map(clone);
}

export function getExecutionByRecommendation(recommendationId: string): RecommendationExecution | undefined {
  const execution = getExecutionByRecommendationId(recommendationId);
  return execution ? clone(execution) : undefined;
}

export function getPendingRecommendationExecutions(): RecommendationExecution[] {
  return getRecommendationExecutions().filter((execution) => execution.status === 'pending' || execution.status === 'planned');
}

export function getCompletedRecommendationExecutions(): RecommendationExecution[] {
  return getRecommendationExecutions().filter((execution) => execution.status === 'completed');
}

export function getVerifiedRecommendationExecutions(): RecommendationExecution[] {
  return getRecommendationExecutions().filter((execution) => execution.status === 'verified');
}

export function getRecommendationImpactResult(executionId: string): RecommendationImpactResult | undefined {
  return readState().executions[executionId]?.impactResult;
}

export function getRecommendationExecutionSummary(): RecommendationExecutionSummary {
  const executions = getRecommendationExecutions();
  const verified = executions.filter((execution) => execution.status === 'verified');
  const confidenceTotal = verified.reduce((total, execution) => total + (execution.impactResult?.confidenceAfter ?? 0), 0);
  return {
    total: executions.length,
    pending: executions.filter((execution) => execution.status === 'pending' || execution.status === 'planned').length,
    inProgress: executions.filter((execution) => execution.status === 'in_progress').length,
    completed: executions.filter((execution) => execution.status === 'completed').length,
    verified: verified.length,
    failed: executions.filter((execution) => execution.status === 'failed').length,
    cancelled: executions.filter((execution) => execution.status === 'cancelled').length,
    blocked: executions.filter((execution) => execution.status === 'blocked').length,
    averageConfidenceAfter: verified.length ? Math.round(confidenceTotal / verified.length) : 0,
    generatedAt: nowIso(),
  };
}

export function exportRecommendationExecutionJson(): string {
  return JSON.stringify(getRecommendationExecutions(), null, 2);
}

export function exportRecommendationExecutionSummaryMarkdown(): string {
  const summary = getRecommendationExecutionSummary();
  return [
    '# Recommendation Execution Summary',
    '',
    `Total: ${summary.total}`,
    `Pending: ${summary.pending}`,
    `In progress: ${summary.inProgress}`,
    `Completed: ${summary.completed}`,
    `Verified: ${summary.verified}`,
    `Failed: ${summary.failed}`,
    `Cancelled: ${summary.cancelled}`,
    '',
  ].join('\n');
}

export function exportRecommendationImpactResultJson(executionId?: string): string {
  const results = getRecommendationExecutions()
    .filter((execution) => !executionId || execution.id === executionId)
    .map((execution) => execution.impactResult)
    .filter(Boolean);
  return JSON.stringify(results, null, 2);
}

export function exportRecommendationExecutionEvidenceMarkdown(): string {
  return [
    '# Recommendation Execution Evidence',
    '',
    ...getRecommendationExecutions().flatMap((execution) => execution.evidence.map((evidence) => `- ${execution.id}: ${evidence.title} - ${evidence.description}`)),
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
    contentSummary: `Recommendation execution export for ${runId}`,
    contentText,
    createdAt: nowIso(),
  };
}

export function generateRecommendationExecutionArtifacts(executionId?: string): ArtifactRecord[] {
  const runId = executionId ? readState().executions[executionId]?.runId ?? DEMO_RUN_ID : DEMO_RUN_ID;
  const exports = [
    exportArtifact(`artifact-${runId}-recommendation-execution-json`, runId, 'recommendation-execution.json', exportRecommendationExecutionJson(), 'json'),
    exportArtifact(`artifact-${runId}-recommendation-execution-summary-md`, runId, 'recommendation-execution-summary.md', exportRecommendationExecutionSummaryMarkdown(), 'markdown'),
    exportArtifact(`artifact-${runId}-recommendation-impact-result-json`, runId, 'recommendation-impact-result.json', exportRecommendationImpactResultJson(executionId), 'json'),
    exportArtifact(`artifact-${runId}-recommendation-execution-evidence-md`, runId, 'recommendation-execution-evidence.md', exportRecommendationExecutionEvidenceMarkdown(), 'markdown'),
  ];
  return exports.map((artifact) => registerArtifact(artifact, { type: 'EXPORT', metadata: { runId, tags: ['recommendation-execution', 'impact', 'export'] } }));
}

export function ensureAcceptedRecommendationExecution(): RecommendationExecution {
  const accepted = getRecommendations('accepted')[0] ?? markRecommendationAccepted(getRecommendations()[0].id);
  return getExecutionByRecommendation(accepted.id) ?? createExecutionFromRecommendation(accepted.id);
}

export function clearRecommendationExecutionStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(RECOMMENDATION_EXECUTION_STORAGE_KEY);
}
