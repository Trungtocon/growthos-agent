import {
  DEFAULT_WORKFLOW_REQUIREMENTS,
  buildCapabilityRegistry,
  getWorkflowReadinessMatrix,
  isWorkflowReady,
  type CapabilityRegistry,
  type HermesCapability,
  type WorkflowReadiness,
  type WorkflowRequirement,
} from '../integrations/hermes/capability-registry';
import { getToolRegistry } from './tool-registry-store';

const CAPABILITY_REGISTRY_STORAGE_KEY = 'uikigai-hermes-capability-registry-v1';

function fallbackCapabilityRegistry(): CapabilityRegistry {
  return buildCapabilityRegistry(getToolRegistry());
}

function isStale(registry: CapabilityRegistry): boolean {
  return registry.sourceToolRegistryGeneratedAt !== getToolRegistry().generatedAt;
}

export function setCapabilityRegistry(registry: CapabilityRegistry): CapabilityRegistry {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(CAPABILITY_REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  }
  return registry;
}

export function refreshCapabilityRegistryFromToolRegistry(): CapabilityRegistry {
  return setCapabilityRegistry(buildCapabilityRegistry(getToolRegistry()));
}

export function getCapabilityRegistry(): CapabilityRegistry {
  if (typeof window === 'undefined') return fallbackCapabilityRegistry();
  try {
    const raw = window.sessionStorage.getItem(CAPABILITY_REGISTRY_STORAGE_KEY);
    if (!raw) return refreshCapabilityRegistryFromToolRegistry();
    const registry = JSON.parse(raw) as CapabilityRegistry;
    return registry.capabilities.length && !isStale(registry) ? registry : refreshCapabilityRegistryFromToolRegistry();
  } catch {
    return refreshCapabilityRegistryFromToolRegistry();
  }
}

export function clearCapabilityRegistry() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(CAPABILITY_REGISTRY_STORAGE_KEY);
  }
}

export function getCapabilities(): HermesCapability[] {
  return getCapabilityRegistry().capabilities;
}

export function getWorkflowReadiness(
  workflowId = 'demo-run-execution',
  requirements: WorkflowRequirement[] = DEFAULT_WORKFLOW_REQUIREMENTS,
): WorkflowReadiness {
  const registry = getCapabilityRegistry();
  const requirement = requirements.find((item) => item.workflowId === workflowId)
    ?? { workflowId, requiredCapabilities: [] };
  return isWorkflowReady(requirement, registry);
}

export function getWorkflowReadinessByRequirement(requirement: WorkflowRequirement): WorkflowReadiness {
  return isWorkflowReady(requirement, getCapabilityRegistry());
}

export function getWorkflowReadinessRows(requirements: WorkflowRequirement[] = DEFAULT_WORKFLOW_REQUIREMENTS): WorkflowReadiness[] {
  return getWorkflowReadinessMatrix(getCapabilityRegistry(), requirements);
}

export function getMissingCapabilities(workflowId = 'demo-run-execution'): string[] {
  return getWorkflowReadiness(workflowId).missingCapabilities;
}
