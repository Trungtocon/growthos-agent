import type {
  BackendAdapterMode,
  BackendEndpointKind,
  BackendGatewayOptions,
  BackendGatewayResult,
  BackendNormalizedError,
  BackendStatus,
} from './backend-adapter';

function nowIso(): string {
  return new Date().toISOString();
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeBackendError(source: BackendEndpointKind, error: unknown, fallbackCode = 'backend_request_failed'): BackendNormalizedError {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Backend request failed.';
  return {
    code: fallbackCode,
    message,
    retryable: !message.toLowerCase().includes('auth'),
    normalized: true,
    source,
  };
}

function statusForMode(mode: BackendAdapterMode): BackendStatus {
  if (mode === 'mock') return 'degraded';
  if (mode === 'sandbox') return 'online';
  return 'online';
}

async function simulatedRequest(endpoint: BackendEndpointKind, options: BackendGatewayOptions): Promise<BackendGatewayResult> {
  const started = Date.now();
  const mode = options.mode ?? 'mock';
  const path = options.path ?? `/${endpoint}/health`;
  const timeoutMs = options.timeoutMs ?? 15000;
  const retries = options.retries ?? 1;
  await new Promise((resolve) => setTimeout(resolve, 5));
  if (timeoutMs < 5) {
    return {
      id: unique('backend-request'),
      mode,
      endpoint,
      path,
      status: 'degraded',
      durationMs: Date.now() - started,
      fallbackUsed: mode !== 'production',
      createdAt: nowIso(),
      error: normalizeBackendError(endpoint, new Error('Backend request timed out.'), 'timeout'),
    };
  }
  if (options.authToken === 'fail-auth') {
    return {
      id: unique('backend-request'),
      mode,
      endpoint,
      path,
      status: 'auth_failed',
      durationMs: Date.now() - started,
      fallbackUsed: false,
      createdAt: nowIso(),
      error: normalizeBackendError(endpoint, new Error('Authentication failed for backend request.'), 'auth_failed'),
    };
  }
  if (path.includes('fail') || (typeof options.payload === 'object' && options.payload && 'fail' in options.payload)) {
    return {
      id: unique('backend-request'),
      mode,
      endpoint,
      path,
      status: 'degraded',
      durationMs: Date.now() - started,
      fallbackUsed: mode !== 'production',
      createdAt: nowIso(),
      error: normalizeBackendError(endpoint, new Error(`Normalized ${endpoint} endpoint error.`)),
    };
  }
  return {
    id: unique('backend-request'),
    mode,
    endpoint,
    path,
    status: statusForMode(mode),
    durationMs: Date.now() - started,
    fallbackUsed: mode === 'mock',
    createdAt: nowIso(),
    data: {
      ok: true,
      endpoint,
      mode,
      path,
      attempts: retries,
    },
  };
}

export async function checkBackendHealth(options: BackendGatewayOptions = {}) {
  return simulatedRequest('gateway', { ...options, path: options.path ?? '/health' });
}

export async function validateBackendAuth(options: BackendGatewayOptions = {}) {
  return simulatedRequest('gateway', { ...options, path: options.path ?? '/auth/validate' });
}

export async function callRuntimeEndpoint(options: BackendGatewayOptions = {}) {
  return simulatedRequest('runtime', options);
}

export async function callHermesEndpoint(options: BackendGatewayOptions = {}) {
  return simulatedRequest('hermes', options);
}

export async function callPaperclipEndpoint(options: BackendGatewayOptions = {}) {
  return simulatedRequest('paperclip', options);
}

export async function callArtifactEndpoint(options: BackendGatewayOptions = {}) {
  return simulatedRequest('artifact', options);
}

export async function callGovernanceEndpoint(options: BackendGatewayOptions = {}) {
  return simulatedRequest('governance', options);
}

export async function callWorkerEndpoint(options: BackendGatewayOptions = {}) {
  return simulatedRequest('worker', options);
}
