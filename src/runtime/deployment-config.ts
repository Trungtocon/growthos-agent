import type { ArtifactRecord } from './artifact-registry';

export type DeploymentRuntimeMode = 'mock' | 'sandbox' | 'production';

export type DeploymentEnvGroup =
  | 'app'
  | 'hermes'
  | 'paperclip'
  | 'growthos_runtime'
  | 'auth'
  | 'storage'
  | 'logging'
  | 'billing'
  | 'notification'
  | 'deployment';

export type DeploymentValidationStatus = 'valid' | 'missing' | 'invalid' | 'warning' | 'blocked' | 'not_checked';

export type DeploymentBlockerCode =
  | 'missing_required_env'
  | 'missing_production_endpoint'
  | 'missing_production_api_key'
  | 'app_env_not_production'
  | 'runtime_certification_not_passed'
  | 'production_readiness_not_ready'
  | 'endpoint_health_offline'
  | 'manual_block';

export type DeploymentWarningCode =
  | 'production_env_missing'
  | 'mock_mode_active'
  | 'sandbox_without_production'
  | 'endpoint_health_degraded'
  | 'optional_env_missing'
  | 'manual_warning';

export interface DeploymentEnvKeyCheck {
  key: string;
  group: DeploymentEnvGroup;
  required: boolean;
  valuePresent: boolean;
  status: DeploymentValidationStatus;
  reason: string;
}

export interface DeploymentEnvGroupCheck {
  group: DeploymentEnvGroup;
  label: string;
  status: DeploymentValidationStatus;
  keys: DeploymentEnvKeyCheck[];
  missingCount: number;
  warningCount: number;
}

export interface DeploymentBlocker {
  id: string;
  code: DeploymentBlockerCode;
  group: DeploymentEnvGroup | 'readiness' | 'runtime';
  reason: string;
  recommendedFix: string;
  createdAt: string;
}

export interface DeploymentWarning {
  id: string;
  code: DeploymentWarningCode;
  group: DeploymentEnvGroup | 'readiness' | 'runtime';
  reason: string;
  recommendedFix: string;
  createdAt: string;
}

export interface DeploymentEndpointHealth {
  hermes: 'online' | 'degraded' | 'offline' | 'not_checked';
  paperclip: 'online' | 'degraded' | 'offline' | 'not_checked';
  runtime: 'online' | 'degraded' | 'offline' | 'not_checked';
  checkedAt?: string;
}

export interface DeploymentReadiness {
  sandboxReady: boolean;
  productionReady: boolean;
  runtimeCertificationPassed: boolean;
  productionReadinessPassed: boolean;
  goLiveEligible: boolean;
  status: DeploymentValidationStatus;
  summary: string;
}

export interface DeploymentConfigCheck {
  id: string;
  runtimeMode: DeploymentRuntimeMode;
  env: Record<string, string>;
  groups: DeploymentEnvGroupCheck[];
  blockers: DeploymentBlocker[];
  warnings: DeploymentWarning[];
  endpointHealth: DeploymentEndpointHealth;
  readiness: DeploymentReadiness;
  status: DeploymentValidationStatus;
  activeStep: number;
  readyMarkedAt?: string;
  blockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentConfigDashboard {
  activeConfig?: DeploymentConfigCheck;
  configs: DeploymentConfigCheck[];
  status: DeploymentValidationStatus;
  envGroups: DeploymentEnvGroupCheck[];
  missingEnv: DeploymentEnvKeyCheck[];
  warnings: DeploymentWarning[];
  blockers: DeploymentBlocker[];
  readiness: DeploymentReadiness;
  artifacts: ArtifactRecord[];
}
