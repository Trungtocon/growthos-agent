import type { RuntimeEnvironmentId } from './environment-registry';

export type DatabaseMode = 'mock' | 'local' | 'supabase' | 'postgres' | 'production';
export type DatabaseConnectionStatus = 'connected' | 'degraded' | 'offline' | 'missing_config';
export type DatabaseMigrationStatus = 'up_to_date' | 'pending' | 'missing' | 'not_checked';
export type DatabaseReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED';

export interface DatabaseConfig {
  id: string;
  mode: DatabaseMode;
  name: string;
  connectionStatus: DatabaseConnectionStatus;
  provider: string;
  hostLabel: string;
  schemaVersion: string;
  migrationStatus: DatabaseMigrationStatus;
  lastCheckedAt: string;
  readiness: DatabaseReadinessStatus;
  warnings: string[];
  blockers: string[];
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

function hostLabel(value: string, fallback: string): string {
  if (!value) return fallback;
  try {
    const parsed = new URL(value);
    return parsed.host || fallback;
  } catch {
    return value.includes('@') ? 'configured-host' : value.slice(0, 48);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function configuredConfig(
  options: {
    id: string;
    mode: DatabaseMode;
    name: string;
    provider: string;
    url: string;
    production?: boolean;
    schemaVersion?: string;
  },
): DatabaseConfig {
  const configured = Boolean(options.url);
  const blockers = configured ? [] : [`${options.name} connection is not configured.`];
  const warnings = configured
    ? options.production ? [] : [`${options.name} is available for non-production validation only.`]
    : [`${options.name} will use mock/session storage fallback until configured.`];
  return {
    id: options.id,
    mode: options.mode,
    name: options.name,
    connectionStatus: configured ? 'degraded' : 'missing_config',
    provider: options.provider,
    hostLabel: hostLabel(options.url, 'missing host'),
    schemaVersion: configured ? options.schemaVersion ?? '2026.06.0' : 'missing',
    migrationStatus: configured ? 'pending' : 'missing',
    lastCheckedAt: nowIso(),
    readiness: configured ? 'WARNING' : 'BLOCKED',
    warnings,
    blockers,
  };
}

export function getDatabaseConfigs(): DatabaseConfig[] {
  const localUrl = envValue('LOCAL_DATABASE_URL', 'DATABASE_URL');
  const supabaseUrl = envValue('SUPABASE_URL', 'SUPABASE_DATABASE_URL');
  const postgresUrl = envValue('POSTGRES_URL', 'POSTGRES_DATABASE_URL');
  const productionUrl = envValue('PRODUCTION_DATABASE_URL', 'DATABASE_PRODUCTION_URL');
  return [
    {
      id: 'db-mock',
      mode: 'mock',
      name: 'Session Storage Mock DB',
      connectionStatus: 'connected',
      provider: 'sessionStorage',
      hostLabel: 'browser-session',
      schemaVersion: 'mock-v1',
      migrationStatus: 'up_to_date',
      lastCheckedAt: nowIso(),
      readiness: 'WARNING',
      warnings: ['Mock persistence is not suitable for production go-live.'],
      blockers: [],
    },
    configuredConfig({
      id: 'db-local',
      mode: 'local',
      name: 'Local Development Database',
      provider: 'local',
      url: localUrl,
    }),
    configuredConfig({
      id: 'db-supabase',
      mode: 'supabase',
      name: 'Supabase Database',
      provider: 'supabase',
      url: supabaseUrl,
    }),
    configuredConfig({
      id: 'db-postgres',
      mode: 'postgres',
      name: 'Postgres Database',
      provider: 'postgres',
      url: postgresUrl,
    }),
    configuredConfig({
      id: 'db-production',
      mode: 'production',
      name: 'Production Database',
      provider: 'production-postgres',
      url: productionUrl,
      production: true,
    }),
  ];
}

export function getDatabaseConfigByMode(mode: DatabaseMode): DatabaseConfig {
  return getDatabaseConfigs().find((config) => config.mode === mode) ?? getDatabaseConfigs()[0];
}

export function databaseModeForEnvironment(environmentId: RuntimeEnvironmentId): DatabaseMode {
  if (environmentId === 'LOCAL') return 'local';
  if (environmentId === 'SANDBOX') return envValue('SUPABASE_URL', 'SUPABASE_DATABASE_URL') ? 'supabase' : 'mock';
  if (environmentId === 'STAGING') return 'postgres';
  return 'production';
}

export function getDatabaseConfigForEnvironment(environmentId: RuntimeEnvironmentId): DatabaseConfig {
  return getDatabaseConfigByMode(databaseModeForEnvironment(environmentId));
}
