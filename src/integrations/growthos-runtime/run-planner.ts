import type { HermesCapabilityId } from '../hermes/capability-registry';
import { DEFAULT_WORKFLOW_REQUIREMENTS } from '../hermes/capability-registry';
import { getCapabilityRegistry } from '../../runtime-store/capability-registry-store';
import { getToolRegistry } from '../../runtime-store/tool-registry-store';
import { estimateRunPlanBudget, type ExecutionRiskLevel } from './execution-budget';

export type RunPlanStatus = 'draft' | 'ready' | 'blocked';
export type RunPlanStepStatus = 'planned' | 'blocked';

export interface RunPlanStep {
  id: string;
  order: number;
  name: string;
  capabilityId: HermesCapabilityId;
  toolId?: string;
  modelId?: string;
  status: RunPlanStepStatus;
  expectedOutputType: string;
  requiresApproval: boolean;
}

export interface RunPlan {
  id: string;
  ticketId: string;
  workflowId: string;
  status: RunPlanStatus;
  requiredCapabilities: HermesCapabilityId[];
  availableCapabilities: HermesCapabilityId[];
  missingCapabilities: HermesCapabilityId[];
  steps: RunPlanStep[];
  estimatedTools: number;
  estimatedArtifacts: number;
  estimatedApprovals: number;
  estimatedCost: number;
  estimatedDuration: number;
  estimatedRisk: ExecutionRiskLevel;
  warnings: string[];
  createdAt: string;
  approvedAt?: string;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function expectedOutputFor(capabilityId: string): string {
  if (capabilityId.includes('artifact')) return 'artifact';
  if (capabilityId.includes('approval')) return 'approval-gate';
  if (capabilityId.includes('research')) return 'context-summary';
  if (capabilityId.includes('planning')) return 'execution-plan';
  if (capabilityId.includes('deployment')) return 'deployment-check';
  return 'runtime-event';
}

function stepNameFor(capabilityId: string): string {
  const labels: Record<string, string> = {
    research: 'Gather ticket context',
    analysis: 'Analyze risk and quality signals',
    'artifact-generation': 'Produce Paperclip artifact',
    'approval-handling': 'Prepare approval gate',
    planning: 'Generate execution plan',
    execution: 'Execute planned run',
    deployment: 'Validate deployment readiness',
  };
  return labels[capabilityId] ?? `Run ${capabilityId}`;
}

export function createRunPlan(ticketId: string, workflowId = 'demo-run-execution'): RunPlan {
  const capabilityRegistry = getCapabilityRegistry();
  const toolRegistry = getToolRegistry();
  const requirement = DEFAULT_WORKFLOW_REQUIREMENTS.find((item) => item.workflowId === workflowId)
    ?? { workflowId, requiredCapabilities: ['research', 'planning', 'execution', 'artifact-generation'] };
  const availableCapabilities = capabilityRegistry.capabilities.map((capability) => capability.id);
  const missingCapabilities = requirement.requiredCapabilities.filter((capabilityId) => !availableCapabilities.includes(capabilityId));
  const warnings: string[] = [];

  const steps = requirement.requiredCapabilities.map((capabilityId, index): RunPlanStep => {
    const capability = capabilityRegistry.capabilities.find((item) => item.id === capabilityId);
    const toolId = capability?.requiredTools[0];
    const tool = toolId ? toolRegistry.tools.find((item) => item.id === toolId) : undefined;
    const compatibleModel = tool
      ? toolRegistry.compatibility.find((item) => item.toolId === tool.id && item.supported)?.modelId
      : undefined;
    const blocked = !capability || !tool || !compatibleModel;

    if (!capability) warnings.push(`Missing capability: ${capabilityId}`);
    else if (!tool) warnings.push(`Capability ${capabilityId} has no required tool.`);
    else if (!compatibleModel) warnings.push(`Tool ${tool.name} has no compatible model.`);

    return {
      id: `plan-step-${slug(workflowId)}-${index + 1}-${slug(String(capabilityId))}`,
      order: index + 1,
      name: stepNameFor(String(capabilityId)),
      capabilityId,
      toolId: tool?.id,
      modelId: compatibleModel,
      status: blocked ? 'blocked' : 'planned',
      expectedOutputType: expectedOutputFor(String(capabilityId)),
      requiresApproval: ['approval-handling', 'artifact-generation', 'execution', 'deployment'].includes(String(capabilityId)),
    };
  });

  const status: RunPlanStatus = missingCapabilities.length || steps.some((step) => step.status === 'blocked') ? 'blocked' : 'ready';
  const estimate = estimateRunPlanBudget({ id: `run-plan-${slug(ticketId)}-${slug(workflowId)}`, steps });

  return {
    id: `run-plan-${slug(ticketId)}-${slug(workflowId)}`,
    ticketId,
    workflowId,
    status,
    requiredCapabilities: requirement.requiredCapabilities,
    availableCapabilities,
    missingCapabilities,
    steps,
    estimatedTools: steps.filter((step) => Boolean(step.toolId)).length,
    estimatedArtifacts: steps.filter((step) => step.expectedOutputType === 'artifact').length,
    estimatedApprovals: steps.filter((step) => step.requiresApproval).length,
    estimatedCost: estimate.estimatedCost,
    estimatedDuration: estimate.estimatedDuration,
    estimatedRisk: estimate.riskLevel,
    warnings,
    createdAt: new Date().toISOString(),
  };
}
