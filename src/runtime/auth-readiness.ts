import {
  getAuthProviderRequiredEnvKeys,
  validateAuthProvider,
  type AuthProviderStatus,
} from './auth-provider';
import { getEnvironmentById, type RuntimeEnvironmentId } from './environment-registry';

export type AuthReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED';
export type AuthCheckStatus = 'ready' | 'warning' | 'blocked';
export type SessionLifecycleStatus = 'local_mock' | 'configured' | 'missing_store' | 'blocked';

export interface AuthReadinessCheck {
  id: string;
  label: string;
  status: AuthCheckStatus;
  reason: string;
  requiredEnv: string[];
}

export interface AuthReadinessSnapshot {
  id: string;
  environmentId: RuntimeEnvironmentId;
  environmentName: string;
  status: AuthReadinessStatus;
  readinessScore: number;
  provider: AuthProviderStatus;
  sessionLifecycle: AuthReadinessCheck & { lifecycleStatus: SessionLifecycleStatus };
  tokenValidation: AuthReadinessCheck;
  rbacBinding: AuthReadinessCheck;
  tenantWorkspaceBinding: AuthReadinessCheck;
  blockers: string[];
  warnings: string[];
  checkedAt: string;
}

function runtimeEnv(): Record<string, string | undefined> {
  return (import.meta.env ?? {}) as Record<string, string | undefined>;
}

function envValue(...keys: string[]): string {
  const env = runtimeEnv();
  for (const key of keys) {
    const value = env[key] ?? env[`VITE_${key}`];
    if (value) return value;
  }
  return '';
}

function hasAnyEnv(keys: string[]): boolean {
  return keys.some((key) => Boolean(envValue(key)));
}

function checkFromEnv(
  id: string,
  label: string,
  requiredEnv: string[],
  productionReason: string,
  environmentId: RuntimeEnvironmentId,
): AuthReadinessCheck {
  const configured = hasAnyEnv(requiredEnv);
  if (configured) {
    return { id, label, status: 'ready', reason: `${label} configuration is present.`, requiredEnv };
  }
  if (environmentId !== 'PRODUCTION') {
    return {
      id,
      label,
      status: 'warning',
      reason: `${label} is not configured for ${environmentId}; mock/session fallback remains active.`,
      requiredEnv,
    };
  }
  return { id, label, status: 'blocked', reason: productionReason, requiredEnv };
}

export function evaluateSessionLifecycle(environmentId: RuntimeEnvironmentId): AuthReadinessSnapshot['sessionLifecycle'] {
  const requiredEnv = ['SESSION_STORE', 'AUTH_SESSION_DRIVER', 'SESSION_COOKIE_SECURE'];
  const configured = hasAnyEnv(requiredEnv);
  if (environmentId === 'LOCAL') {
    return {
      id: 'session-lifecycle',
      label: 'Session lifecycle',
      status: 'warning',
      lifecycleStatus: 'local_mock',
      reason: 'Local runtime uses mock session state and does not require a production session store.',
      requiredEnv,
    };
  }
  if (configured) {
    return {
      id: 'session-lifecycle',
      label: 'Session lifecycle',
      status: 'ready',
      lifecycleStatus: 'configured',
      reason: 'Session store or secure session driver is configured.',
      requiredEnv,
    };
  }
  if (environmentId !== 'PRODUCTION') {
    return {
      id: 'session-lifecycle',
      label: 'Session lifecycle',
      status: 'warning',
      lifecycleStatus: 'missing_store',
      reason: `${environmentId} can continue with mock session fallback, but production cannot.`,
      requiredEnv,
    };
  }
  return {
    id: 'session-lifecycle',
    label: 'Session lifecycle',
    status: 'blocked',
    lifecycleStatus: 'blocked',
    reason: 'Production requires a session store or secure session driver before go-live.',
    requiredEnv,
  };
}

export function evaluateTokenValidation(environmentId: RuntimeEnvironmentId): AuthReadinessCheck {
  return checkFromEnv(
    'token-validation',
    'Token validation',
    ['AUTH_SECRET', 'JWT_PUBLIC_KEY', 'TOKEN_VALIDATION_JWKS_URL', 'PRODUCTION_OAUTH_ISSUER', 'PRODUCTION_OAUTH_CLIENT_ID'],
    'Production requires token validation config such as JWKS, JWT public key, OAuth issuer, or auth secret.',
    environmentId,
  );
}

export function evaluateRbacBinding(environmentId: RuntimeEnvironmentId): AuthReadinessCheck {
  return checkFromEnv(
    'rbac-binding',
    'RBAC binding',
    ['RBAC_PROVIDER', 'RBAC_POLICY_SOURCE', 'AUTH_RBAC_BINDING', 'AUTHZ_POLICY_URL'],
    'Production requires RBAC provider or authorization policy binding.',
    environmentId,
  );
}

export function evaluateTenantWorkspaceBinding(environmentId: RuntimeEnvironmentId): AuthReadinessCheck {
  return checkFromEnv(
    'tenant-workspace-binding',
    'Tenant/workspace binding',
    ['GROWTHOS_TENANT_ID', 'GROWTHOS_WORKSPACE_ID', 'TENANT_BOUNDARY_ID', 'WORKSPACE_BOUNDARY_ID'],
    'Production requires tenant and workspace boundary binding.',
    environmentId,
  );
}

function scoreFor(status: AuthReadinessStatus, blockers: string[], warnings: string[]) {
  if (status === 'READY') return 100;
  if (status === 'WARNING') return Math.max(62, 86 - warnings.length * 3);
  return Math.max(10, 50 - blockers.length * 5);
}

export function buildAuthReadinessSnapshot(environmentId: RuntimeEnvironmentId = 'PRODUCTION'): AuthReadinessSnapshot {
  const environment = getEnvironmentById(environmentId);
  const provider = validateAuthProvider(environmentId);
  const providerRequiredEnv = getAuthProviderRequiredEnvKeys(environmentId);
  const sessionLifecycle = evaluateSessionLifecycle(environmentId);
  const tokenValidation = evaluateTokenValidation(environmentId);
  const rbacBinding = evaluateRbacBinding(environmentId);
  const tenantWorkspaceBinding = evaluateTenantWorkspaceBinding(environmentId);
  const checks = [sessionLifecycle, tokenValidation, rbacBinding, tenantWorkspaceBinding];
  const blockers = checks.filter((check) => check.status === 'blocked').map((check) => `${check.label}: ${check.reason}`);
  const warnings = checks.filter((check) => check.status === 'warning').map((check) => `${check.label}: ${check.reason}`);

  if (provider.status === 'missing_config' && environmentId === 'PRODUCTION') {
    blockers.unshift(`Auth provider: ${provider.reason}`);
  } else if (provider.status !== 'valid' && environmentId !== 'LOCAL') {
    warnings.unshift(`Auth provider: ${provider.reason}`);
  }
  if (!providerRequiredEnv.length && environmentId === 'PRODUCTION') {
    blockers.unshift('Auth provider: production auth mode is not configured.');
  }
  if (environment.status === 'missing_config' && environmentId === 'PRODUCTION') {
    blockers.unshift('Environment: production backend URL is missing, so auth callback/session validation cannot be verified.');
  }

  const status: AuthReadinessStatus = blockers.length ? 'BLOCKED' : warnings.length || environmentId !== 'PRODUCTION' ? 'WARNING' : 'READY';
  return {
    id: `auth-readiness-${environmentId.toLowerCase()}`,
    environmentId,
    environmentName: environment.name,
    status,
    readinessScore: scoreFor(status, blockers, warnings),
    provider,
    sessionLifecycle,
    tokenValidation,
    rbacBinding,
    tenantWorkspaceBinding,
    blockers,
    warnings,
    checkedAt: new Date().toISOString(),
  };
}
