import type { RuntimeIntegrationStatus, RuntimeMode } from '../growthos-runtime/runtime-types';

export interface HermesEnv {
  VITE_RUNTIME_MODE?: string;
  VITE_HERMES_BASE_URL?: string;
  VITE_HERMES_API_KEY?: string;
  VITE_RUNTIME_TIMEOUT_MS?: string;
  HERMES_RUNTIME_MODE?: string;
  HERMES_SANDBOX_BASE_URL?: string;
  HERMES_SANDBOX_API_KEY?: string;
  HERMES_SANDBOX_WORKSPACE_ID?: string;
  HERMES_SANDBOX_TIMEOUT_MS?: string;
}

export interface HermesConnectorConfig {
  service: 'hermes';
  requestedMode: RuntimeMode;
  mode: RuntimeMode;
  status: RuntimeIntegrationStatus;
  baseUrl?: string;
  apiKey?: string;
  workspaceId?: string;
  timeoutMs: number;
  reason: 'mock-mode' | 'sandbox-configured' | 'missing-config';
}

const DEFAULT_TIMEOUT_MS = 15000;

function currentEnv(): HermesEnv {
  return (typeof import.meta !== 'undefined' ? import.meta.env : {}) as HermesEnv;
}

function normalizeMode(value?: string): RuntimeMode {
  return value === 'sandbox' ? 'sandbox' : 'mock';
}

function normalizeTimeout(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export function resolveHermesConfig(env: HermesEnv = currentEnv(), mode?: RuntimeMode): HermesConnectorConfig {
  const requestedMode = mode ?? normalizeMode(env.HERMES_RUNTIME_MODE ?? env.VITE_RUNTIME_MODE);
  const timeoutMs = normalizeTimeout(env.HERMES_SANDBOX_TIMEOUT_MS ?? env.VITE_RUNTIME_TIMEOUT_MS);

  if (requestedMode === 'mock') {
    return {
      service: 'hermes',
      requestedMode,
      mode: 'mock',
      status: 'online',
      timeoutMs,
      reason: 'mock-mode',
    };
  }

  const baseUrl = (env.HERMES_SANDBOX_BASE_URL ?? env.VITE_HERMES_BASE_URL)?.trim();
  const apiKey = (env.HERMES_SANDBOX_API_KEY ?? env.VITE_HERMES_API_KEY)?.trim();
  const workspaceId = env.HERMES_SANDBOX_WORKSPACE_ID?.trim();
  const usesHermesSandboxEnv = Boolean(env.HERMES_RUNTIME_MODE || env.HERMES_SANDBOX_BASE_URL || env.HERMES_SANDBOX_API_KEY);

  if (!baseUrl || !apiKey || (usesHermesSandboxEnv && !workspaceId)) {
    return {
      service: 'hermes',
      requestedMode,
      mode: 'mock',
      status: 'degraded',
      timeoutMs,
      reason: 'missing-config',
    };
  }

  return {
    service: 'hermes',
    requestedMode,
    mode: 'sandbox',
    status: 'online',
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    workspaceId,
    timeoutMs,
    reason: 'sandbox-configured',
  };
}
