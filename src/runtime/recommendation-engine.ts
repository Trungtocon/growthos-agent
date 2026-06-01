import type { RunEvaluationDimension } from './run-evaluation';
import {
  recommendationId,
  type LearningSignal,
  type Recommendation,
  type RecommendationImpact,
  type RecommendationPriority,
  type RecommendationType,
} from './learning-memory';

function nowIso(): string {
  return new Date().toISOString();
}

function hasDimension(signal: LearningSignal, dimension: RunEvaluationDimension): boolean {
  return signal.targetDimensions.includes(dimension);
}

function recommendationTypeForSignal(signal: LearningSignal): RecommendationType {
  if (signal.type === 'improved_outcome') {
    if (hasDimension(signal, 'tool_success')) return 'use_tool';
    if (hasDimension(signal, 'artifact_quality')) return 'improve_artifact_quality';
    if (hasDimension(signal, 'cost_efficiency')) return 'reduce_cost';
    return 'change_workflow';
  }
  if (signal.type === 'regressed_outcome') {
    if (hasDimension(signal, 'governance_compliance')) return 'add_governance_rule';
    if (hasDimension(signal, 'approval_compliance')) return 'require_approval';
    if (hasDimension(signal, 'cost_efficiency')) return 'reduce_cost';
    if (hasDimension(signal, 'artifact_quality')) return 'improve_artifact_quality';
    if (hasDimension(signal, 'tool_success')) return 'avoid_tool';
    return 'rerun_with_constraints';
  }
  if (signal.type === 'governance_policy') return 'add_governance_rule';
  if (signal.type === 'approval_process') return 'require_approval';
  if (signal.type === 'cost_optimization') return 'reduce_cost';
  if (signal.type === 'tool_selection') return 'use_tool';
  if (signal.type === 'prompt_improvement') return 'adjust_prompt';
  return 'rerun_with_constraints';
}

function priorityForSignal(signal: LearningSignal, type: RecommendationType): RecommendationPriority {
  if (signal.type === 'regressed_outcome' && (type === 'add_governance_rule' || type === 'require_approval')) return 'critical';
  if (signal.type === 'regressed_outcome') return 'high';
  if (hasDimension(signal, 'cost_efficiency') || hasDimension(signal, 'governance_compliance')) return 'high';
  if (signal.type === 'improved_outcome') return 'medium';
  return 'low';
}

function impactForSignal(signal: LearningSignal, priority: RecommendationPriority): RecommendationImpact {
  const baseConfidence = signal.type === 'improved_outcome' ? 74 : signal.type === 'regressed_outcome' ? 68 : 52;
  const dimensionBoost = Math.min(12, signal.targetDimensions.length * 3);
  const confidence = Math.max(35, Math.min(96, Math.round(baseConfidence + dimensionBoost + signal.strength / 10)));
  return {
    confidence,
    priority,
    expectedScoreDelta: signal.type === 'regressed_outcome' ? 8 : 5,
    expectedCostDelta: hasDimension(signal, 'cost_efficiency') ? -12 : 0,
    riskReduction: priority === 'critical' ? 22 : priority === 'high' ? 14 : 6,
  };
}

function titleFor(type: RecommendationType): string {
  const titles: Record<RecommendationType, string> = {
    use_tool: 'Reuse proven tool path',
    avoid_tool: 'Avoid unstable tool path',
    adjust_prompt: 'Adjust prompt constraints',
    require_approval: 'Require approval gate',
    reduce_cost: 'Reduce execution cost',
    change_workflow: 'Change workflow sequence',
    add_governance_rule: 'Add governance rule',
    improve_artifact_quality: 'Improve artifact quality checks',
    rerun_with_constraints: 'Rerun with stronger constraints',
  };
  return titles[type];
}

function descriptionFor(type: RecommendationType, signal: LearningSignal): string {
  const dimensions = signal.targetDimensions.map((dimension) => dimension.replace(/_/g, ' ')).join(', ') || 'overall score';
  if (signal.type === 'improved_outcome') return `A verified improvement raised ${dimensions}; prefer this pattern for similar runs.`;
  if (signal.type === 'regressed_outcome') return `A verified regression affected ${dimensions}; add guardrails before repeating this workflow.`;
  return `Outcome evidence is limited for ${dimensions}; run again with explicit constraints and capture more evidence.`;
}

export function buildRecommendationFromSignal(signal: LearningSignal): Recommendation {
  const type = recommendationTypeForSignal(signal);
  const priority = priorityForSignal(signal, type);
  const impact = impactForSignal(signal, priority);
  const context = {
    runId: signal.runId,
    agentId: signal.agentId,
    workflowId: signal.workflowId,
    outcomeId: signal.outcomeId,
    dimensions: signal.targetDimensions,
  };
  const timestamp = nowIso();
  return {
    id: recommendationId(type, context),
    type,
    title: titleFor(type),
    description: descriptionFor(type, signal),
    context,
    status: 'proposed',
    confidence: impact.confidence,
    impact,
    evidence: [{
      id: `recommendation-evidence-${signal.id}`,
      signalId: signal.id,
      outcomeId: signal.outcomeId,
      title: 'Verified outcome signal',
      description: `${signal.sourceStatus} outcome produced a ${signal.type.replace(/_/g, ' ')} learning signal.`,
      createdAt: timestamp,
    }],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function calculateRecommendationConfidenceFromSignals(recommendation: Recommendation, signals: LearningSignal[]): number {
  const related = signals.filter((signal) => {
    const sameRun = !recommendation.context.runId || recommendation.context.runId === signal.runId;
    const sameAgent = !recommendation.context.agentId || recommendation.context.agentId === signal.agentId;
    const overlapsDimension = recommendation.context.dimensions.length === 0 || recommendation.context.dimensions.some((dimension) => signal.targetDimensions.includes(dimension));
    return sameRun && sameAgent && overlapsDimension;
  });
  const positive = related.filter((signal) => signal.type === 'improved_outcome').length;
  const regressions = related.filter((signal) => signal.type === 'regressed_outcome').length;
  const evidenceBoost = Math.min(18, related.length * 4 + positive * 3);
  const regressionPenalty = recommendation.type === 'avoid_tool' || recommendation.type === 'require_approval' || recommendation.type === 'add_governance_rule'
    ? 0
    : regressions * 3;
  return Math.max(20, Math.min(99, Math.round(recommendation.impact.confidence + evidenceBoost - regressionPenalty)));
}
