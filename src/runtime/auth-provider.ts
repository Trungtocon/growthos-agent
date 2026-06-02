import { getEnvironmentById, type EnvironmentAuthMode, type RuntimeEnvironmentId } from './environment-registry';

export interface AuthProviderStatus {
  environmentId: RuntimeEnvironmentId;
  mode: EnvironmentAuthMode;
  status: 'valid' | 'missing_config' | 'not_required';
  label: string;
  reason: string;
}

function runtimeEnv(): Record<string, string | undefined> {
  return (import.meta.env ?? {}) as Record<string, string | undefined>;
}

function hasAnyEnv(keys: string[]): boolean {
  const env = runtimeEnv();
  return keys.some((key) => Boolean(env[key] ?? env[`VITE_${key}`]));
}

function keysFor(mode: EnvironmentAuthMode, environmentId: RuntimeEnvironmentId): string[] {
  if (mode === 'api_key') return [`${environmentId}_API_KEY`, 'BACKEND_API_KEY', 'HERMES_SANDBOX_API_KEY'];
  if (mode === 'jwt') return [`${environmentId}_JWT`, 'BACKEND_JWT'];
  if (mode === 'oauth2') return [`${environmentId}_OAUTH_CLIENT_ID`, `${environmentId}_OAUTH_ISSUER`, 'OAUTH_CLIENT_ID'];
  return [];
}

export function validateAuthProvider(environmentId: RuntimeEnvironmentId): AuthProviderStatus {
  const environment = getEnvironmentById(environmentId);
  if (environment.authMode === 'none') {
    return {
      environmentId,
      mode: 'none',
      status: 'not_required',
      label: 'No auth required',
      reason: 'Local mock runtime does not require credentials.',
    };
  }
  const configured = hasAnyEnv(keysFor(environment.authMode, environmentId));
  return {
    environmentId,
    mode: environment.authMode,
    status: configured ? 'valid' : 'missing_config',
    label: environment.authMode === 'api_key' ? 'API key' : environment.authMode === 'jwt' ? 'JWT' : 'OAuth2',
    reason: configured ? `${environment.authMode} configuration is present.` : `${environment.name} requires ${environment.authMode} config; no secret is stored in source code.`,
  };
}

