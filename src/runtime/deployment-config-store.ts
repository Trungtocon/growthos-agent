import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import type {
  DeploymentBlocker,
  DeploymentBlockerCode,
  DeploymentConfigCheck,
  DeploymentConfigDashboard,
  DeploymentEndpointHealth,
  DeploymentEnvGroup,
  DeploymentEnvGroupCheck,
  DeploymentEnvKeyCheck,
  DeploymentReadiness,
  DeploymentRuntimeMode,
  DeploymentValidationStatus,
  DeploymentWarning,
  DeploymentWarningCode,
} from './deployment-config';
import { getProductionReadinessDashboard } from './production-readiness-store';
import { getRuntimeCertificationDashboard } from './runtime-certification-store';

const DEPLOYMENT_CONFIG_KEY = 'uikigai-deployment-config-v1';

interface DeploymentConfigState {
  configs: Record<string, DeploymentConfigCheck>;
  activeConfigId?: string;
  artifacts: Record<string, ArtifactRecord>;
  updatedAt: string;
}

const ENV_GROUP_LABELS: Record<DeploymentEnvGroup, string> = {
  app: 'App',
  hermes: 'Hermes Runtime',
  paperclip: 'Paperclip',
  growthos_runtime: 'GrowthOS Runtime',
  auth: 'Auth',
  storage: 'Storage',
  logging: 'Logging',
  billing: 'Billing',
  notification: 'Notification',
  deployment: 'Deployment',
};

const ENV_GROUPS: Record<DeploymentEnvGroup, string[]> = {
  app: ['APP_ENV', 'APP_BASE_URL'],
  hermes: ['HERMES_RUNTIME_MODE', 'HERMES_SANDBOX_BASE_URL', 'HERMES_SANDBOX_API_KEY', 'HERMES_SANDBOX_WORKSPACE_ID', 'HERMES_PRODUCTION_BASE_URL', 'HERMES_PRODUCTION_API_KEY'],
  paperclip: ['PAPERCLIP_BASE_URL', 'PAPERCLIP_API_KEY'],
  growthos_runtime: ['GROWTHOS_WORKSPACE_ID'],
  auth: ['AUTH_SECRET'],
  storage: ['STORAGE_DRIVER'],
  logging: ['LOG_LEVEL'],
  billing: ['BILLING_PROVIDER'],
  notification: [],
  deployment: ['DEPLOYMENT_TARGET'],
};

const COMMON_REQUIRED = ['APP_ENV', 'APP_BASE_URL', 'HERMES_RUNTIME_MODE', 'PAPERCLIP_BASE_URL', 'PAPERCLIP_API_KEY', 'GROWTHOS_WORKSPACE_ID', 'STORAGE_DRIVER', 'LOG_LEVEL', 'DEPLOYMENT_TARGET'];
const SANDBOX_REQUIRED = ['HERMES_SANDBOX_BASE_URL', 'HERMES_SANDBOX_API_KEY', 'HERMES_SANDBOX_WORKSPACE_ID'];
const PRODUCTION_REQUIRED = ['HERMES_PRODUCTION_BASE_URL', 'HERMES_PRODUCTION_API_KEY', 'AUTH_SECRET', 'BILLING_PROVIDER'];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyState(): DeploymentConfigState {
  return { configs: {}, artifacts: {}, updatedAt: nowIso() };
}

function readState(): DeploymentConfigState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(DEPLOYMENT_CONFIG_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<DeploymentConfigState>;
    return {
      configs: parsed.configs ?? {},
      activeConfigId: parsed.activeConfigId,
      artifacts: parsed.artifacts ?? {},
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: DeploymentConfigState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(DEPLOYMENT_CONFIG_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function envFromImportMeta(): Record<string, string> {
  const runtimeEnv = (import.meta.env ?? {}) as Record<string, string | undefined>;
  const env: Record<string, string> = {};
  for (const key of Object.values(ENV_GROUPS).flat()) {
    const viteKey = `VITE_${key}`;
    const value = runtimeEnv[viteKey] ?? runtimeEnv[key];
    if (value) env[key] = value;
  }
  return env;
}

function defaultEnvForMode(runtimeMode: DeploymentRuntimeMode, overrides: Record<string, string> = {}): Record<string, string> {
  return {
    APP_ENV: 'development',
    HERMES_RUNTIME_MODE: runtimeMode,
    LOG_LEVEL: 'info',
    ...envFromImportMeta(),
    ...overrides,
  };
}

function requiredKeysForMode(runtimeMode: DeploymentRuntimeMode): Set<string> {
  const keys = new Set(COMMON_REQUIRED);
  if (runtimeMode === 'sandbox') SANDBOX_REQUIRED.forEach((key) => keys.add(key));
  if (runtimeMode === 'production') PRODUCTION_REQUIRED.forEach((key) => keys.add(key));
  return keys;
}

function keyGroup(key: string): DeploymentEnvGroup {
  for (const [group, keys] of Object.entries(ENV_GROUPS) as [DeploymentEnvGroup, string[]][]) {
    if (keys.includes(key)) return group;
  }
  return 'deployment';
}

function hasValue(env: Record<string, string>, key: string): boolean {
  return Boolean(env[key] && String(env[key]).trim());
}

function blocker(checkId: string, code: DeploymentBlockerCode, group: DeploymentBlocker['group'], reason: string, recommendedFix: string): DeploymentBlocker {
  return { id: `deployment-blocker-${checkId}-${code}-${group}`, code, group, reason, recommendedFix, createdAt: nowIso() };
}

function warning(checkId: string, code: DeploymentWarningCode, group: DeploymentWarning['group'], reason: string, recommendedFix: string): DeploymentWarning {
  return { id: `deployment-warning-${checkId}-${code}-${group}-${Date.now()}`, code, group, reason, recommendedFix, createdAt: nowIso() };
}

function buildEnvGroups(runtimeMode: DeploymentRuntimeMode, env: Record<string, string>): DeploymentEnvGroupCheck[] {
  const required = requiredKeysForMode(runtimeMode);
  return (Object.entries(ENV_GROUPS) as [DeploymentEnvGroup, string[]][]).map(([group, keys]) => {
    const checks: DeploymentEnvKeyCheck[] = keys.map((key) => {
      const isRequired = required.has(key);
      const valuePresent = hasValue(env, key);
      const status: DeploymentValidationStatus = valuePresent ? 'valid' : isRequired ? 'missing' : 'warning';
      return {
        key,
        group,
        required: isRequired,
        valuePresent,
        status,
        reason: valuePresent ? 'Configured' : isRequired ? `${key} is required for ${runtimeMode} mode.` : `${key} is optional for ${runtimeMode} mode.`,
      };
    });
    const missingCount = checks.filter((entry) => entry.status === 'missing').length;
    const warningCount = checks.filter((entry) => entry.status === 'warning').length;
    const status: DeploymentValidationStatus = missingCount ? 'missing' : warningCount ? 'warning' : 'valid';
    return { group, label: ENV_GROUP_LABELS[group], status, keys: checks, missingCount, warningCount };
  });
}

function checkEndpointHealth(runtimeMode: DeploymentRuntimeMode, env: Record<string, string>): DeploymentEndpointHealth {
  const hermesUrl = runtimeMode === 'production' ? env.HERMES_PRODUCTION_BASE_URL : env.HERMES_SANDBOX_BASE_URL;
  const paperclipUrl = env.PAPERCLIP_BASE_URL;
  const runtimeUrl = env.APP_BASE_URL;
  return {
    hermes: hermesUrl ? 'online' : runtimeMode === 'mock' ? 'not_checked' : 'offline',
    paperclip: paperclipUrl ? 'online' : 'degraded',
    runtime: runtimeUrl ? 'online' : 'degraded',
    checkedAt: nowIso(),
  };
}

function runtimeCertificationPassed(): boolean {
  const runtime = getRuntimeCertificationDashboard();
  return runtime.status === 'certified' || runtime.runs.some((run) => run.status === 'certified' || run.status === 'passed');
}

function productionReadinessPassed(): boolean {
  const readiness = getProductionReadinessDashboard();
  return Boolean(readiness.activeCheck && readiness.blockers.length === 0 && ['READY', 'NEEDS_REVIEW', 'WARNING'].includes(readiness.status));
}

function buildReadiness(runtimeMode: DeploymentRuntimeMode, blockers: DeploymentBlocker[], warnings: DeploymentWarning[]): DeploymentReadiness {
  const runtimePassed = runtimeCertificationPassed();
  const readinessPassed = productionReadinessPassed();
  const sandboxReady = runtimeMode === 'mock' || runtimeMode === 'sandbox'
    ? !blockers.length
    : true;
  const productionReady = runtimeMode === 'production' && !blockers.length && runtimePassed && readinessPassed;
  const status: DeploymentValidationStatus = blockers.length ? 'blocked' : warnings.length ? 'warning' : 'valid';
  return {
    sandboxReady,
    productionReady,
    runtimeCertificationPassed: runtimePassed,
    productionReadinessPassed: readinessPassed,
    goLiveEligible: productionReady,
    status,
    summary: blockers.length
      ? `${blockers.length} deployment blocker(s) must be resolved.`
      : warnings.length
        ? `${warnings.length} warning(s) require review.`
        : `${runtimeMode} deployment configuration is ready.`,
  };
}

function statusFrom(blockers: DeploymentBlocker[], warnings: DeploymentWarning[]): DeploymentValidationStatus {
  if (blockers.length) return 'blocked';
  if (warnings.length) return 'warning';
  return 'valid';
}

function evaluate(check: DeploymentConfigCheck): DeploymentConfigCheck {
  const groups = buildEnvGroups(check.runtimeMode, check.env);
  const missingRequired = groups.flatMap((group) => group.keys).filter((entry) => entry.required && !entry.valuePresent);
  const blockers: DeploymentBlocker[] = [];
  const warnings: DeploymentWarning[] = [];

  for (const missing of missingRequired) {
    blockers.push(blocker(check.id, 'missing_required_env', missing.group, `${missing.key} is missing.`, `Configure ${missing.key} before deployment.`));
  }

  if (check.runtimeMode === 'production') {
    if (!hasValue(check.env, 'HERMES_PRODUCTION_BASE_URL')) blockers.push(blocker(check.id, 'missing_production_endpoint', 'hermes', 'Hermes production endpoint is missing.', 'Set HERMES_PRODUCTION_BASE_URL.'));
    if (!hasValue(check.env, 'HERMES_PRODUCTION_API_KEY')) blockers.push(blocker(check.id, 'missing_production_api_key', 'hermes', 'Hermes production API key is missing.', 'Set HERMES_PRODUCTION_API_KEY using the production secret manager.'));
    if (check.env.APP_ENV !== 'production') blockers.push(blocker(check.id, 'app_env_not_production', 'app', `APP_ENV is ${check.env.APP_ENV || 'missing'}.`, 'Set APP_ENV=production for production go-live.'));
    if (!runtimeCertificationPassed()) blockers.push(blocker(check.id, 'runtime_certification_not_passed', 'runtime', 'Runtime certification is not passed.', 'Run `/runtime-certification` and certify the sandbox/runtime contract.'));
    if (!productionReadinessPassed()) blockers.push(blocker(check.id, 'production_readiness_not_ready', 'readiness', 'Production readiness gate is not ready.', 'Resolve `/production-readiness` blockers before marking deployment config ready.'));
  }

  if (check.runtimeMode === 'mock') warnings.push(warning(check.id, 'mock_mode_active', 'runtime', 'Mock mode is still active.', 'Switch to sandbox or production mode before go-live.'));
  if (check.runtimeMode === 'sandbox' && (!hasValue(check.env, 'HERMES_PRODUCTION_BASE_URL') || !hasValue(check.env, 'HERMES_PRODUCTION_API_KEY'))) {
    warnings.push(warning(check.id, 'production_env_missing', 'hermes', 'Sandbox is configured but production Hermes env is missing.', 'Prepare production endpoint and API key before final go-live.'));
    warnings.push(warning(check.id, 'sandbox_without_production', 'deployment', 'Sandbox readiness can pass but production readiness remains unavailable.', 'Complete production environment values after sandbox certification.'));
  }

  const endpointHealth = checkEndpointHealth(check.runtimeMode, check.env);
  if (check.runtimeMode === 'production' && endpointHealth.hermes === 'offline') blockers.push(blocker(check.id, 'endpoint_health_offline', 'hermes', 'Hermes production endpoint health is offline.', 'Re-check endpoint health after configuring the production endpoint.'));
  if (endpointHealth.paperclip === 'degraded' || endpointHealth.runtime === 'degraded') warnings.push(warning(check.id, 'endpoint_health_degraded', 'deployment', 'One or more deployment endpoints are degraded or not configured.', 'Complete endpoint configuration and re-check health.'));

  const readiness = buildReadiness(check.runtimeMode, blockers, warnings);
  return {
    ...check,
    groups,
    blockers,
    warnings,
    endpointHealth,
    readiness,
    status: statusFrom(blockers, warnings),
    updatedAt: nowIso(),
  };
}

function persistConfig(config: DeploymentConfigCheck): DeploymentConfigCheck {
  const state = readState();
  writeState({ ...state, configs: { ...state.configs, [config.id]: config }, activeConfigId: config.id });
  return clone(config);
}

export function createDeploymentConfigCheck(input: { runtimeMode?: DeploymentRuntimeMode; env?: Record<string, string> } = {}): DeploymentConfigCheck {
  const now = nowIso();
  const runtimeMode = input.runtimeMode ?? 'mock';
  const env = defaultEnvForMode(runtimeMode, input.env);
  const check: DeploymentConfigCheck = {
    id: unique('deployment-config'),
    runtimeMode,
    env,
    groups: buildEnvGroups(runtimeMode, env),
    blockers: [],
    warnings: [],
    endpointHealth: { hermes: 'not_checked', paperclip: 'not_checked', runtime: 'not_checked' },
    readiness: {
      sandboxReady: false,
      productionReady: false,
      runtimeCertificationPassed: false,
      productionReadinessPassed: false,
      goLiveEligible: false,
      status: 'not_checked',
      summary: 'Deployment configuration has not been checked.',
    },
    status: 'not_checked',
    activeStep: 1,
    createdAt: now,
    updatedAt: now,
  };
  return persistConfig(check);
}

export function validateDeploymentConfig(configId?: string): DeploymentConfigCheck {
  const config = configId ? getDeploymentConfig(configId) : getActiveDeploymentConfig();
  const target = config ?? createDeploymentConfigCheck();
  return persistConfig(evaluate(target));
}

export function recheckDeploymentEndpointHealth(configId?: string): DeploymentConfigCheck {
  const config = configId ? getDeploymentConfig(configId) : getActiveDeploymentConfig();
  const target = config ?? createDeploymentConfigCheck();
  return persistConfig(evaluate({ ...target, endpointHealth: checkEndpointHealth(target.runtimeMode, target.env), activeStep: Math.max(target.activeStep, 3) }));
}

export function markDeploymentConfigReady(configId?: string): DeploymentConfigCheck {
  const evaluated = validateDeploymentConfig(configId);
  if (evaluated.blockers.length) return evaluated;
  return persistConfig({ ...evaluated, readyMarkedAt: nowIso(), status: 'valid', readiness: { ...evaluated.readiness, goLiveEligible: evaluated.runtimeMode === 'production' }, activeStep: 6 });
}

export function blockDeploymentConfig(configId?: string, reason = 'Blocked manually from deployment configuration wizard.'): DeploymentConfigCheck {
  const config = configId ? getDeploymentConfig(configId) : getActiveDeploymentConfig();
  const target = config ?? createDeploymentConfigCheck();
  const manual = blocker(target.id, 'manual_block', 'deployment', reason, 'Resolve the deployment block and validate config again.');
  return persistConfig({ ...target, blockers: [...target.blockers, manual], status: 'blocked', blockedAt: nowIso(), updatedAt: nowIso() });
}

export function resetDeploymentConfigCheck(runtimeMode: DeploymentRuntimeMode = 'mock'): DeploymentConfigCheck {
  return createDeploymentConfigCheck({ runtimeMode });
}

function artifact(id: string, name: string, contentSummary: string): ArtifactRecord {
  return registerArtifact({
    id,
    runId: 'deployment-config',
    name,
    type: name.endsWith('.json') ? 'json' : 'report',
    source: 'mock',
    contentSummary,
    contentText: contentSummary,
    createdAt: nowIso(),
  }, {
    workspaceId: demoWorkspace.id,
    type: name.endsWith('.json') ? 'RUNTIME_OUTPUT' : 'REPORT',
    metadata: { workspaceId: demoWorkspace.id, source: 'mock', sourceType: 'deployment-config', contentSummary, tags: ['deployment', 'go-live'] },
  });
}

export function exportDeploymentConfigArtifacts(configId?: string): ArtifactRecord[] {
  const config = validateDeploymentConfig(configId);
  const artifacts = [
    artifact(`artifact-${config.id}-deployment-config-json`, 'deployment-config.json', JSON.stringify({ id: config.id, status: config.status, runtimeMode: config.runtimeMode, readiness: config.readiness }, null, 2)),
    artifact(`artifact-${config.id}-deployment-config-report-md`, 'deployment-config-report.md', `# Deployment Config Report\n\nStatus: ${config.status}\nRuntime mode: ${config.runtimeMode}\nBlockers: ${config.blockers.length}\nWarnings: ${config.warnings.length}\n`),
    artifact(`artifact-${config.id}-deployment-env-checklist-md`, 'deployment-env-checklist.md', config.groups.map((group) => `## ${group.label}\n${group.keys.map((key) => `- ${key.key}: ${key.status}`).join('\n')}`).join('\n\n')),
    artifact(`artifact-${config.id}-deployment-blockers-json`, 'deployment-blockers.json', JSON.stringify(config.blockers, null, 2)),
    artifact(`artifact-${config.id}-production-env-readiness-md`, 'production-env-readiness.md', `# Production Env Readiness\n\nProduction ready: ${config.readiness.productionReady}\nSandbox ready: ${config.readiness.sandboxReady}\nGo-live eligible: ${config.readiness.goLiveEligible}\n`),
  ];
  const state = readState();
  writeState({ ...state, artifacts: { ...state.artifacts, ...Object.fromEntries(artifacts.map((entry) => [entry.id, entry])) }, activeConfigId: config.id });
  return clone(artifacts);
}

export function getDeploymentConfigs(): DeploymentConfigCheck[] {
  return Object.values(readState().configs).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone);
}

export function getDeploymentConfig(configId: string): DeploymentConfigCheck | undefined {
  const config = readState().configs[configId];
  return config ? clone(config) : undefined;
}

export function getActiveDeploymentConfig(): DeploymentConfigCheck | undefined {
  const state = readState();
  const config = state.activeConfigId ? state.configs[state.activeConfigId] : undefined;
  return config ? clone(config) : undefined;
}

export function getDeploymentConfigStatus(): DeploymentValidationStatus {
  return getActiveDeploymentConfig()?.status ?? 'not_checked';
}

export function getDeploymentEnvGroups(): DeploymentEnvGroupCheck[] {
  return (getActiveDeploymentConfig()?.groups ?? []).map(clone);
}

export function getDeploymentMissingEnv(): DeploymentEnvKeyCheck[] {
  return getDeploymentEnvGroups().flatMap((group) => group.keys).filter((entry) => entry.status === 'missing');
}

export function getDeploymentWarnings(): DeploymentWarning[] {
  return getActiveDeploymentConfig()?.warnings.map(clone) ?? [];
}

export function getDeploymentBlockers(): DeploymentBlocker[] {
  return getActiveDeploymentConfig()?.blockers.map(clone) ?? [];
}

export function getDeploymentReadiness(): DeploymentReadiness {
  return getActiveDeploymentConfig()?.readiness ?? {
    sandboxReady: false,
    productionReady: false,
    runtimeCertificationPassed: false,
    productionReadinessPassed: false,
    goLiveEligible: false,
    status: 'not_checked',
    summary: 'Deployment configuration has not been checked.',
  };
}

export function getDeploymentArtifacts(): ArtifactRecord[] {
  return Object.values(readState().artifacts).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone);
}

export function getDeploymentConfigDashboard(): DeploymentConfigDashboard {
  let active = getActiveDeploymentConfig();
  if (!active) active = createDeploymentConfigCheck();
  return {
    activeConfig: active,
    configs: getDeploymentConfigs(),
    status: active.status,
    envGroups: active.groups.map(clone),
    missingEnv: active.groups.flatMap((group) => group.keys).filter((entry) => entry.status === 'missing'),
    warnings: active.warnings.map(clone),
    blockers: active.blockers.map(clone),
    readiness: clone(active.readiness),
    artifacts: getDeploymentArtifacts(),
  };
}

export function isDeploymentConfigReadyForGoLive(): boolean {
  const active = getActiveDeploymentConfig();
  return Boolean(active?.readyMarkedAt && active.status === 'valid' && active.readiness.productionReady);
}

export function clearDeploymentConfigStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(DEPLOYMENT_CONFIG_KEY);
}
