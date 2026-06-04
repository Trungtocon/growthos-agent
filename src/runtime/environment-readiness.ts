import type { RuntimeEnvironmentId } from './environment-registry';

export type EnvironmentConfigGroup =
  | 'runtime'
  | 'backend'
  | 'database'
  | 'auth'
  | 'hermes'
  | 'artifact'
  | 'worker'
  | 'governance'
  | 'observability';
export type EnvironmentVariableStatus = 'PASS' | 'WARNING' | 'BLOCKED' | 'NOT_REQUIRED';
export type ReadinessSeverity = 'info' | 'warning' | 'critical';
export type EnvironmentReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED';
export type SecretCategory =
  | 'api_key'
  | 'jwt_secret'
  | 'oauth_client_secret'
  | 'database_password'
  | 'webhook_secret'
  | 'encryption_key'
  | 'service_token';

export interface RequiredEnvironmentVariable {
  key: string;
  group: EnvironmentConfigGroup;
  environment: RuntimeEnvironmentId;
  required: boolean;
  description: string;
  recommendation: string;
}

export interface EnvironmentVariableCheck extends RequiredEnvironmentVariable {
  present: boolean;
  maskedValue: string;
  status: EnvironmentVariableStatus;
  severity: ReadinessSeverity;
}

export interface SecretReadinessCheck {
  key: string;
  category: SecretCategory;
  environment: RuntimeEnvironmentId;
  required: boolean;
  present: boolean;
  maskedValue: string;
  status: EnvironmentVariableStatus;
  severity: ReadinessSeverity;
  ownerPresent: boolean;
  scopeValid: boolean;
  rotationEvidencePresent: boolean;
  clientExposed: boolean;
  hardcodedDetected: boolean;
  safeValue: boolean;
  reason: string;
  recommendation: string;
}

export interface RotationEvidenceStatus {
  status: EnvironmentVariableStatus;
  lastCheckedAt?: string;
  ownerPresent: boolean;
  scopeValid: boolean;
  reason: string;
}

export interface EnvironmentReadinessReport {
  id: string;
  environmentId: RuntimeEnvironmentId;
  status: EnvironmentReadinessStatus;
  readinessScore: number;
  variables: EnvironmentVariableCheck[];
  secrets: SecretReadinessCheck[];
  missingRequired: string[];
  blockers: string[];
  warnings: string[];
  secretStatus: EnvironmentReadinessStatus;
  rotationStatus: RotationEvidenceStatus;
  checkedAt: string;
}

const REQUIRED_PRODUCTION_VARIABLES: RequiredEnvironmentVariable[] = [
  { key: 'PRODUCTION_API_BASE_URL', group: 'backend', environment: 'PRODUCTION', required: true, description: 'Production API base URL.', recommendation: 'Configure an HTTPS production API URL.' },
  { key: 'PRODUCTION_API_TIMEOUT_MS', group: 'backend', environment: 'PRODUCTION', required: true, description: 'Production API timeout.', recommendation: 'Set a bounded production API timeout.' },
  { key: 'PRODUCTION_AUTH_MODE', group: 'auth', environment: 'PRODUCTION', required: true, description: 'Production authentication mode.', recommendation: 'Use jwt or oauth2 for production.' },
  { key: 'PRODUCTION_AUTH_PROVIDER', group: 'auth', environment: 'PRODUCTION', required: true, description: 'Production identity provider.', recommendation: 'Configure the production identity provider.' },
  { key: 'PRODUCTION_AUTH_TOKEN_ISSUER', group: 'auth', environment: 'PRODUCTION', required: true, description: 'Trusted token issuer.', recommendation: 'Configure a trusted HTTPS issuer.' },
  { key: 'PRODUCTION_AUTH_AUDIENCE', group: 'auth', environment: 'PRODUCTION', required: true, description: 'Expected token audience.', recommendation: 'Configure a production-only audience.' },
  { key: 'PRODUCTION_AUTH_JWKS_URL', group: 'auth', environment: 'PRODUCTION', required: true, description: 'JWKS validation endpoint.', recommendation: 'Configure the trusted HTTPS JWKS endpoint.' },
  { key: 'PRODUCTION_DATABASE_URL', group: 'database', environment: 'PRODUCTION', required: true, description: 'Production database connection URL.', recommendation: 'Configure the server-side production database URL.' },
  { key: 'PRODUCTION_DATABASE_PROVIDER', group: 'database', environment: 'PRODUCTION', required: true, description: 'Production database provider.', recommendation: 'Configure the supported production database provider.' },
  { key: 'PRODUCTION_SCHEMA_VERSION', group: 'database', environment: 'PRODUCTION', required: true, description: 'Approved production schema version.', recommendation: 'Record the deployed production schema version.' },
  { key: 'PRODUCTION_MIGRATION_STATUS', group: 'database', environment: 'PRODUCTION', required: true, description: 'Production migration status.', recommendation: 'Complete migrations and record up_to_date status.' },
  { key: 'HERMES_RUNTIME_MODE', group: 'hermes', environment: 'PRODUCTION', required: true, description: 'Hermes runtime mode.', recommendation: 'Configure sandbox or production Hermes mode explicitly.' },
  { key: 'HERMES_SANDBOX_BASE_URL', group: 'hermes', environment: 'PRODUCTION', required: true, description: 'Certified Hermes sandbox endpoint.', recommendation: 'Configure the certified HTTPS Hermes sandbox endpoint.' },
  { key: 'HERMES_SANDBOX_WORKSPACE_ID', group: 'hermes', environment: 'PRODUCTION', required: true, description: 'Certified Hermes sandbox workspace.', recommendation: 'Bind the certified sandbox workspace.' },
  { key: 'SECRET_ROTATION_LAST_CHECKED_AT', group: 'governance', environment: 'PRODUCTION', required: true, description: 'Last secret rotation evidence timestamp.', recommendation: 'Record recent secret rotation evidence.' },
  { key: 'SECRET_OWNER', group: 'governance', environment: 'PRODUCTION', required: true, description: 'Accountable secret owner.', recommendation: 'Assign a production secret owner.' },
  { key: 'SECRET_SCOPE', group: 'governance', environment: 'PRODUCTION', required: true, description: 'Approved production secret scope.', recommendation: 'Set secret scope to production or workspace production.' },
];

const SECRET_VARIABLES: Array<{ key: string; category: SecretCategory; required: boolean }> = [
  { key: 'PRODUCTION_API_KEY', category: 'api_key', required: true },
  { key: 'PRODUCTION_JWT_SECRET', category: 'jwt_secret', required: false },
  { key: 'PRODUCTION_AUTH_CLIENT_SECRET', category: 'oauth_client_secret', required: true },
  { key: 'PRODUCTION_DATABASE_PASSWORD', category: 'database_password', required: true },
  { key: 'PRODUCTION_WEBHOOK_SECRET', category: 'webhook_secret', required: false },
  { key: 'PRODUCTION_ENCRYPTION_KEY', category: 'encryption_key', required: true },
  { key: 'PRODUCTION_SERVICE_TOKEN', category: 'service_token', required: true },
];

function runtimeEnv(): Record<string, string | undefined> {
  return (import.meta.env ?? {}) as Record<string, string | undefined>;
}

function valueFor(values: Record<string, string | undefined>, key: string): string {
  return values[key] ?? values[`VITE_${key}`] ?? '';
}

function maskValue(value: string): string {
  return value ? `******** (${value.length} chars)` : 'not configured';
}

function unsafeValue(value: string): boolean {
  return /localhost|127\.0\.0\.1|mock|demo|example|changeme|placeholder|test-secret/i.test(value);
}

function isSecretClientExposed(values: Record<string, string | undefined>, key: string): boolean {
  return Boolean(values[`VITE_${key}`]);
}

function variableStatus(environmentId: RuntimeEnvironmentId, present: boolean, value: string): EnvironmentVariableStatus {
  if (environmentId !== 'PRODUCTION') return present ? 'PASS' : 'NOT_REQUIRED';
  if (!present || unsafeValue(value)) return 'BLOCKED';
  return 'PASS';
}

function checkVariable(
  definition: RequiredEnvironmentVariable,
  environmentId: RuntimeEnvironmentId,
  values: Record<string, string | undefined>,
): EnvironmentVariableCheck {
  const value = valueFor(values, definition.key);
  const present = Boolean(value.trim());
  const status = variableStatus(environmentId, present, value);
  return {
    ...definition,
    environment: environmentId,
    required: environmentId === 'PRODUCTION' ? definition.required : false,
    present,
    maskedValue: maskValue(value),
    status,
    severity: status === 'BLOCKED' ? 'critical' : status === 'NOT_REQUIRED' ? 'info' : 'info',
    recommendation: status === 'BLOCKED' && present && unsafeValue(value)
      ? `Replace unsafe mock/demo/localhost value for ${definition.key}.`
      : definition.recommendation,
  };
}

function validScope(value: string): boolean {
  return /^(production|prod|workspace-production|tenant-production)$/i.test(value);
}

function checkSecret(
  definition: (typeof SECRET_VARIABLES)[number],
  environmentId: RuntimeEnvironmentId,
  values: Record<string, string | undefined>,
): SecretReadinessCheck {
  const value = valueFor(values, definition.key);
  const present = Boolean(value.trim());
  const ownerPresent = Boolean(valueFor(values, 'SECRET_OWNER').trim());
  const scopeValid = validScope(valueFor(values, 'SECRET_SCOPE'));
  const rotationEvidencePresent = Boolean(valueFor(values, 'SECRET_ROTATION_LAST_CHECKED_AT').trim());
  const clientExposed = isSecretClientExposed(values, definition.key);
  const hardcodedDetected = false;
  const safeValue = present && !unsafeValue(value);
  const required = environmentId === 'PRODUCTION' ? definition.required : false;
  const productionBlocked = environmentId === 'PRODUCTION'
    && (required && !present || present && (!safeValue || clientExposed) || !ownerPresent || !scopeValid || !rotationEvidencePresent);
  const status: EnvironmentVariableStatus = environmentId !== 'PRODUCTION'
    ? present ? 'WARNING' : 'NOT_REQUIRED'
    : productionBlocked ? 'BLOCKED' : present ? 'PASS' : 'NOT_REQUIRED';
  const reasons = [
    required && !present ? 'required secret is missing' : '',
    present && !safeValue ? 'secret uses an unsafe demo/mock value' : '',
    clientExposed ? 'secret is exposed through a VITE_ client variable' : '',
    !ownerPresent ? 'secret owner is missing' : '',
    !scopeValid ? 'secret scope is invalid or missing' : '',
    !rotationEvidencePresent ? 'rotation evidence is missing' : '',
  ].filter(Boolean);
  return {
    key: definition.key,
    category: definition.category,
    environment: environmentId,
    required,
    present,
    maskedValue: maskValue(value),
    status,
    severity: status === 'BLOCKED' ? 'critical' : status === 'WARNING' ? 'warning' : 'info',
    ownerPresent,
    scopeValid,
    rotationEvidencePresent,
    clientExposed,
    hardcodedDetected,
    safeValue,
    reason: reasons.join('; ') || 'Secret safety evidence is present.',
    recommendation: 'Store the secret server-side, assign an owner/scope, and maintain rotation evidence.',
  };
}

function rotationStatus(environmentId: RuntimeEnvironmentId, values: Record<string, string | undefined>): RotationEvidenceStatus {
  const lastCheckedAt = valueFor(values, 'SECRET_ROTATION_LAST_CHECKED_AT');
  const ownerPresent = Boolean(valueFor(values, 'SECRET_OWNER').trim());
  const scopeValid = validScope(valueFor(values, 'SECRET_SCOPE'));
  if (environmentId !== 'PRODUCTION') {
    return { status: lastCheckedAt ? 'WARNING' : 'NOT_REQUIRED', lastCheckedAt: lastCheckedAt || undefined, ownerPresent, scopeValid, reason: 'Rotation evidence is enforced at production readiness.' };
  }
  const status = lastCheckedAt && ownerPresent && scopeValid ? 'PASS' : 'BLOCKED';
  return {
    status,
    lastCheckedAt: lastCheckedAt || undefined,
    ownerPresent,
    scopeValid,
    reason: status === 'PASS' ? 'Production rotation evidence, owner, and scope are present.' : 'Production secret rotation evidence, owner, or scope is missing.',
  };
}

function scoreFor(status: EnvironmentReadinessStatus, blockers: string[], warnings: string[]): number {
  if (status === 'READY') return 100;
  if (status === 'WARNING') return Math.max(60, 88 - warnings.length * 2);
  return Math.max(10, 50 - blockers.length * 2);
}

export function getRequiredProductionEnvMatrix(): RequiredEnvironmentVariable[] {
  return REQUIRED_PRODUCTION_VARIABLES.map((entry) => ({ ...entry }));
}

export function buildEnvironmentReadinessReport(
  environmentId: RuntimeEnvironmentId = 'PRODUCTION',
  providedValues?: Record<string, string | undefined>,
): EnvironmentReadinessReport {
  const values = providedValues ?? runtimeEnv();
  const variables = REQUIRED_PRODUCTION_VARIABLES.map((definition) => checkVariable(definition, environmentId, values));
  const secrets = SECRET_VARIABLES.map((definition) => checkSecret(definition, environmentId, values));
  const rotation = rotationStatus(environmentId, values);
  const missingRequired = variables.filter((entry) => entry.required && !entry.present).map((entry) => entry.key);
  const blockers = environmentId === 'PRODUCTION'
    ? [
      ...variables.filter((entry) => entry.status === 'BLOCKED').map((entry) => `${entry.key}: ${entry.recommendation}`),
      ...secrets.filter((entry) => entry.status === 'BLOCKED').map((entry) => `${entry.key}: ${entry.reason}`),
      ...(rotation.status === 'BLOCKED' ? [`Secret rotation: ${rotation.reason}`] : []),
    ]
    : [];
  const warnings = environmentId === 'PRODUCTION'
    ? secrets.filter((entry) => entry.status === 'WARNING').map((entry) => `${entry.key}: ${entry.reason}`)
    : [`${environmentId} readiness does not approve production deployment.`];
  const status: EnvironmentReadinessStatus = blockers.length ? 'BLOCKED' : warnings.length || environmentId !== 'PRODUCTION' ? 'WARNING' : 'READY';
  const secretStatus: EnvironmentReadinessStatus = secrets.some((entry) => entry.status === 'BLOCKED') || rotation.status === 'BLOCKED'
    ? 'BLOCKED'
    : secrets.some((entry) => entry.status === 'WARNING') ? 'WARNING' : 'READY';
  return {
    id: `environment-readiness-${environmentId.toLowerCase()}`,
    environmentId,
    status,
    readinessScore: scoreFor(status, blockers, warnings),
    variables,
    secrets,
    missingRequired,
    blockers,
    warnings,
    secretStatus,
    rotationStatus: rotation,
    checkedAt: new Date().toISOString(),
  };
}
