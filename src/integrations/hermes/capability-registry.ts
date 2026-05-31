import type { HermesToolRegistry } from './hermes-tool-registry';

export type HermesCapabilityId =
  | 'research'
  | 'analysis'
  | 'artifact-generation'
  | 'approval-handling'
  | 'planning'
  | 'execution'
  | 'deployment'
  | string;

export interface HermesCapability {
  id: HermesCapabilityId;
  name: string;
  description: string;
  requiredTools: string[];
  optionalTools: string[];
  supportedModels: string[];
}

export interface CapabilityRegistry {
  capabilities: HermesCapability[];
  generatedAt: string;
  sourceToolRegistryGeneratedAt: string;
}

export interface WorkflowRequirement {
  workflowId: string;
  requiredCapabilities: HermesCapabilityId[];
}

export interface WorkflowReadiness {
  workflowId: string;
  requiredCapabilities: HermesCapabilityId[];
  availableCapabilities: HermesCapabilityId[];
  missingCapabilities: HermesCapabilityId[];
  ready: boolean;
}

interface CapabilityDefinition {
  id: HermesCapabilityId;
  name: string;
  description: string;
  requiredMatcher: (tool: RegistryTool) => boolean;
  optionalMatcher?: (tool: RegistryTool) => boolean;
}

type RegistryTool = HermesToolRegistry['tools'][number];

export const DEFAULT_WORKFLOW_REQUIREMENTS: WorkflowRequirement[] = [
  {
    workflowId: 'demo-run-execution',
    requiredCapabilities: ['research', 'planning', 'execution', 'artifact-generation'],
  },
  {
    workflowId: 'approval-gated-artifact',
    requiredCapabilities: ['planning', 'execution', 'artifact-generation', 'approval-handling'],
  },
  {
    workflowId: 'deployment-readiness',
    requiredCapabilities: ['planning', 'execution', 'deployment'],
  },
];

const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  {
    id: 'research',
    name: 'Research',
    description: 'Can gather workspace, policy, ticket, and knowledge context before execution.',
    requiredMatcher: (tool) => matchesTool(tool, ['research', 'knowledge', 'search']),
  },
  {
    id: 'analysis',
    name: 'Analysis',
    description: 'Can inspect results, risks, quality signals, or run diagnostics.',
    requiredMatcher: (tool) => matchesTool(tool, ['analysis', 'inspect', 'diagnostic', 'quality', 'risk']),
    optionalMatcher: (tool) => matchesTool(tool, ['knowledge', 'runtime']),
  },
  {
    id: 'artifact-generation',
    name: 'Artifact Generation',
    description: 'Can produce Paperclip-compatible outputs, reports, patches, or run artifacts.',
    requiredMatcher: (tool) => tool.supportsArtifacts || matchesTool(tool, ['artifact', 'paperclip', 'report', 'patch']),
  },
  {
    id: 'approval-handling',
    name: 'Approval Handling',
    description: 'Can request and reconcile human approval gates for risky workflow steps.',
    requiredMatcher: (tool) => tool.supportsApproval || matchesTool(tool, ['approval', 'governance', 'policy']),
    optionalMatcher: (tool) => matchesTool(tool, ['runtime']),
  },
  {
    id: 'planning',
    name: 'Planning',
    description: 'Can create execution plans or decompose ticket context into ordered work.',
    requiredMatcher: (tool) => matchesTool(tool, ['planning', 'plan']),
  },
  {
    id: 'execution',
    name: 'Execution',
    description: 'Can execute workflow steps, stream progress, and drive runtime tasks.',
    requiredMatcher: (tool) => tool.supportsStreaming || matchesTool(tool, ['runtime', 'execution', 'task']),
  },
  {
    id: 'deployment',
    name: 'Deployment',
    description: 'Can prepare or trigger deploy/release-oriented workflow stages.',
    requiredMatcher: (tool) => matchesTool(tool, ['deployment', 'deploy', 'release', 'ship']),
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchesTool(tool: RegistryTool, keywords: string[]): boolean {
  const haystack = [
    tool.id,
    tool.name,
    tool.category,
    tool.description,
    ...tool.capabilityRequirements,
  ].map(normalize).join(' ');
  return keywords.some((keyword) => haystack.includes(normalize(keyword)));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function supportedModelsFor(requiredTools: RegistryTool[]): string[] {
  if (requiredTools.length === 0) return [];
  const modelSets = requiredTools.map((tool) => new Set(tool.supportedModels));
  const [first, ...rest] = modelSets;
  return Array.from(first).filter((modelId) => rest.every((models) => models.has(modelId)));
}

function capabilityFromDefinition(definition: CapabilityDefinition, tools: RegistryTool[]): HermesCapability | undefined {
  const enabledTools = tools.filter((tool) => tool.enabled);
  const requiredTools = enabledTools.filter(definition.requiredMatcher);
  if (requiredTools.length === 0) return undefined;

  const optionalTools = enabledTools.filter((tool) => {
    if (requiredTools.some((required) => required.id === tool.id)) return false;
    return definition.optionalMatcher?.(tool) ?? false;
  });

  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    requiredTools: requiredTools.map((tool) => tool.id),
    optionalTools: optionalTools.map((tool) => tool.id),
    supportedModels: supportedModelsFor(requiredTools),
  };
}

export function buildCapabilityRegistry(toolRegistry: HermesToolRegistry): CapabilityRegistry {
  return {
    capabilities: CAPABILITY_DEFINITIONS
      .map((definition) => capabilityFromDefinition(definition, toolRegistry.tools))
      .filter((capability): capability is HermesCapability => Boolean(capability)),
    generatedAt: new Date().toISOString(),
    sourceToolRegistryGeneratedAt: toolRegistry.generatedAt,
  };
}

export function isWorkflowReady(requirement: WorkflowRequirement, registry: CapabilityRegistry): WorkflowReadiness {
  const availableCapabilities = registry.capabilities.map((capability) => capability.id);
  const missingCapabilities = requirement.requiredCapabilities.filter((capabilityId) => !availableCapabilities.includes(capabilityId));
  return {
    workflowId: requirement.workflowId,
    requiredCapabilities: requirement.requiredCapabilities,
    availableCapabilities,
    missingCapabilities,
    ready: missingCapabilities.length === 0,
  };
}

export function getWorkflowReadinessMatrix(
  registry: CapabilityRegistry,
  requirements: WorkflowRequirement[] = DEFAULT_WORKFLOW_REQUIREMENTS,
): WorkflowReadiness[] {
  return requirements.map((requirement) => isWorkflowReady(requirement, registry));
}

export function getCapabilityById(registry: CapabilityRegistry, capabilityId: string): HermesCapability | undefined {
  return registry.capabilities.find((capability) => capability.id === capabilityId);
}

export function getToolIdsForCapabilities(registry: CapabilityRegistry, capabilityIds: HermesCapabilityId[]): string[] {
  return unique(registry.capabilities
    .filter((capability) => capabilityIds.includes(capability.id))
    .flatMap((capability) => [...capability.requiredTools, ...capability.optionalTools]));
}
