import type { ArtifactRecord } from './artifact-registry';

export type BackendAdapterMode = 'mock' | 'sandbox' | 'production';

export type BackendStatus =
  | 'online'
  | 'degraded'
  | 'offline'
  | 'missing_config'
  | 'auth_failed'
  | 'blocked_by_governance'
  | 'blocked_by_deployment_config'
  | 'blocked_by_certification';

export type BackendEndpointKind = 'runtime' | 'hermes' | 'paperclip' | 'artifact' | 'governance' | 'worker' | 'gateway';

export interface BackendNormalizedError {
  code: string;
  message: string;
  retryable: boolean;
  normalized: true;
  source: BackendEndpointKind;
}

export interface BackendEndpointCapability {
  kind: BackendEndpointKind;
  label: string;
  path: string;
  supportsSandbox: boolean;
  supportsProduction: boolean;
  status: BackendStatus;
  lastCheckedAt?: string;
  reason: string;
}

export interface BackendRequestLog {
  id: string;
  mode: BackendAdapterMode;
  endpoint: BackendEndpointKind;
  path: string;
  status: BackendStatus;
  attempt: number;
  durationMs: number;
  fallbackUsed: boolean;
  createdAt: string;
  error?: BackendNormalizedError;
}

export interface BackendGatewayOptions {
  mode?: BackendAdapterMode;
  path?: string;
  payload?: unknown;
  authToken?: string;
  timeoutMs?: number;
  retries?: number;
}

export interface BackendGatewayResult {
  id: string;
  mode: BackendAdapterMode;
  endpoint: BackendEndpointKind;
  path: string;
  status: BackendStatus;
  durationMs: number;
  fallbackUsed: boolean;
  data?: unknown;
  error?: BackendNormalizedError;
  createdAt: string;
}

export interface BackendAdapterBlocker {
  id: string;
  code: BackendStatus | 'production_gate_not_ready';
  reason: string;
  recommendedFix: string;
  createdAt: string;
}

export interface BackendAdapterWarning {
  id: string;
  code: 'mock_fallback_active' | 'sandbox_only' | 'retry_used' | 'degraded_fallback';
  reason: string;
  recommendedFix: string;
  createdAt: string;
}

export interface BackendAdapterHealth {
  status: BackendStatus;
  mode: BackendAdapterMode;
  checkedAt?: string;
  summary: string;
}

export interface BackendAdapterState {
  mode: BackendAdapterMode;
  health: BackendAdapterHealth;
  authStatus: BackendStatus;
  endpointMatrix: BackendEndpointCapability[];
  blockers: BackendAdapterBlocker[];
  warnings: BackendAdapterWarning[];
  requestLog: BackendRequestLog[];
  lastRequest?: BackendRequestLog;
  artifacts: ArtifactRecord[];
  updatedAt: string;
}
