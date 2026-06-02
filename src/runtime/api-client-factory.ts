import {
  getEnvironmentById,
  type RuntimeEnvironment,
  type RuntimeEnvironmentId,
} from './environment-registry';

export interface ApiClientResult {
  ok: boolean;
  environmentId: RuntimeEnvironmentId;
  status: 'mock_response' | 'ready' | 'blocked';
  message: string;
  data?: unknown;
}

export interface RuntimeApiClient {
  environment: RuntimeEnvironment;
  describe(): { environmentId: RuntimeEnvironmentId; mode: string; baseUrlConfigured: boolean };
  request(path: string, options?: { method?: string; body?: unknown }): Promise<ApiClientResult>;
}

function createClient(environment: RuntimeEnvironment): RuntimeApiClient {
  return {
    environment,
    describe() {
      return {
        environmentId: environment.id,
        mode: environment.id.toLowerCase(),
        baseUrlConfigured: Boolean(environment.baseUrl),
      };
    },
    async request(path: string, options = {}) {
      if (environment.id === 'LOCAL') {
        return {
          ok: true,
          environmentId: environment.id,
          status: 'mock_response',
          message: `Mock ${options.method ?? 'GET'} ${path} completed locally.`,
          data: { path, body: options.body ?? null },
        };
      }
      if (!environment.baseUrl) {
        return {
          ok: false,
          environmentId: environment.id,
          status: 'blocked',
          message: `${environment.name} base URL is not configured.`,
        };
      }
      return {
        ok: true,
        environmentId: environment.id,
        status: 'ready',
        message: `${environment.name} client is configured for ${path}. Real network execution is deferred to backend gateway.`,
      };
    },
  };
}

export function createApiClient(environmentId: RuntimeEnvironmentId): RuntimeApiClient {
  return createClient(getEnvironmentById(environmentId));
}

