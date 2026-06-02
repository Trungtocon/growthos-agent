import type { ArtifactRecord } from './artifact-registry';

export type CertifiedSandboxRunStatus =
  | 'draft'
  | 'waiting_certification'
  | 'blocked'
  | 'ready'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type CertifiedSandboxStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
export type CertifiedSandboxRuntimeMode = 'mock' | 'sandbox' | 'production';
export type CertifiedSandboxHealth = 'online' | 'degraded' | 'offline' | 'missing_config';

export interface CertifiedSandboxStep {
  id: string;
  runId: string;
  order: number;
  name: string;
  description: string;
  status: CertifiedSandboxStepStatus;
  startedAt?: string;
  completedAt?: string;
}

export interface CertifiedSandboxBlocker {
  id: string;
  runId: string;
  code:
    | 'certification_missing'
    | 'certification_not_passed'
    | 'production_endpoint_detected'
    | 'governance_blocker'
    | 'sandbox_offline'
    | 'production_runtime_mode';
  message: string;
  severity: 'warning' | 'blocking';
  createdAt: string;
}

export interface CertifiedSandboxArtifact {
  id: string;
  runId: string;
  artifactRecordId: string;
  name: string;
  type: ArtifactRecord['type'];
  createdAt: string;
}

export interface CertifiedSandboxResult {
  id: string;
  runId: string;
  workflowRunId: string;
  toolCallId?: string;
  artifactIds: string[];
  usageRecordIds: string[];
  evaluationScore?: number;
  learningMemoryUpdated: boolean;
  completedAt?: string;
}

export interface CertifiedSandboxAuditEvent {
  id: string;
  runId: string;
  type:
    | 'run.created'
    | 'preflight.evaluated'
    | 'preflight.blocked'
    | 'approval.required'
    | 'approval.approved'
    | 'approval.rejected'
    | 'run.started'
    | 'tool.completed'
    | 'artifact.created'
    | 'usage.updated'
    | 'evaluation.updated'
    | 'learning_memory.updated'
    | 'artifacts.exported'
    | 'run.completed'
    | 'run.failed'
    | 'run.cancelled';
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface CertifiedSandboxRun {
  id: string;
  ticketId: string;
  workflowRunId: string;
  certificationRunId?: string;
  runtimeMode: CertifiedSandboxRuntimeMode;
  sandboxBaseUrl?: string;
  sandboxHealth: CertifiedSandboxHealth;
  governanceBlockers: string[];
  approvalRequired: boolean;
  approvalApproved: boolean;
  status: CertifiedSandboxRunStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
}

export interface CertifiedSandboxPreflight {
  runId: string;
  status: 'ready' | 'warning' | 'blocked';
  certificationStatus: string;
  sandboxHealth: CertifiedSandboxHealth;
  runtimeMode: CertifiedSandboxRuntimeMode;
  blockers: CertifiedSandboxBlocker[];
  warnings: string[];
  approvalRequired: boolean;
  evaluatedAt: string;
}

export interface CertifiedSandboxDashboard {
  runs: CertifiedSandboxRun[];
  activeRun?: CertifiedSandboxRun;
  steps: CertifiedSandboxStep[];
  preflight?: CertifiedSandboxPreflight;
  blockers: CertifiedSandboxBlocker[];
  artifacts: CertifiedSandboxArtifact[];
  auditTrail: CertifiedSandboxAuditEvent[];
  results: CertifiedSandboxResult[];
  status: CertifiedSandboxRunStatus | 'not_started';
  readyRuns: number;
  runningRuns: number;
  completedRuns: number;
  blockedRuns: number;
}
