import type { RuntimeIntegrationStatus, RuntimeMode } from '../growthos-runtime/runtime-types';

export interface HermesEnv {
  VITE_RUNTIME_MODE?: string;
  VITE_HERMES_BASE_URL?: string;
  VITE_HERMES_API_KEY?: string;
  VITE_RUNTIME_TIMEOUT_MS?: string;
}

export interface HermesConnectorConfig {
  service: 'hermes';
  requestedMode: RuntimeMode;
  mode: RuntimeMode;
  status: RuntimeIntegrationStatus;
  baseUrl?: string;
  apiKey?: string;
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
  const requestedMode = mode ?? normalizeMode(env.VITE_RUNTIME_MODE);
  const timeoutMs = normalizeTimeout(env.VITE_RUNTIME_TIMEOUT_MS);

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

  const baseUrl = env.VITE_HERMES_BASE_URL?.trim();
  const apiKey = env.VITE_HERMES_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
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
    timeoutMs,
    reason: 'sandbox-configured',
  };
}
