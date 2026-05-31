import { mockHermesDiscovery } from '../integrations/hermes/hermes-discovery-client';
import { buildHermesToolRegistry, canToolRunOnModel, type HermesTool, type HermesToolRegistry, type ToolCompatibility } from '../integrations/hermes/hermes-tool-registry';
import type { HermesCapability, HermesModelInfo } from '../integrations/hermes/hermes-discovery-types';
import { getHermesDiscovery } from './hermes-discovery-store';

const TOOL_REGISTRY_STORAGE_KEY = 'uikigai-hermes-tool-registry-v1';

function fallbackRegistry(): HermesToolRegistry {
  return buildHermesToolRegistry(getHermesDiscovery() ?? mockHermesDiscovery('unknown'));
}

export function setToolRegistry(registry: HermesToolRegistry): HermesToolRegistry {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(TOOL_REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  }
  return registry;
}

export function refreshToolRegistryFromDiscovery(): HermesToolRegistry {
  return setToolRegistry(buildHermesToolRegistry(getHermesDiscovery()));
}

export function getToolRegistry(): HermesToolRegistry {
  if (typeof window === 'undefined') return fallbackRegistry();
  try {
    const raw = window.sessionStorage.getItem(TOOL_REGISTRY_STORAGE_KEY);
    if (!raw) return refreshToolRegistryFromDiscovery();
    const registry = JSON.parse(raw) as HermesToolRegistry;
    return registry.tools.length ? registry : refreshToolRegistryFromDiscovery();
  } catch {
    return refreshToolRegistryFromDiscovery();
  }
}

export function clearToolRegistry() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(TOOL_REGISTRY_STORAGE_KEY);
  }
}

export function getRegisteredTools(): HermesTool[] {
  return getToolRegistry().tools;
}

export function getRegisteredCapabilities(): HermesCapability[] {
  return getToolRegistry().capabilities;
}

export function getRegisteredModels(): HermesModelInfo[] {
  return getToolRegistry().models;
}

export function getToolCompatibilityMatrix(): ToolCompatibility[] {
  return getToolRegistry().compatibility;
}

export function getToolCompatibility(toolId: string, modelId: string): ToolCompatibility {
  return canToolRunOnModel(getToolRegistry(), toolId, modelId);
}
