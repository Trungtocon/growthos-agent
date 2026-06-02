import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import type { BackendAdapterMode } from './backend-adapter';
import {
  getCertifiedSandboxRunDashboard,
} from './certified-sandbox-run-store';
import {
  getActiveDeploymentConfig,
  isDeploymentConfigReadyForGoLive,
} from './deployment-config-store';
import { getGovernanceReadinessReport } from './governance-readiness-store';
import { getProductionReadinessDashboard } from './production-readiness-store';
import { getRuntimeCertificationDashboard } from './runtime-certification-store';
import type {
  ApiContract,
  ApiContractId,
  ApiContractState,
  ApiContractStatus,
  ApiContractTestResult,
  ApiContractValidationResult,
  ApiSchemaDescriptor,
} from './api-contract';

const API_CONTRACT_KEY = 'uikigai-api-contracts-v1';

const objectSchema = (required: string[], properties: ApiSchemaDescriptor['properties']): ApiSchemaDescriptor => ({
  type: 'object',
  required,
  properties,
});

const baseResponse = objectSchema(['ok'], {
  ok: 'boolean',
  id: 'string',
  status: 'string',
  message: 'string',
});

const DEFAULT_CONTRACTS: ApiContract[] = [
  {
    contractId: 'runtime.run.start',
    label: 'Start runtime run',
    group: 'runtime',
    endpointKind: 'runtime',
    method: 'POST',
    path: '/runtime/runs/start',
    requiredEnv: ['APP_BASE_URL', 'GROWTHOS_WORKSPACE_ID'],
    requestSchema: objectSchema(['ticketId'], { ticketId: 'string', planId: 'string' }),
    responseSchema: baseResponse,
    authMode: 'workspace',
    runtimeMode: 'mock',
    readinessDependency: ['deployment_config', 'production_readiness', 'runtime_certification', 'certified_sandbox', 'governance'],
    fallbackBehavior: 'mock response when sandbox config is missing; block production until gates pass',
    status: 'warning',
  },
  {
    contractId: 'runtime.run.cancel',
    label: 'Cancel runtime run',
    group: 'runtime',
    endpointKind: 'runtime',
    method: 'POST',
    path: '/runtime/runs/{runId}/cancel',
    requiredEnv: ['APP_BASE_URL', 'GROWTHOS_WORKSPACE_ID'],
    requestSchema: objectSchema(['runId'], { runId: 'string' }),
    responseSchema: baseResponse,
    authMode: 'workspace',
    runtimeMode: 'mock',
    readinessDependency: ['deployment_config', 'governance'],
    fallbackBehavior: 'mock cancellation command when real backend is unavailable',
    status: 'warning',
  },
  {
    contractId: 'runtime.run.approve',
    label: 'Approve runtime run',
    group: 'runtime',
    endpointKind: 'runtime',
    method: 'POST',
    path: '/runtime/runs/{runId}/approve',
    requiredEnv: ['APP_BASE_URL', 'AUTH_SECRET'],
    requestSchema: objectSchema(['approvalId'], { approvalId: 'string', runId: 'string' }),
    responseSchema: baseResponse,
    authMode: 'bearer',
    runtimeMode: 'mock',
    readinessDependency: ['approval_execution', 'governance'],
    fallbackBehavior: 'mock approval acknowledgement when endpoint is not configured',
    status: 'warning',
  },
  {
    contractId: 'runtime.run.reject',
    label: 'Reject runtime run',
    group: 'runtime',
    endpointKind: 'runtime',
    method: 'POST',
    path: '/runtime/runs/{runId}/reject',
    requiredEnv: ['APP_BASE_URL', 'AUTH_SECRET'],
    requestSchema: objectSchema(['approvalId'], { approvalId: 'string', runId: 'string', reason: 'string' }),
    responseSchema: baseResponse,
    authMode: 'bearer',
    runtimeMode: 'mock',
    readinessDependency: ['approval_execution', 'governance'],
    fallbackBehavior: 'mock rejection acknowledgement when endpoint is not configured',
    status: 'warning',
  },
  {
    contractId: 'artifact.export',
    label: 'Export artifact',
    group: 'artifact',
    endpointKind: 'artifact',
    method: 'POST',
    path: '/artifacts/export',
    requiredEnv: ['APP_BASE_URL', 'STORAGE_DRIVER'],
    requestSchema: objectSchema(['artifactId'], { artifactId: 'string', format: 'string' }),
    responseSchema: baseResponse,
    authMode: 'workspace',
    runtimeMode: 'mock',
    readinessDependency: ['artifact_registry', 'deployment_config'],
    fallbackBehavior: 'register mock export artifact when storage backend is missing',
    status: 'warning',
  },
  {
    contractId: 'approval.submit',
    label: 'Submit approval',
    group: 'approval',
    endpointKind: 'governance',
    method: 'POST',
    path: '/approvals/submit',
    requiredEnv: ['APP_BASE_URL', 'AUTH_SECRET'],
    requestSchema: objectSchema(['approvalId', 'decision'], { approvalId: 'string', decision: 'string', note: 'string' }),
    responseSchema: baseResponse,
    authMode: 'bearer',
    runtimeMode: 'mock',
    readinessDependency: ['approval_execution', 'governance'],
    fallbackBehavior: 'use local approval workflow command when backend is unavailable',
    status: 'warning',
  },
  {
    contractId: 'governance.evaluate',
    label: 'Evaluate governance',
    group: 'governance',
    endpointKind: 'governance',
    method: 'POST',
    path: '/governance/evaluate',
    requiredEnv: ['APP_BASE_URL', 'AUTH_SECRET'],
    requestSchema: objectSchema(['action'], { action: 'string', actorId: 'string', scope: 'string' }),
    responseSchema: baseResponse,
    authMode: 'bearer',
    runtimeMode: 'mock',
    readinessDependency: ['governance'],
    fallbackBehavior: 'use frontend governance decision engine in mock mode',
    status: 'warning',
  },
  {
    contractId: 'worker.start',
    label: 'Start worker',
    group: 'worker',
    endpointKind: 'worker',
    method: 'POST',
    path: '/workers/start',
    requiredEnv: ['APP_BASE_URL', 'GROWTHOS_WORKSPACE_ID'],
    requestSchema: objectSchema(['workerId'], { workerId: 'string' }),
    responseSchema: baseResponse,
    authMode: 'workspace',
    runtimeMode: 'mock',
    readinessDependency: ['worker_observability', 'governance'],
    fallbackBehavior: 'start local worker runner state when backend is unavailable',
    status: 'warning',
  },
  {
    contractId: 'worker.stop',
    label: 'Stop worker',
    group: 'worker',
    endpointKind: 'worker',
    method: 'POST',
    path: '/workers/{workerId}/stop',
    requiredEnv: ['APP_BASE_URL', 'GROWTHOS_WORKSPACE_ID'],
    requestSchema: objectSchema(['workerId'], { workerId: 'string' }),
    responseSchema: baseResponse,
    authMode: 'workspace',
    runtimeMode: 'mock',
    readinessDependency: ['worker_observability', 'governance'],
    fallbackBehavior: 'stop local worker runner state when backend is unavailable',
    status: 'warning',
  },
  {
    contractId: 'worker.pause',
    label: 'Pause worker',
    group: 'worker',
    endpointKind: 'worker',
    method: 'POST',
    path: '/workers/{workerId}/pause',
    requiredEnv: ['APP_BASE_URL', 'GROWTHOS_WORKSPACE_ID'],
    requestSchema: objectSchema(['workerId'], { workerId: 'string', reason: 'string' }),
    responseSchema: baseResponse,
    authMode: 'workspace',
    runtimeMode: 'mock',
    readinessDependency: ['worker_observability', 'governance'],
    fallbackBehavior: 'pause local worker runner state when backend is unavailable',
    status: 'warning',
  },
  {
    contractId: 'worker.resume',
    label: 'Resume worker',
    group: 'worker',
    endpointKind: 'worker',
    method: 'POST',
    path: '/workers/{workerId}/resume',
    requiredEnv: ['APP_BASE_URL', 'GROWTHOS_WORKSPACE_ID'],
    requestSchema: objectSchema(['workerId'], { workerId: 'string' }),
    responseSchema: baseResponse,
    authMode: 'workspace',
    runtimeMode: 'mock',
    readinessDependency: ['worker_observability', 'governance'],
    fallbackBehavior: 'resume local worker runner state when backend is unavailable',
    status: 'warning',
  },
  {
    contractId: 'certifiedSandbox.run',
    label: 'Start certified sandbox run',
    group: 'certification',
    endpointKind: 'runtime',
    method: 'POST',
    path: '/certification/sandbox-runs',
    requiredEnv: ['HERMES_SANDBOX_BASE_URL', 'HERMES_SANDBOX_API_KEY', 'HERMES_SANDBOX_WORKSPACE_ID'],
    requestSchema: objectSchema(['certificationRunId'], { certificationRunId: 'string', runtimeMode: 'string' }),
    responseSchema: baseResponse,
    authMode: 'api_key',
    runtimeMode: 'mock',
    readinessDependency: ['runtime_certification', 'governance'],
    fallbackBehavior: 'run certified sandbox simulation when sandbox endpoint is not configured',
    status: 'warning',
  },
  {
    contractId: 'productionReadiness.check',
    label: 'Production readiness check',
    group: 'production',
    endpointKind: 'governance',
    method: 'POST',
    path: '/production-readiness/checks',
    requiredEnv: ['APP_BASE_URL', 'AUTH_SECRET', 'DEPLOYMENT_TARGET'],
    requestSchema: objectSchema(['workspaceId'], { workspaceId: 'string' }),
    responseSchema: baseResponse,
    authMode: 'bearer',
    runtimeMode: 'mock',
    readinessDependency: ['deployment_config', 'runtime_certification', 'certified_sandbox', 'governance'],
    fallbackBehavior: 'use local production readiness gate when backend endpoint is unavailable',
    status: 'warning',
  },
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

function emptyState(): ApiContractState {
  return {
    contracts: DEFAULT_CONTRACTS.map(clone),
    testResults: [],
    artifacts: [],
    updatedAt: nowIso(),
  };
}

function readState(): ApiContractState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(API_CONTRACT_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ApiContractState>;
    return {
      contracts: parsed.contracts?.length ? parsed.contracts : DEFAULT_CONTRACTS.map(clone),
      validation: parsed.validation,
      testResults: parsed.testResults ?? [],
      artifacts: parsed.artifacts ?? [],
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ApiContractState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(API_CONTRACT_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function activeEnv(): Record<string, string> {
  return getActiveDeploymentConfig()?.env ?? {};
}

export function getMissingEnv(contract: ApiContract, mode: BackendAdapterMode = contract.runtimeMode): string[] {
  if (mode === 'mock') return [];
  const env = activeEnv();
  return contract.requiredEnv.filter((key) => !env[key]);
}

function hasValidSchema(contract: ApiContract): boolean {
  return Boolean(
    contract.contractId
    && contract.method
    && contract.path.startsWith('/')
    && contract.requestSchema.type === 'object'
    && contract.responseSchema.type === 'object',
  );
}

function productionBlockedReason(): string | undefined {
  const production = getProductionReadinessDashboard();
  const certification = getRuntimeCertificationDashboard();
  const certifiedSandbox = getCertifiedSandboxRunDashboard();
  const governance = getGovernanceReadinessReport();
  if (!isDeploymentConfigReadyForGoLive()) return 'Deployment Config is not READY.';
  if (!production.activeCheck || production.blockers.length || !['READY', 'NEEDS_REVIEW', 'WARNING'].includes(production.status)) return 'Production Readiness is not ready.';
  if (!(certification.status === 'certified' || certification.runs.some((run) => run.status === 'certified' || run.status === 'passed'))) return 'Runtime Certification has not passed.';
  if (!certifiedSandbox.runs.some((run) => run.status === 'completed')) return 'Certified Sandbox Run has not completed.';
  if (governance.blockedReasons.length) return 'Governance readiness has blocked reasons.';
  return undefined;
}

export function evaluateApiContract(contract: ApiContract, mode: BackendAdapterMode = contract.runtimeMode): ApiContract {
  if (!hasValidSchema(contract)) return { ...contract, status: 'invalid_schema', blockedReason: 'Contract path, method, or schemas are invalid.' };
  const missing = getMissingEnv(contract, mode);
  if (mode === 'production') {
    const reason = productionBlockedReason();
    if (reason) return { ...contract, runtimeMode: mode, status: 'blocked', blockedReason: reason };
    if (missing.length) return { ...contract, runtimeMode: mode, status: 'missing_env', blockedReason: `Missing env: ${missing.join(', ')}` };
    return { ...contract, runtimeMode: mode, status: 'ready', blockedReason: undefined };
  }
  if (mode === 'sandbox') {
    if (missing.length) return { ...contract, runtimeMode: mode, status: 'missing_env', blockedReason: `Missing sandbox env: ${missing.join(', ')}` };
    return { ...contract, runtimeMode: mode, status: 'ready', blockedReason: undefined };
  }
  return { ...contract, runtimeMode: mode, status: 'warning', blockedReason: 'Mock response is active.' };
}

export function getApiContracts(mode?: BackendAdapterMode): ApiContract[] {
  return readState().contracts.map((contract) => evaluateApiContract(contract, mode ?? contract.runtimeMode));
}

export function getApiContractById(contractId: ApiContractId, mode?: BackendAdapterMode): ApiContract | undefined {
  const contract = readState().contracts.find((item) => item.contractId === contractId);
  return contract ? evaluateApiContract(contract, mode ?? contract.runtimeMode) : undefined;
}

export function getApiContractState(): ApiContractState {
  const state = readState();
  return clone({ ...state, contracts: getApiContracts() });
}

export function validateApiContracts(mode?: BackendAdapterMode): ApiContractValidationResult {
  const contracts = getApiContracts(mode);
  const validation: ApiContractValidationResult = {
    ready: contracts.filter((contract) => contract.status === 'ready').map((contract) => contract.contractId),
    warnings: contracts.filter((contract) => contract.status === 'warning').map((contract) => contract.contractId),
    blocked: contracts.filter((contract) => contract.status === 'blocked').map((contract) => contract.contractId),
    missingEnv: contracts.filter((contract) => contract.status === 'missing_env').map((contract) => contract.contractId),
    invalid: contracts.filter((contract) => contract.status === 'invalid_schema').map((contract) => contract.contractId),
    generatedAt: nowIso(),
  };
  const state = readState();
  writeState({
    ...state,
    contracts: contracts.map((contract) => ({ ...contract, lastValidatedAt: validation.generatedAt })),
    validation,
  });
  return clone(validation);
}

export function recordApiContractTestResult(result: Omit<ApiContractTestResult, 'id' | 'createdAt'>): ApiContractTestResult {
  const state = readState();
  const next: ApiContractTestResult = {
    ...result,
    id: unique('api-contract-test'),
    createdAt: nowIso(),
  };
  writeState({
    ...state,
    testResults: [next, ...state.testResults].slice(0, 80),
  });
  return clone(next);
}

function artifact(name: string, type: ArtifactRecord['type'], summary: string, contentJson?: unknown, contentText?: string): ArtifactRecord {
  const createdAt = nowIso();
  return {
    id: `artifact-api-contract-${name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}`,
    workspaceId: demoWorkspace.id,
    type,
    lifecycle: 'AVAILABLE',
    name,
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      runId: 'api-contract-binding',
      source: 'mock',
      sourceType: 'api-contract',
      contentSummary: summary,
      tags: ['api-contract', 'backend-adapter'],
      sizeBytes: JSON.stringify(contentJson ?? contentText ?? summary).length,
    },
    runId: 'api-contract-binding',
    createdAt,
    updatedAt: createdAt,
  };
}

export function exportApiContractArtifacts(): ArtifactRecord[] {
  const state = getApiContractState();
  const validation = state.validation ?? validateApiContracts();
  const statusRows = state.contracts
    .map((contract) => `| ${contract.contractId} | ${contract.method} | ${contract.path} | ${contract.status} | ${contract.blockedReason ?? 'None'} |`)
    .join('\n');
  const artifacts = [
    artifact('api-contracts.json', 'AUDIT', `${state.contracts.length} API contracts registered.`, state.contracts),
    artifact('api-contract-status.md', 'REPORT', `${validation.ready.length} ready, ${validation.missingEnv.length} missing env.`, undefined, [
      '# API Contract Status',
      '',
      '| Contract | Method | Path | Status | Blocked Reason |',
      '|---|---|---|---|---|',
      statusRows,
    ].join('\n')),
    artifact('endpoint-readiness-report.md', 'REPORT', 'Endpoint readiness report generated.', undefined, [
      '# Endpoint Readiness Report',
      '',
      `Ready: ${validation.ready.length}`,
      `Warnings: ${validation.warnings.length}`,
      `Blocked: ${validation.blocked.length}`,
      `Missing env: ${validation.missingEnv.length}`,
      `Invalid schema: ${validation.invalid.length}`,
    ].join('\n')),
    artifact('api-contract-test-results.json', 'AUDIT', `${state.testResults.length} API contract test result(s).`, state.testResults),
  ].map((item) => registerArtifact(item));
  writeState({ ...readState(), artifacts });
  return clone(artifacts);
}

export function clearApiContractStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(API_CONTRACT_KEY);
}

export function selectApiContractMatrix() {
  return getApiContracts();
}

export function selectApiContractStatus() {
  const contracts = getApiContracts();
  return {
    total: contracts.length,
    ready: contracts.filter((contract) => contract.status === 'ready').length,
    warning: contracts.filter((contract) => contract.status === 'warning').length,
    blocked: contracts.filter((contract) => contract.status === 'blocked').length,
    missingEnv: contracts.filter((contract) => contract.status === 'missing_env').length,
    invalidSchema: contracts.filter((contract) => contract.status === 'invalid_schema').length,
  };
}

export function selectApiContractMissingEnv() {
  return getApiContracts().filter((contract) => contract.status === 'missing_env');
}

export function selectApiContractTestResults() {
  return clone(readState().testResults);
}

export function selectApiContractArtifacts() {
  return clone(readState().artifacts);
}
