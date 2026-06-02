export type RuntimeEnvironmentId = 'LOCAL' | 'SANDBOX' | 'STAGING' | 'PRODUCTION';
export type EnvironmentAuthMode = 'none' | 'api_key' | 'jwt' | 'oauth2';
export type EnvironmentStatus = 'online' | 'degraded' | 'offline' | 'missing_config';

export interface RuntimeEnvironment {
  id: RuntimeEnvironmentId;
  name: string;
  baseUrl: string;
  healthEndpoint: string;
  authMode: EnvironmentAuthMode;
  status: EnvironmentStatus;
}

const ENV_KEY = 'uikigai-active-backend-environment-v1';

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

function statusFor(baseUrl: string, fallback: EnvironmentStatus = 'missing_config'): EnvironmentStatus {
  return baseUrl ? 'degraded' : fallback;
}

export function getEnvironmentRegistry(): RuntimeEnvironment[] {
  const sandboxUrl = envValue('SANDBOX_BACKEND_URL', 'HERMES_SANDBOX_BASE_URL');
  const stagingUrl = envValue('STAGING_BACKEND_URL');
  const productionUrl = envValue('PRODUCTION_BACKEND_URL', 'HERMES_PRODUCTION_BASE_URL');
  return [
    {
      id: 'LOCAL',
      name: 'Local Mock Runtime',
      baseUrl: envValue('APP_BASE_URL') || 'http://127.0.0.1:5173',
      healthEndpoint: '/health',
      authMode: 'none',
      status: 'online',
    },
    {
      id: 'SANDBOX',
      name: 'Hermes Sandbox Runtime',
      baseUrl: sandboxUrl,
      healthEndpoint: '/health',
      authMode: 'api_key',
      status: statusFor(sandboxUrl),
    },
    {
      id: 'STAGING',
      name: 'GrowthOS Staging Backend',
      baseUrl: stagingUrl,
      healthEndpoint: '/health',
      authMode: 'jwt',
      status: statusFor(stagingUrl),
    },
    {
      id: 'PRODUCTION',
      name: 'GrowthOS Production Backend',
      baseUrl: productionUrl,
      healthEndpoint: '/health',
      authMode: 'oauth2',
      status: statusFor(productionUrl),
    },
  ];
}

export function getEnvironmentById(environmentId: RuntimeEnvironmentId): RuntimeEnvironment {
  return getEnvironmentRegistry().find((environment) => environment.id === environmentId) ?? getEnvironmentRegistry()[0];
}

export function getActiveEnvironmentId(): RuntimeEnvironmentId {
  if (typeof window === 'undefined') return 'LOCAL';
  const stored = window.sessionStorage.getItem(ENV_KEY) as RuntimeEnvironmentId | null;
  if (stored && ['LOCAL', 'SANDBOX', 'STAGING', 'PRODUCTION'].includes(stored)) return stored;
  const configured = envValue('BACKEND_ENV', 'HERMES_RUNTIME_MODE').toUpperCase();
  if (configured === 'SANDBOX' || configured === 'STAGING' || configured === 'PRODUCTION') return configured;
  return 'LOCAL';
}

export function setActiveEnvironment(environmentId: RuntimeEnvironmentId): RuntimeEnvironment {
  if (typeof window !== 'undefined') window.sessionStorage.setItem(ENV_KEY, environmentId);
  return getEnvironmentById(environmentId);
}

export function getActiveEnvironment(): RuntimeEnvironment {
  return getEnvironmentById(getActiveEnvironmentId());
}

