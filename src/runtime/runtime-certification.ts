export type RuntimeCertificationStatus = 'not_started' | 'running' | 'passed' | 'warning' | 'failed' | 'blocked' | 'certified';

export type RuntimeContractCategory =
  | 'environment_config'
  | 'sandbox_health'
  | 'authentication'
  | 'workspace_access'
  | 'tool_registry_sync'
  | 'model_compatibility'
  | 'artifact_export'
  | 'approval_hold'
  | 'governance_preflight'
  | 'quota_guard'
  | 'cost_tracking'
  | 'recovery_flow'
  | 'chaos_safety'
  | 'no_production_endpoint';

export interface RuntimeCertificationProfile {
  id: string;
  name: string;
  runtimeMode: 'mock' | 'sandbox';
  sandboxBaseUrl: string;
  apiKeyPresent: boolean;
  workspaceIdPresent: boolean;
  timeoutMs: number;
  createdAt: string;
}

export interface RuntimeContractTest {
  id: RuntimeContractCategory;
  category: RuntimeContractCategory;
  name: string;
  required: boolean;
  description: string;
}

export interface RuntimeContractResult {
  id: string;
  runId: string;
  testId: RuntimeContractCategory;
  required: boolean;
  status: RuntimeCertificationStatus;
  message: string;
  createdAt: string;
}

export interface RuntimeCertificationRun {
  id: string;
  profileId: string;
  status: RuntimeCertificationStatus;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  blockers: string[];
  warnings: string[];
}

export interface RuntimeReadinessFinding {
  id: string;
  runId: string;
  severity: 'info' | 'warning' | 'blocking';
  category: RuntimeContractCategory;
  message: string;
  createdAt: string;
}

export interface RuntimeCertificationArtifact {
  id: string;
  name: string;
  runId: string;
  createdAt: string;
}

export interface SandboxSafetyStatus {
  safe: boolean;
  productionEndpointDetected: boolean;
  runtimeMode: 'mock' | 'sandbox';
  message: string;
}

export interface RuntimeCertificationDashboard {
  profiles: RuntimeCertificationProfile[];
  runs: RuntimeCertificationRun[];
  activeRun?: RuntimeCertificationRun;
  tests: RuntimeContractTest[];
  results: RuntimeContractResult[];
  findings: RuntimeReadinessFinding[];
  status: RuntimeCertificationStatus;
  sandboxSafety: SandboxSafetyStatus;
  artifacts: string[];
}
