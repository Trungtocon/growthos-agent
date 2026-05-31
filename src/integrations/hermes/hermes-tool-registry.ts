import type { HermesCapability, HermesDiscoveryResult, HermesModelInfo, HermesToolInfo } from './hermes-discovery-types';
import { mockHermesDiscovery } from './hermes-discovery-client';

export interface HermesTool {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  supportsStreaming: boolean;
  supportsArtifacts: boolean;
  supportsApproval: boolean;
  supportedModels: string[];
  capabilityRequirements: string[];
}

export interface ToolCompatibility {
  toolId: string;
  modelId: string;
  supported: boolean;
  reason: string;
}

export interface HermesToolRegistry {
  tools: HermesTool[];
  capabilities: HermesCapability[];
  models: HermesModelInfo[];
  compatibility: ToolCompatibility[];
  generatedAt: string;
}

function primaryCategory(tool: HermesToolInfo): string {
  return tool.categories[0] ?? 'runtime';
}

function capabilityIds(capabilities: HermesCapability[]): string[] {
  return capabilities.filter((capability) => capability.enabled).map((capability) => capability.id);
}

function inferRequirements(tool: HermesToolInfo, capabilities: HermesCapability[]): string[] {
  const enabledCapabilities = capabilityIds(capabilities);
  const categories = tool.categories.map((category) => category.toLowerCase());
  return enabledCapabilities.filter((capability) => {
    const normalized = capability.toLowerCase();
    return categories.some((category) => normalized.includes(category) || category.includes(normalized))
      || (categories.includes('artifact') && normalized.includes('artifact'))
      || (categories.includes('paperclip') && normalized.includes('artifact'))
      || (categories.includes('runtime') && normalized.includes('task'));
  });
}

function mapTool(tool: HermesToolInfo, models: HermesModelInfo[], capabilities: HermesCapability[]): HermesTool {
  const categories = tool.categories.map((category) => category.toLowerCase());
  const supportsArtifacts = categories.some((category) => ['artifact', 'paperclip', 'report'].includes(category));
  const supportsApproval = categories.some((category) => ['approval', 'governance', 'policy', 'runtime'].includes(category));
  const supportsStreaming = categories.some((category) => ['streaming', 'runtime', 'planning', 'knowledge', 'artifact'].includes(category));
  return {
    id: tool.id,
    name: tool.name,
    category: primaryCategory(tool),
    description: tool.description,
    enabled: tool.enabled,
    supportsStreaming,
    supportsArtifacts,
    supportsApproval,
    supportedModels: models.filter((model) => model.supportsTools).map((model) => model.id),
    capabilityRequirements: inferRequirements(tool, capabilities),
  };
}

function compatibilityForTool(tool: HermesTool, model: HermesModelInfo): ToolCompatibility {
  if (!tool.enabled) {
    return { toolId: tool.id, modelId: model.id, supported: false, reason: 'Tool disabled by Hermes discovery.' };
  }
  if (!model.supportsTools) {
    return { toolId: tool.id, modelId: model.id, supported: false, reason: 'Model does not support tool calls.' };
  }
  if (tool.supportsStreaming && !model.supportsStreaming) {
    return { toolId: tool.id, modelId: model.id, supported: false, reason: 'Model does not support streaming execution.' };
  }
  return { toolId: tool.id, modelId: model.id, supported: true, reason: 'Supported by discovered Hermes capabilities.' };
}

export function buildHermesToolRegistry(discovery: HermesDiscoveryResult): HermesToolRegistry {
  const fallback = mockHermesDiscovery('degraded', ['Hermes discovery returned no tools; using mock registry fallback.']);
  const sourceTools = discovery.tools.length ? discovery.tools : fallback.tools;
  const sourceModels = discovery.models.length ? discovery.models : fallback.models;
  const sourceCapabilities = discovery.capabilities.length ? discovery.capabilities : fallback.capabilities;
  const tools = sourceTools.map((tool) => mapTool(tool, sourceModels, sourceCapabilities));
  const compatibility = tools.flatMap((tool) => sourceModels.map((model) => compatibilityForTool(tool, model)));
  return {
    tools,
    capabilities: sourceCapabilities,
    models: sourceModels,
    compatibility,
    generatedAt: discovery.checkedAt,
  };
}

export function canToolRunOnModel(registry: HermesToolRegistry, toolId: string, modelId: string): ToolCompatibility {
  return registry.compatibility.find((item) => item.toolId === toolId && item.modelId === modelId)
    ?? { toolId, modelId, supported: false, reason: 'No compatibility entry found.' };
}

export function getDefaultRuntimeTools(registry: HermesToolRegistry, count = 3): HermesTool[] {
  const streamingTools = registry.tools.filter((tool) => tool.enabled && tool.supportsStreaming);
  return (streamingTools.length ? streamingTools : registry.tools.filter((tool) => tool.enabled)).slice(0, count);
}
