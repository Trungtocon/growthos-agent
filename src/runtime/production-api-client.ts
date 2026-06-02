import type { BackendAdapterMode, BackendGatewayResult } from './backend-adapter';
import {
  callArtifactEndpoint,
  callGovernanceEndpoint,
  callRuntimeEndpoint,
  callWorkerEndpoint,
} from './backend-api-gateway';
import type {
  ApiContract,
  ApiContractId,
  ProductionApiError,
  ProductionApiErrorCode,
  ProductionApiResult,
} from './api-contract';
import {
  evaluateApiContract,
  getApiContractById,
  getMissingEnv,
  recordApiContractTestResult,
} from './api-contract-store';

export interface ProductionApiCallOptions {
  mode?: BackendAdapterMode;
  body?: Record<string, unknown>;
  authToken?: string;
  timeoutMs?: number;
  retries?: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeProductionApiError(
  code: ProductionApiErrorCode,
  message: string,
  contractId?: ApiContractId,
  retryable = false,
): ProductionApiError {
  return {
    code,
    message,
    retryable,
    normalized: true,
    contractId,
  };
}

function validateBody(contract: ApiContract, body: Record<string, unknown>): string[] {
  return contract.requestSchema.required.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
}

function errorResult(contractId: ApiContractId, contract: ApiContract | undefined, mode: BackendAdapterMode, code: ProductionApiErrorCode, message: string): ProductionApiResult {
  const createdAt = nowIso();
  const result: ProductionApiResult = {
    id: unique('production-api-result'),
    contractId,
    mode,
    status: code === 'auth_error' ? 'auth_failed' : code === 'governance_blocked' ? 'blocked_by_governance' : 'blocked_by_deployment_config',
    contractStatus: contract?.status ?? 'invalid_schema',
    ok: false,
    fallbackUsed: false,
    durationMs: 0,
    createdAt,
    error: normalizeProductionApiError(code, message, contractId),
  };
  recordApiContractTestResult({
    contractId,
    mode,
    status: result.status,
    ok: false,
    fallbackUsed: false,
    requestPath: contract?.path ?? 'unknown',
    durationMs: 0,
    message,
  });
  return result;
}

function resultFromGateway(contract: ApiContract, gateway: BackendGatewayResult): ProductionApiResult {
  const ok = !gateway.error && !gateway.status.startsWith('blocked') && gateway.status !== 'auth_failed' && gateway.status !== 'offline';
  const result: ProductionApiResult = {
    id: unique('production-api-result'),
    contractId: contract.contractId,
    mode: gateway.mode,
    status: gateway.status,
    contractStatus: contract.status,
    ok,
    fallbackUsed: gateway.fallbackUsed,
    data: gateway.data,
    durationMs: gateway.durationMs,
    createdAt: gateway.createdAt,
    error: gateway.error
      ? normalizeProductionApiError(
        gateway.error.code === 'auth_failed' ? 'auth_error' : gateway.error.code === 'timeout' ? 'timeout' : 'backend_unavailable',
        gateway.error.message,
        contract.contractId,
        gateway.error.retryable,
      )
      : undefined,
  };
  recordApiContractTestResult({
    contractId: contract.contractId,
    mode: gateway.mode,
    status: gateway.status,
    ok,
    fallbackUsed: gateway.fallbackUsed,
    requestPath: gateway.path,
    durationMs: gateway.durationMs,
    message: gateway.error?.message ?? `${contract.contractId} returned ${gateway.status}.`,
  });
  return result;
}

async function callGateway(contract: ApiContract, mode: BackendAdapterMode, options: ProductionApiCallOptions): Promise<BackendGatewayResult> {
  const gatewayOptions = {
    mode,
    contractId: contract.contractId,
    method: contract.method,
    path: contract.path,
    payload: options.body,
    authToken: options.authToken,
    timeoutMs: options.timeoutMs,
    retries: options.retries,
  };
  if (contract.endpointKind === 'artifact') return callArtifactEndpoint(gatewayOptions);
  if (contract.endpointKind === 'governance') return callGovernanceEndpoint(gatewayOptions);
  if (contract.endpointKind === 'worker') return callWorkerEndpoint(gatewayOptions);
  return callRuntimeEndpoint(gatewayOptions);
}

export async function executeApiContract(contractId: ApiContractId, options: ProductionApiCallOptions = {}): Promise<ProductionApiResult> {
  const requestedMode = options.mode ?? 'mock';
  const rawContract = getApiContractById(contractId, requestedMode);
  if (!rawContract) return errorResult(contractId, undefined, requestedMode, 'contract_invalid', `API contract ${contractId} is not registered.`);
  const contract = evaluateApiContract(rawContract, requestedMode);
  const body = options.body ?? {};
  const missingFields = validateBody(contract, body);
  if (missingFields.length) {
    return errorResult(contractId, contract, requestedMode, 'contract_invalid', `Request schema missing fields: ${missingFields.join(', ')}.`);
  }

  if (contract.status === 'invalid_schema') return errorResult(contractId, contract, requestedMode, 'contract_invalid', contract.blockedReason ?? 'Contract schema is invalid.');

  if (requestedMode === 'sandbox' && contract.status === 'missing_env') {
    const missing = getMissingEnv(contract, 'sandbox');
    const createdAt = nowIso();
    const result: ProductionApiResult = {
      id: unique('production-api-result'),
      contractId,
      mode: 'sandbox',
      status: 'degraded',
      contractStatus: 'missing_env',
      ok: true,
      fallbackUsed: true,
      data: {
        ok: true,
        mockResponse: true,
        fallbackReason: `Sandbox missing env: ${missing.join(', ')}`,
        contractId,
      },
      durationMs: 0,
      createdAt,
    };
    recordApiContractTestResult({
      contractId,
      mode: 'sandbox',
      status: 'missing_env',
      ok: true,
      fallbackUsed: true,
      requestPath: contract.path,
      durationMs: 0,
      message: `Sandbox missing env fallback used for ${contractId}.`,
    });
    return result;
  }

  if (requestedMode === 'production' && contract.status !== 'ready') {
    const code: ProductionApiErrorCode = contract.blockedReason?.toLowerCase().includes('governance') ? 'governance_blocked' : 'readiness_failed';
    return errorResult(contractId, contract, requestedMode, code, contract.blockedReason ?? 'Production readiness failed.');
  }

  return resultFromGateway(contract, await callGateway(contract, requestedMode, options));
}
