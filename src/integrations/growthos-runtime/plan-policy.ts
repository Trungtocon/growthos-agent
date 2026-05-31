import type { RunPlan, RunPlanStep } from './run-planner';
import { getRunPlan } from '../../runtime-store/run-plan-store';
import { getToolRegistry } from '../../runtime-store/tool-registry-store';
import { evaluateBudget, type ExecutionBudgetReport, type ExecutionEstimate } from './execution-budget';
import { getPolicyValue } from '../../runtime/policy-inheritance-store';

export type PlanPolicySeverity = 'info' | 'warning' | 'blocking';
export type PlanPolicyTarget = 'plan' | 'step' | 'tool' | 'artifact' | 'approval';
export type PlanPolicyStatus = 'allowed' | 'warning' | 'blocked';

export interface PlanPolicy {
  id: string;
  name: string;
  description: string;
  severity: PlanPolicySeverity;
  appliesTo: PlanPolicyTarget;
  condition: string;
  message: string;
}

export interface PlanPolicyResult {
  policyId: string;
  targetId: string;
  passed: boolean;
  severity: PlanPolicySeverity;
  message: string;
}

export interface PlanExecutionPolicyReport {
  planId: string;
  status: PlanPolicyStatus;
  results: PlanPolicyResult[];
  blockingReasons: string[];
  warnings: string[];
  approvalRequiredSteps: string[];
  budgetStatus?: ExecutionBudgetReport['status'];
  executionEstimate?: ExecutionEstimate;
  evaluatedAt: string;
}

export const DEFAULT_PLAN_POLICIES: PlanPolicy[] = [
  {
    id: 'missing_capability_blocks_execution',
    name: 'Missing capability blocks execution',
    description: 'A plan cannot start if required capabilities are unavailable.',
    severity: 'blocking',
    appliesTo: 'plan',
    condition: 'plan.missingCapabilities.length === 0',
    message: 'Plan has missing capabilities.',
  },
  {
    id: 'incompatible_tool_model_blocks_step',
    name: 'Incompatible tool/model blocks step',
    description: 'Every planned step with a tool must have a compatible model.',
    severity: 'blocking',
    appliesTo: 'step',
    condition: 'tool compatibility must be supported',
    message: 'Step tool/model compatibility is not supported.',
  },
  {
    id: 'approval_required_for_artifact_generation',
    name: 'Approval required for artifact generation',
    description: 'Artifact-producing plan steps must open a human approval gate.',
    severity: 'warning',
    appliesTo: 'artifact',
    condition: 'artifact steps require approval',
    message: 'Artifact generation requires a human approval gate before external execution.',
  },
  {
    id: 'approval_required_for_external_action',
    name: 'Approval required for external action',
    description: 'Execution or deployment steps with external side effects require approval.',
    severity: 'warning',
    appliesTo: 'approval',
    condition: 'external action steps require approval',
    message: 'External runtime action requires approval before execution.',
  },
  {
    id: 'deployment_capability_required_for_deployment',
    name: 'Deployment capability required',
    description: 'Deployment workflows require the deployment capability.',
    severity: 'blocking',
    appliesTo: 'plan',
    condition: 'deployment workflow has deployment capability available',
    message: 'Deployment workflow is missing a deployment capability.',
  },
  {
    id: 'unknown_tool_requires_review',
    name: 'Unknown tool requires review',
    description: 'Plan steps without a registered Hermes tool require operator review.',
    severity: 'warning',
    appliesTo: 'tool',
    condition: 'step.toolId is registered',
    message: 'Step uses an unknown or unregistered tool.',
  },
  {
    id: 'high_risk_tool_requires_approval',
    name: 'High risk tool requires approval',
    description: 'High-risk tools must be guarded by an approval step.',
    severity: 'warning',
    appliesTo: 'tool',
    condition: 'high-risk tools require step.requiresApproval',
    message: 'High-risk tool requires approval before execution.',
  },
  {
    id: 'budget_limit_exceeded',
    name: 'Budget limit exceeded',
    description: 'A plan cannot start if estimated cost exceeds the execution budget.',
    severity: 'blocking',
    appliesTo: 'plan',
    condition: 'estimate.estimatedCost <= budget.maxCost',
    message: 'Estimated execution cost exceeds the configured budget.',
  },
  {
    id: 'high_risk_execution',
    name: 'High risk execution',
    description: 'A plan cannot start if estimated risk exceeds the budget risk threshold.',
    severity: 'blocking',
    appliesTo: 'plan',
    condition: 'estimate.riskLevel <= budget.maxRiskLevel',
    message: 'Estimated execution risk exceeds the configured risk threshold.',
  },
  {
    id: 'expensive_model_requires_approval',
    name: 'Expensive model requires approval',
    description: 'Expensive execution plans must be approval gated.',
    severity: 'warning',
    appliesTo: 'approval',
    condition: 'estimate.estimatedCost <= budget.approvalCost || approval gate exists',
    message: 'Estimated execution cost requires approval.',
  },
  {
    id: 'deployment_requires_budget_review',
    name: 'Deployment requires budget review',
    description: 'Deployment workflows require budget review before execution.',
    severity: 'warning',
    appliesTo: 'approval',
    condition: 'deployment workflow has budget review',
    message: 'Deployment execution requires budget review.',
  },
];

function result(policyId: string, targetId: string, passed: boolean, severity: PlanPolicySeverity, message: string): PlanPolicyResult {
  return { policyId, targetId, passed, severity, message };
}

function isArtifactStep(step: RunPlanStep): boolean {
  return step.expectedOutputType === 'artifact' || step.capabilityId === 'artifact-generation';
}

function isExternalStep(step: RunPlanStep): boolean {
  const text = `${step.capabilityId} ${step.expectedOutputType} ${step.name}`.toLowerCase();
  return text.includes('deployment') || text.includes('external') || text.includes('execute');
}

function stepToolRisk(step: RunPlanStep): boolean {
  const registry = getToolRegistry();
  const tool = step.toolId ? registry.tools.find((item) => item.id === step.toolId) : undefined;
  const text = `${tool?.category ?? ''} ${tool?.name ?? ''} ${tool?.description ?? ''} ${step.capabilityId}`.toLowerCase();
  return text.includes('deployment') || text.includes('terminal') || text.includes('external') || text.includes('approval');
}

function stepCompatibilitySupported(step: RunPlanStep): boolean {
  if (step.status === 'blocked') return false;
  if (!step.toolId || !step.modelId) return false;
  const registry = getToolRegistry();
  if (!registry.tools.some((tool) => tool.id === step.toolId)) return true;
  const compatibility = registry.compatibility.find((item) => item.toolId === step.toolId && item.modelId === step.modelId);
  return compatibility?.supported === true;
}

export function getApprovalRequiredSteps(plan: RunPlan): RunPlanStep[] {
  const artifactRequiresApproval = getPolicyValue('approval', 'artifactRequiresApproval', true);
  return plan.steps.filter((step) => step.requiresApproval || (artifactRequiresApproval && isArtifactStep(step)) || isExternalStep(step) || stepToolRisk(step));
}

export function evaluateStepPolicy(planId: string, stepId: string): PlanPolicyResult[] {
  const plan = getRunPlan(planId);
  const step = plan?.steps.find((item) => item.id === stepId);
  if (!plan || !step) {
    return [result('missing_step_blocks_evaluation', stepId, false, 'blocking', `Cannot evaluate missing plan step ${stepId}.`)];
  }

  const registry = getToolRegistry();
  const registeredTool = step.toolId ? registry.tools.find((tool) => tool.id === step.toolId) : undefined;
  const results: PlanPolicyResult[] = [
    result(
      'incompatible_tool_model_blocks_step',
      step.id,
      stepCompatibilitySupported(step),
      'blocking',
      stepCompatibilitySupported(step) ? 'Tool/model compatibility is supported.' : `Step ${step.name} has no compatible tool/model mapping.`,
    ),
    result(
      'unknown_tool_requires_review',
      step.id,
      Boolean(registeredTool),
      'warning',
      registeredTool ? 'Tool is registered.' : `Step ${step.name} requires operator review because its tool is unknown.`,
    ),
  ];

  if (isArtifactStep(step)) {
    results.push(result(
      'approval_required_for_artifact_generation',
      step.id,
      step.requiresApproval,
      'warning',
      step.requiresApproval ? `Artifact step ${step.name} is approval gated.` : `Artifact step ${step.name} needs an approval gate.`,
    ));
  }

  if (isExternalStep(step)) {
    results.push(result(
      'approval_required_for_external_action',
      step.id,
      step.requiresApproval,
      'warning',
      step.requiresApproval ? `External action step ${step.name} is approval gated.` : `External action step ${step.name} needs an approval gate.`,
    ));
  }

  if (stepToolRisk(step)) {
    results.push(result(
      'high_risk_tool_requires_approval',
      step.id,
      step.requiresApproval,
      'warning',
      step.requiresApproval ? `High-risk step ${step.name} is approval gated.` : `High-risk step ${step.name} needs approval before execution.`,
    ));
  }

  return results;
}

export function evaluatePlanObjectPolicy(plan: RunPlan): PlanExecutionPolicyReport {
  const planResults: PlanPolicyResult[] = [
    result(
      'missing_capability_blocks_execution',
      plan.id,
      plan.missingCapabilities.length === 0,
      'blocking',
      plan.missingCapabilities.length ? `Missing capabilities: ${plan.missingCapabilities.join(', ')}` : 'All required capabilities are available.',
    ),
    result(
      'deployment_capability_required_for_deployment',
      plan.id,
      !plan.workflowId.toLowerCase().includes('deployment')
        || (plan.requiredCapabilities.includes('deployment') && plan.availableCapabilities.includes('deployment')),
      'blocking',
      plan.workflowId.toLowerCase().includes('deployment') ? 'Deployment workflow requires deployment capability.' : 'No deployment capability required.',
    ),
  ];

  const stepResults = plan.steps.flatMap((step) => evaluateStepPolicy(plan.id, step.id));
  const budgetReport = evaluateBudget(plan.id);
  const budgetResults = budgetReport.results.map((item): PlanPolicyResult => ({
    policyId: item.policyId,
    targetId: item.targetId,
    passed: item.passed,
    severity: item.severity,
    message: item.message,
  }));
  const results = [...planResults, ...stepResults, ...budgetResults];
  const failed = results.filter((item) => !item.passed);
  const blockingReasons = failed.filter((item) => item.severity === 'blocking').map((item) => item.message);
  const warnings = [
    ...plan.warnings,
    ...failed.filter((item) => item.severity === 'warning').map((item) => item.message),
  ];
  const approvalRequiredSteps = getApprovalRequiredSteps(plan).map((step) => step.id);

  return {
    planId: plan.id,
    status: blockingReasons.length ? 'blocked' : warnings.length ? 'warning' : 'allowed',
    results,
    blockingReasons,
    warnings,
    approvalRequiredSteps,
    budgetStatus: budgetReport.status,
    executionEstimate: budgetReport.estimate,
    evaluatedAt: new Date().toISOString(),
  };
}

export function evaluatePlanPolicy(planId: string): PlanExecutionPolicyReport {
  const plan = getRunPlan(planId);
  if (!plan) {
    return {
      planId,
      status: 'blocked',
      results: [result('missing_plan_blocks_execution', planId, false, 'blocking', `Cannot evaluate missing run plan ${planId}.`)],
      blockingReasons: [`Cannot evaluate missing run plan ${planId}.`],
      warnings: [],
      approvalRequiredSteps: [],
      evaluatedAt: new Date().toISOString(),
    };
  }
  return evaluatePlanObjectPolicy(plan);
}

export function canStartPlan(planId: string): { canStart: boolean; report: PlanExecutionPolicyReport } {
  const report = evaluatePlanPolicy(planId);
  return { canStart: report.status !== 'blocked', report };
}
