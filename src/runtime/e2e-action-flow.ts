import type { ArtifactRecord } from './artifact-registry';
import type { ApiContractId, ProductionApiError } from './api-contract';
import type { BackendAdapterMode } from './backend-adapter';

export type E2EActionFlowId =
  | 'start-run-flow'
  | 'approval-required-flow'
  | 'approve-and-resume-flow'
  | 'reject-and-cancel-flow'
  | 'worker-lifecycle-flow'
  | 'artifact-export-flow'
  | 'governance-blocked-flow'
  | 'production-readiness-check-flow'
  | 'certified-sandbox-run-flow';

export type E2EActionFlowStatus = 'idle' | 'running' | 'waiting_approval' | 'blocked' | 'completed' | 'failed';

export interface E2EActionFlowStep {
  id: string;
  order: number;
  name: string;
  contractId: ApiContractId;
  status: 'pending' | 'running' | 'completed' | 'blocked' | 'failed';
  startedAt?: string;
  completedAt?: string;
  message?: string;
}

export interface E2EActionRequestLog {
  id: string;
  stepId: string;
  contractId: ApiContractId;
  mode: BackendAdapterMode;
  payloadSummary: string;
  createdAt: string;
}

export interface E2EActionResponseLog {
  id: string;
  requestId: string;
  contractId: ApiContractId;
  status: string;
  ok: boolean;
  fallbackUsed: boolean;
  message: string;
  createdAt: string;
}

export interface E2EActionAuditEvent {
  id: string;
  type: 'flow.started' | 'step.started' | 'step.completed' | 'step.blocked' | 'artifact.created' | 'flow.completed' | 'flow.failed';
  message: string;
  createdAt: string;
}

export interface E2EActionFlow {
  flowId: E2EActionFlowId;
  name: string;
  description: string;
  contractSequence: ApiContractId[];
  steps: E2EActionFlowStep[];
  currentStep: number;
  status: E2EActionFlowStatus;
  requestLog: E2EActionRequestLog[];
  responseLog: E2EActionResponseLog[];
  normalizedErrors: ProductionApiError[];
  artifactOutputs: ArtifactRecord[];
  auditTimeline: E2EActionAuditEvent[];
  backendMode: BackendAdapterMode;
  readinessGates: string[];
  warnings: string[];
  finalVerdict: string;
  updatedAt: string;
}

export interface E2EActionFlowValidation {
  valid: E2EActionFlowId[];
  invalid: E2EActionFlowId[];
  missingContracts: string[];
  generatedAt: string;
}

export interface E2EActionFlowState {
  flows: E2EActionFlow[];
  artifacts: ArtifactRecord[];
  lastRunFlowId?: E2EActionFlowId;
  validation?: E2EActionFlowValidation;
  updatedAt: string;
}
