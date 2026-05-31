import { mockHermesDiscovery } from '../integrations/hermes/hermes-discovery-client';
import type { HermesCapability, HermesDiscoveryResult, HermesDiscoveryStatus, HermesModelInfo, HermesToolInfo } from '../integrations/hermes/hermes-discovery-types';

const HERMES_DISCOVERY_STORAGE_KEY = 'uikigai-hermes-discovery-v1';

function fallbackDiscovery(): HermesDiscoveryResult {
  return mockHermesDiscovery('unknown', ['Hermes discovery has not been refreshed yet.']);
}

export function setHermesDiscovery(result: HermesDiscoveryResult): HermesDiscoveryResult {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(HERMES_DISCOVERY_STORAGE_KEY, JSON.stringify(result));
  }
  return result;
}

export function getHermesDiscovery(): HermesDiscoveryResult {
  if (typeof window === 'undefined') return fallbackDiscovery();
  try {
    const raw = window.sessionStorage.getItem(HERMES_DISCOVERY_STORAGE_KEY);
    if (!raw) return fallbackDiscovery();
    return JSON.parse(raw) as HermesDiscoveryResult;
  } catch {
    return fallbackDiscovery();
  }
}

export function clearHermesDiscovery() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(HERMES_DISCOVERY_STORAGE_KEY);
  }
}

export function getHermesDiscoveryStatus(): HermesDiscoveryStatus {
  return getHermesDiscovery().status;
}

export function getHermesTools(): HermesToolInfo[] {
  return getHermesDiscovery().tools;
}

export function getHermesModels(): HermesModelInfo[] {
  return getHermesDiscovery().models;
}

export function getHermesCapabilities(): HermesCapability[] {
  return getHermesDiscovery().capabilities;
}
