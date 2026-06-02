import type { ArtifactRecord } from './artifact-registry';
import type { BackendAdapterMode, BackendEndpointKind, BackendStatus } from './backend-adapter';

export type ApiContractId =
  | 'runtime.run.start'
  | 'runtime.run.cancel'
  | 'runtime.run.approve'
  | 'runtime.run.reject'
  | 'artifact.export'
  | 'approval.submit'
  | 'governance.evaluate'
  | 'worker.start'
  | 'worker.stop'
  | 'worker.pause'
  | 'worker.resume'
  | 'certifiedSandbox.run'
  | 'productionReadiness.check';

export type ApiContractMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type ApiContractStatus = 'ready' | 'warning' | 'blocked' | 'missing_env' | 'invalid_schema';

export type ApiContractAuthMode = 'none' | 'api_key' | 'bearer' | 'workspace';

export type ProductionApiErrorCode =
  | 'network_error'
  | 'auth_error'
  | 'contract_invalid'
  | 'backend_unavailable'
  | 'governance_blocked'
  | 'readiness_failed'
  | 'timeout';

export interface ApiSchemaDescriptor {
  type: 'object';
  required: string[];
  properties: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array' | 'unknown'>;
}

export interface ApiContract {
  contractId: ApiContractId;
  label: string;
  group: 'runtime' | 'artifact' | 'approval' | 'governance' | 'worker' | 'certification' | 'production';
  endpointKind: BackendEndpointKind;
  method: ApiContractMethod;
  path: string;
  requiredEnv: string[];
  requestSchema: ApiSchemaDescriptor;
  responseSchema: ApiSchemaDescriptor;
  authMode: ApiContractAuthMode;
  runtimeMode: BackendAdapterMode;
  readinessDependency: string[];
  fallbackBehavior: string;
  lastValidatedAt?: string;
  status: ApiContractStatus;
  blockedReason?: string;
}

export interface ApiContractValidationResult {
  ready: ApiContractId[];
  warnings: ApiContractId[];
  blocked: ApiContractId[];
  missingEnv: ApiContractId[];
  invalid: ApiContractId[];
  generatedAt: string;
}

export interface ApiContractTestResult {
  id: string;
  contractId: ApiContractId;
  mode: BackendAdapterMode;
  status: BackendStatus | ApiContractStatus;
  ok: boolean;
  fallbackUsed: boolean;
  requestPath: string;
  durationMs: number;
  message: string;
  createdAt: string;
}

export interface ProductionApiError {
  code: ProductionApiErrorCode;
  message: string;
  retryable: boolean;
  normalized: true;
  contractId?: ApiContractId;
}

export interface ProductionApiResult {
  id: string;
  contractId: ApiContractId;
  mode: BackendAdapterMode;
  status: BackendStatus;
  contractStatus: ApiContractStatus;
  ok: boolean;
  fallbackUsed: boolean;
  data?: unknown;
  error?: ProductionApiError;
  durationMs: number;
  createdAt: string;
}

export interface ApiContractState {
  contracts: ApiContract[];
  validation?: ApiContractValidationResult;
  testResults: ApiContractTestResult[];
  artifacts: ArtifactRecord[];
  updatedAt: string;
}
