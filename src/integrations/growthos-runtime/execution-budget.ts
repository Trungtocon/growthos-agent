import type { RunPlan, RunPlanStep } from './run-planner';
import { getRunPlan } from '../../runtime-store/run-plan-store';
import { getToolRegistry } from '../../runtime-store/tool-registry-store';
import { getExecutionBudgetRegistry, upsertBudgetReport } from '../../runtime-store/execution-budget-store';
import { getPolicyValue } from '../../runtime/policy-inheritance-store';

export type ExecutionRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type BudgetPolicyStatus = 'allowed' | 'warning' | 'blocked';

export interface ToolCostProfile {
  toolId: string;
  modelId?: string;
  estimatedCost: number;
  estimatedTokens: number;
  estimatedDuration: number;
  riskLevel: ExecutionRiskLevel;
}

export interface ModelCostProfile {
  modelId: string;
  estimatedCost: number;
  estimatedTokens: number;
  estimatedDuration: number;
  riskLevel: ExecutionRiskLevel;
}

export interface ExecutionBudget {
  id: string;
  name: string;
  maxCost: number;
  warningCost: number;
  approvalCost: number;
  maxDuration: number;
  maxRiskLevel: ExecutionRiskLevel;
  currency: 'USD';
}

export interface ExecutionEstimate {
  planId?: string;
  estimatedCost: number;
  estimatedTokens: number;
  estimatedDuration: number;
  riskLevel: ExecutionRiskLevel;
  toolCosts: ToolCostProfile[];
  modelCosts: ModelCostProfile[];
}

export interface ExecutionBudgetRegistry {
  toolCosts: Record<string, ToolCostProfile>;
  modelCosts: Record<string, ModelCostProfile>;
  budget: ExecutionBudget;
  updatedAt: string;
}

export interface BudgetPolicyResult {
  policyId: string;
  targetId: string;
  passed: boolean;
  severity: 'warning' | 'blocking';
  message: string;
}

export interface ExecutionBudgetReport {
  planId: string;
  status: BudgetPolicyStatus;
  estimate: ExecutionEstimate;
  budget: ExecutionBudget;
  results: BudgetPolicyResult[];
  blockingReasons: string[];
  warnings: string[];
  approvalRequired: boolean;
  evaluatedAt: string;
}

const riskRank: Record<ExecutionRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function maxRisk(levels: ExecutionRiskLevel[]): ExecutionRiskLevel {
  return levels.reduce((highest, level) => (riskRank[level] > riskRank[highest] ? level : highest), 'low' as ExecutionRiskLevel);
}

function defaultRiskForToolText(text: string): ExecutionRiskLevel {
  const normalized = text.toLowerCase();
  if (normalized.includes('deployment') || normalized.includes('terminal') || normalized.includes('external')) return 'high';
  if (normalized.includes('approval') || normalized.includes('artifact')) return 'medium';
  return 'low';
}

function stepFallbackCost(step: RunPlanStep, index: number): ToolCostProfile {
  const riskLevel = defaultRiskForToolText(`${step.name} ${step.capabilityId} ${step.expectedOutputType}`);
  const baseCost = step.expectedOutputType === 'artifact' ? 0.018 : step.capabilityId === 'execution' ? 0.014 : 0.009;
  return {
    toolId: step.toolId ?? `unknown-${step.id}`,
    modelId: step.modelId,
    estimatedCost: Number((baseCost + index * 0.002).toFixed(3)),
    estimatedTokens: 900 + index * 420,
    estimatedDuration: 22 + index * 12,
    riskLevel,
  };
}

export function createDefaultExecutionBudgetRegistry(): ExecutionBudgetRegistry {
  const registry = getToolRegistry();
  const toolCosts = Object.fromEntries(registry.tools.map((tool, index) => {
    const riskLevel = defaultRiskForToolText(`${tool.name} ${tool.category} ${tool.description}`);
    const profile: ToolCostProfile = {
      toolId: tool.id,
      modelId: tool.supportedModels[0],
      estimatedCost: Number((0.008 + index * 0.006 + (tool.supportsArtifacts ? 0.008 : 0)).toFixed(3)),
      estimatedTokens: 1100 + index * 500 + (tool.supportsArtifacts ? 700 : 0),
      estimatedDuration: 24 + index * 15 + (tool.supportsArtifacts ? 20 : 0),
      riskLevel,
    };
    return [tool.id, profile];
  }));
  const modelCosts = Object.fromEntries(registry.models.map((model, index) => {
    const profile: ModelCostProfile = {
      modelId: model.id,
      estimatedCost: Number((0.004 + index * 0.003).toFixed(3)),
      estimatedTokens: 600 + index * 300,
      estimatedDuration: model.supportsStreaming ? 10 : 18,
      riskLevel: 'low',
    };
    return [model.id, profile];
  }));
  return {
    toolCosts,
    modelCosts,
    budget: {
      id: 'demo-runtime-budget',
      name: 'Demo runtime execution budget',
      maxCost: 0.12,
      warningCost: 0.08,
      approvalCost: 0.05,
      maxDuration: 220,
      maxRiskLevel: 'high',
      currency: 'USD',
    },
    updatedAt: new Date().toISOString(),
  };
}

export function estimateRunPlanBudget(plan: Pick<RunPlan, 'id' | 'steps'>): ExecutionEstimate {
  const registry = getExecutionBudgetRegistry();
  const toolCosts = plan.steps.map((step, index) => {
    const stored = step.toolId ? registry.toolCosts[step.toolId] : undefined;
    return stored ? { ...stored, modelId: step.modelId ?? stored.modelId } : stepFallbackCost(step, index);
  });
  const modelCosts = plan.steps
    .map((step) => step.modelId ? registry.modelCosts[step.modelId] : undefined)
    .filter((profile): profile is ModelCostProfile => Boolean(profile));
  const estimatedCost = Number((toolCosts.reduce((sum, profile) => sum + profile.estimatedCost, 0)
    + modelCosts.reduce((sum, profile) => sum + profile.estimatedCost, 0)).toFixed(3));
  const estimatedTokens = toolCosts.reduce((sum, profile) => sum + profile.estimatedTokens, 0)
    + modelCosts.reduce((sum, profile) => sum + profile.estimatedTokens, 0);
  const estimatedDuration = toolCosts.reduce((sum, profile) => sum + profile.estimatedDuration, 0)
    + modelCosts.reduce((sum, profile) => sum + profile.estimatedDuration, 0);
  return {
    planId: plan.id,
    estimatedCost,
    estimatedTokens,
    estimatedDuration,
    riskLevel: maxRisk([...toolCosts.map((profile) => profile.riskLevel), ...modelCosts.map((profile) => profile.riskLevel)]),
    toolCosts,
    modelCosts,
  };
}

function budgetResult(policyId: string, targetId: string, passed: boolean, severity: 'warning' | 'blocking', message: string): BudgetPolicyResult {
  return { policyId, targetId, passed, severity, message };
}

export function evaluateBudget(planId: string): ExecutionBudgetReport {
  const plan = getRunPlan(planId);
  if (!plan) {
    const registry = getExecutionBudgetRegistry();
    const estimate: ExecutionEstimate = { planId, estimatedCost: 0, estimatedTokens: 0, estimatedDuration: 0, riskLevel: 'critical', toolCosts: [], modelCosts: [] };
    const report: ExecutionBudgetReport = {
      planId,
      status: 'blocked',
      estimate,
      budget: registry.budget,
      results: [budgetResult('missing_plan_blocks_budget_evaluation', planId, false, 'blocking', `Cannot evaluate budget for missing plan ${planId}.`)],
      blockingReasons: [`Cannot evaluate budget for missing plan ${planId}.`],
      warnings: [],
      approvalRequired: false,
      evaluatedAt: new Date().toISOString(),
    };
    return upsertBudgetReport(report);
  }

  const registry = getExecutionBudgetRegistry();
  const estimate = estimateRunPlanBudget(plan);
  const inheritedMaxCost = getPolicyValue('budget', 'maxCost', registry.budget.maxCost);
  const budget = {
    ...registry.budget,
    maxCost: Math.min(registry.budget.maxCost, Number(inheritedMaxCost)),
  };
  const results: BudgetPolicyResult[] = [
    budgetResult(
      'budget_limit_exceeded',
      plan.id,
      estimate.estimatedCost <= budget.maxCost,
      'blocking',
      estimate.estimatedCost <= budget.maxCost ? 'Estimated cost is within budget.' : `Estimated cost $${estimate.estimatedCost.toFixed(3)} exceeds limit $${budget.maxCost.toFixed(3)}.`,
    ),
    budgetResult(
      'high_risk_execution',
      plan.id,
      riskRank[estimate.riskLevel] <= riskRank[budget.maxRiskLevel],
      'blocking',
      riskRank[estimate.riskLevel] <= riskRank[budget.maxRiskLevel] ? 'Execution risk is within allowed range.' : `Execution risk ${estimate.riskLevel} exceeds allowed ${budget.maxRiskLevel}.`,
    ),
    budgetResult(
      'expensive_model_requires_approval',
      plan.id,
      estimate.estimatedCost <= budget.approvalCost || plan.steps.some((step) => step.requiresApproval),
      'warning',
      estimate.estimatedCost <= budget.approvalCost ? 'No budget approval required.' : `Estimated cost $${estimate.estimatedCost.toFixed(3)} requires approval.`,
    ),
    budgetResult(
      'deployment_requires_budget_review',
      plan.id,
      !plan.workflowId.toLowerCase().includes('deployment') || plan.steps.some((step) => step.requiresApproval),
      'warning',
      plan.workflowId.toLowerCase().includes('deployment') ? 'Deployment plan requires budget review.' : 'No deployment budget review required.',
    ),
  ];
  const failed = results.filter((result) => !result.passed);
  const blockingReasons = failed.filter((result) => result.severity === 'blocking').map((result) => result.message);
  const warnings = failed.filter((result) => result.severity === 'warning').map((result) => result.message);
  const report: ExecutionBudgetReport = {
    planId: plan.id,
    status: blockingReasons.length ? 'blocked' : warnings.length ? 'warning' : 'allowed',
    estimate,
    budget,
    results,
    blockingReasons,
    warnings,
    approvalRequired: estimate.estimatedCost > budget.approvalCost || riskRank[estimate.riskLevel] >= riskRank.high,
    evaluatedAt: new Date().toISOString(),
  };
  return upsertBudgetReport(report);
}
