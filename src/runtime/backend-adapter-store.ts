import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import type {
  BackendAdapterBlocker,
  BackendAdapterHealth,
  BackendAdapterMode,
  BackendAdapterState,
  BackendAdapterWarning,
  BackendEndpointCapability,
  BackendEndpointKind,
  BackendGatewayOptions,
  BackendGatewayResult,
  BackendRequestLog,
  BackendStatus,
} from './backend-adapter';
import {
  callArtifactEndpoint as gatewayCallArtifactEndpoint,
  callGovernanceEndpoint as gatewayCallGovernanceEndpoint,
  callHermesEndpoint as gatewayCallHermesEndpoint,
  callPaperclipEndpoint as gatewayCallPaperclipEndpoint,
  callRuntimeEndpoint as gatewayCallRuntimeEndpoint,
  callWorkerEndpoint as gatewayCallWorkerEndpoint,
  checkBackendHealth as gatewayCheckBackendHealth,
  validateBackendAuth as gatewayValidateBackendAuth,
} from './backend-api-gateway';
import { getCertifiedSandboxRunDashboard } from './certified-sandbox-run-store';
import { getActiveDeploymentConfig, isDeploymentConfigReadyForGoLive } from './deployment-config-store';
import { getGovernanceReadinessReport } from './governance-readiness-store';
import { getProductionReadinessDashboard } from './production-readiness-store';
import { getRuntimeCertificationDashboard } from './runtime-certification-store';

const BACKEND_ADAPTER_KEY = 'uikigai-backend-adapter-v1';

const ENDPOINTS: Array<Omit<BackendEndpointCapability, 'status' | 'lastCheckedAt' | 'reason'>> = [
  { kind: 'gateway', label: 'API Gateway', path: '/health', supportsSandbox: true, supportsProduction: true },
  { kind: 'runtime', label: 'GrowthOS Runtime', path: '/runtime', supportsSandbox: true, supportsProduction: true },
  { kind: 'hermes', label: 'Hermes', path: '/hermes', supportsSandbox: true, supportsProduction: true },
  { kind: 'paperclip', label: 'Paperclip', path: '/paperclip', supportsSandbox: true, supportsProduction: true },
  { kind: 'artifact', label: 'Artifact Registry', path: '/artifacts', supportsSandbox: true, supportsProduction: true },
  { kind: 'governance', label: 'Governance', path: '/governance', supportsSandbox: true, supportsProduction: true },
  { kind: 'worker', label: 'Worker Runtime', path: '/worker', supportsSandbox: true, supportsProduction: true },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function blocker(code: BackendAdapterBlocker['code'], reason: string, recommendedFix: string): BackendAdapterBlocker {
  return { id: `backend-blocker-${code}-${Date.now()}`, code, reason, recommendedFix, createdAt: nowIso() };
}

function warning(code: BackendAdapterWarning['code'], reason: string, recommendedFix: string): BackendAdapterWarning {
  return { id: `backend-warning-${code}-${Date.now()}`, code, reason, recommendedFix, createdAt: nowIso() };
}

function defaultHealth(mode: BackendAdapterMode): BackendAdapterHealth {
  return { mode, status: mode === 'mock' ? 'missing_config' : 'missing_config', summary: 'Backend adapter has not checked endpoint health yet.' };
}

function defaultMatrix(): BackendEndpointCapability[] {
  return ENDPOINTS.map((endpoint) => ({ ...endpoint, status: 'missing_config', reason: 'Not checked yet.' }));
}

function emptyState(): BackendAdapterState {
  return {
    mode: 'mock',
    health: defaultHealth('mock'),
    authStatus: 'missing_config',
    endpointMatrix: defaultMatrix(),
    blockers: [],
    warnings: [warning('mock_fallback_active', 'Mock mode is active by default.', 'Configure sandbox or production mode through deployment config before real backend calls.')],
    requestLog: [],
    artifacts: [],
    updatedAt: nowIso(),
  };
}

function readState(): BackendAdapterState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(BACKEND_ADAPTER_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<BackendAdapterState>;
    return {
      ...emptyState(),
      ...parsed,
      health: parsed.health ?? defaultHealth(parsed.mode ?? 'mock'),
      endpointMatrix: parsed.endpointMatrix ?? defaultMatrix(),
      blockers: parsed.blockers ?? [],
      warnings: parsed.warnings ?? [],
      requestLog: parsed.requestLog ?? [],
      artifacts: parsed.artifacts ?? [],
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: BackendAdapterState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(BACKEND_ADAPTER_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function runtimeModeFromDeployment(requested?: BackendAdapterMode): BackendAdapterMode {
  if (requested) return requested;
  return getActiveDeploymentConfig()?.runtimeMode ?? 'mock';
}

function readinessBlockers(mode: BackendAdapterMode): BackendAdapterBlocker[] {
  const blockers: BackendAdapterBlocker[] = [];
  if (mode !== 'production') return blockers;
  const deploymentReady = isDeploymentConfigReadyForGoLive();
  const production = getProductionReadinessDashboard();
  const runtime = getRuntimeCertificationDashboard();
  const certified = getCertifiedSandboxRunDashboard();
  const governance = getGovernanceReadinessReport();
  if (!deploymentReady) blockers.push(blocker('blocked_by_deployment_config', 'Deployment Config is not READY.', 'Complete `/deployment-config` and mark the production config ready.'));
  if (!production.activeCheck || production.blockers.length || !['READY', 'NEEDS_REVIEW', 'WARNING'].includes(production.status)) blockers.push(blocker('production_gate_not_ready', 'Production Readiness is not ready.', 'Resolve `/production-readiness` blockers.'));
  if (!(runtime.status === 'certified' || runtime.runs.some((run) => run.status === 'certified' || run.status === 'passed'))) blockers.push(blocker('blocked_by_certification', 'Runtime Certification has not passed.', 'Run and certify `/runtime-certification`.'));
  if (!certified.runs.some((run) => run.status === 'completed')) blockers.push(blocker('blocked_by_certification', 'Certified Sandbox Run has not completed.', 'Complete `/certified-sandbox-run`.'));
  if (governance.blockedReasons.length) blockers.push(blocker('blocked_by_governance', 'Governance readiness has blocking findings.', 'Resolve governance blockers before production backend calls.'));
  return blockers;
}

function warningsForMode(mode: BackendAdapterMode): BackendAdapterWarning[] {
  if (mode === 'mock') return [warning('mock_fallback_active', 'Mock fallback is active.', 'Use sandbox mode for endpoint testing and production mode only after gates pass.')];
  if (mode === 'sandbox') return [warning('sandbox_only', 'Sandbox backend adapter is active.', 'Use production mode only after deployment config and readiness gates are complete.')];
  return [];
}

function logFromResult(result: BackendGatewayResult, attempt = 1): BackendRequestLog {
  return {
    id: result.id,
    mode: result.mode,
    endpoint: result.endpoint,
    path: result.path,
    status: result.status,
    attempt,
    durationMs: result.durationMs,
    fallbackUsed: result.fallbackUsed,
    createdAt: result.createdAt,
    error: result.error,
  };
}

function persistRequest(result: BackendGatewayResult): BackendGatewayResult {
  const state = readState();
  const log = logFromResult(result);
  const requestLog = [log, ...state.requestLog].slice(0, 40);
  writeState({
    ...state,
    mode: result.mode,
    authStatus: result.endpoint === 'gateway' && result.path.includes('auth') ? result.status : state.authStatus,
    health: result.endpoint === 'gateway' && result.path.includes('health') ? { mode: result.mode, status: result.status, checkedAt: result.createdAt, summary: result.error?.message ?? `Backend health is ${result.status}.` } : state.health,
    requestLog,
    lastRequest: log,
    warnings: [...warningsForMode(result.mode), ...(result.error ? [warning('degraded_fallback', result.error.message, 'Review normalized backend error and retry policy.')] : [])],
    updatedAt: nowIso(),
  });
  return clone(result);
}

async function guardedCall(endpoint: BackendEndpointKind, options: BackendGatewayOptions, runner: (options: BackendGatewayOptions) => Promise<BackendGatewayResult>): Promise<BackendGatewayResult> {
  const mode = runtimeModeFromDeployment(options.mode);
  const blockers = readinessBlockers(mode);
  if (blockers.length) {
    const result: BackendGatewayResult = {
      id: unique('backend-request'),
      mode,
      endpoint,
      path: options.path ?? `/${endpoint}`,
      status: blockers[0].code === 'blocked_by_certification' ? 'blocked_by_certification' : blockers[0].code === 'blocked_by_governance' ? 'blocked_by_governance' : 'blocked_by_deployment_config',
      durationMs: 0,
      fallbackUsed: false,
      createdAt: nowIso(),
      error: { code: blockers[0].code, message: blockers[0].reason, retryable: false, normalized: true, source: endpoint },
    };
    const state = readState();
    const log = logFromResult(result);
    writeState({ ...state, mode, blockers, warnings: warningsForMode(mode), requestLog: [log, ...state.requestLog].slice(0, 40), lastRequest: log, updatedAt: nowIso() });
    return clone(result);
  }
  return persistRequest(await runner({ ...options, mode }));
}

function updateMatrix(mode: BackendAdapterMode, status: BackendStatus): BackendEndpointCapability[] {
  return ENDPOINTS.map((endpoint) => ({
    ...endpoint,
    status: mode === 'mock' ? 'degraded' : status,
    lastCheckedAt: nowIso(),
    reason: mode === 'mock' ? 'Mock fallback available; real endpoint not called.' : `${endpoint.label} ${status}.`,
  }));
}

export function getBackendAdapterState(): BackendAdapterState {
  return clone(readState());
}

export function resetBackendAdapterState(): BackendAdapterState {
  const state = emptyState();
  writeState(state);
  return clone(state);
}

export async function checkBackendHealth(options: BackendGatewayOptions = {}): Promise<BackendAdapterHealth> {
  const mode = runtimeModeFromDeployment(options.mode);
  const result = await guardedCall('gateway', { ...options, mode, path: options.path ?? '/health' }, gatewayCheckBackendHealth);
  const state = readState();
  const health: BackendAdapterHealth = { mode, status: result.status, checkedAt: result.createdAt, summary: result.error?.message ?? `Backend gateway is ${result.status}.` };
  writeState({ ...state, mode, health, endpointMatrix: updateMatrix(mode, result.status), blockers: readinessBlockers(mode), warnings: warningsForMode(mode), updatedAt: nowIso() });
  return clone(health);
}

export async function validateBackendAuth(options: BackendGatewayOptions = {}): Promise<BackendGatewayResult> {
  const result = await guardedCall('gateway', { ...options, path: options.path ?? '/auth/validate' }, gatewayValidateBackendAuth);
  const state = readState();
  writeState({ ...state, authStatus: result.status, updatedAt: nowIso() });
  return clone(result);
}

export async function callRuntimeEndpoint(options: BackendGatewayOptions = {}) {
  return guardedCall('runtime', options, gatewayCallRuntimeEndpoint);
}

export async function callHermesEndpoint(options: BackendGatewayOptions = {}) {
  return guardedCall('hermes', options, gatewayCallHermesEndpoint);
}

export async function callPaperclipEndpoint(options: BackendGatewayOptions = {}) {
  return guardedCall('paperclip', options, gatewayCallPaperclipEndpoint);
}

export async function callArtifactEndpoint(options: BackendGatewayOptions = {}) {
  return guardedCall('artifact', options, gatewayCallArtifactEndpoint);
}

export async function callGovernanceEndpoint(options: BackendGatewayOptions = {}) {
  return guardedCall('governance', options, gatewayCallGovernanceEndpoint);
}

export async function callWorkerEndpoint(options: BackendGatewayOptions = {}) {
  return guardedCall('worker', options, gatewayCallWorkerEndpoint);
}

function exportArtifact(id: string, name: string, contentSummary: string): ArtifactRecord {
  return registerArtifact({
    id,
    runId: 'backend-adapter',
    name,
    type: name.endsWith('.json') ? 'json' : 'report',
    source: 'mock',
    contentSummary,
    contentText: contentSummary,
    createdAt: nowIso(),
  }, {
    workspaceId: demoWorkspace.id,
    type: name.endsWith('.json') ? 'RUNTIME_OUTPUT' : 'REPORT',
    metadata: { workspaceId: demoWorkspace.id, source: 'mock', sourceType: 'backend-adapter', contentSummary, tags: ['backend-adapter', 'api-gateway'] },
  });
}

export function exportBackendAdapterReport(): ArtifactRecord[] {
  const state = readState();
  const artifacts = [
    exportArtifact('artifact-backend-adapter-report-md', 'backend-adapter-report.md', `# Backend Adapter Report\n\nMode: ${state.mode}\nHealth: ${state.health.status}\nAuth: ${state.authStatus}\nRequests: ${state.requestLog.length}\n`),
    exportArtifact('artifact-backend-health-json', 'backend-health.json', JSON.stringify(state.health, null, 2)),
    exportArtifact('artifact-backend-endpoint-matrix-json', 'backend-endpoint-matrix.json', JSON.stringify(state.endpointMatrix, null, 2)),
    exportArtifact('artifact-backend-error-report-md', 'backend-error-report.md', state.requestLog.filter((entry) => entry.error).map((entry) => `- ${entry.createdAt}: ${entry.endpoint} ${entry.error?.message}`).join('\n') || 'No backend errors recorded.'),
    exportArtifact('artifact-backend-auth-check-json', 'backend-auth-check.json', JSON.stringify({ authStatus: state.authStatus, lastRequest: state.lastRequest }, null, 2)),
  ];
  writeState({ ...state, artifacts, updatedAt: nowIso() });
  return clone(artifacts);
}

export function selectBackendHealth() {
  return getBackendAdapterState().health;
}

export function selectBackendAuthStatus() {
  return getBackendAdapterState().authStatus;
}

export function selectBackendMode() {
  return getBackendAdapterState().mode;
}

export function selectBackendEndpointMatrix() {
  return getBackendAdapterState().endpointMatrix;
}

export function selectBackendBlockers() {
  return getBackendAdapterState().blockers;
}

export function selectBackendWarnings() {
  return getBackendAdapterState().warnings;
}

export function selectBackendLastRequest() {
  return getBackendAdapterState().lastRequest;
}

export function selectBackendArtifacts() {
  return getBackendAdapterState().artifacts;
}
