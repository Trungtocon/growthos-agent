import type { RuntimeMode } from '../growthos-runtime/runtime-types';

export type HermesDiscoveryStatus = 'unknown' | 'missing_config' | 'offline' | 'degraded' | 'online';

export interface HermesCapability {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  source: 'mock' | 'sandbox' | 'normalized';
}

export interface HermesModelInfo {
  id: string;
  provider: string;
  name: string;
  contextWindow?: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsVision?: boolean;
}

export interface HermesToolInfo {
  id: string;
  name: string;
  description: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  enabled: boolean;
  categories: string[];
}

export interface HermesDiscoveryResult {
  status: HermesDiscoveryStatus;
  mode: RuntimeMode;
  baseUrl?: string;
  version?: string;
  serverTime?: string;
  capabilities: HermesCapability[];
  models: HermesModelInfo[];
  tools: HermesToolInfo[];
  warnings: string[];
  checkedAt: string;
}
