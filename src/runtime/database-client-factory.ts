import { appendAuditEvent } from './audit-log-store';
import {
  getDatabaseConfigForEnvironment,
  type DatabaseConfig,
  type DatabaseConnectionStatus,
  type DatabaseMode,
} from './database-config';
import type { RuntimeEnvironmentId } from './environment-registry';

export interface DatabaseClientResult<T = unknown> {
  status: DatabaseConnectionStatus;
  mode: DatabaseMode;
  environmentId: RuntimeEnvironmentId;
  degraded: boolean;
  message: string;
  data?: T;
}

export interface DatabaseClientDescription {
  environmentId: RuntimeEnvironmentId;
  mode: DatabaseMode;
  provider: string;
  hostLabel: string;
  configured: boolean;
  schemaVersion: string;
}

export interface DatabaseClient {
  describe(): DatabaseClientDescription;
  healthCheck(): Promise<DatabaseClientResult<DatabaseConfig>>;
  read(domainId: string, id: string): Promise<DatabaseClientResult<{ domainId: string; id: string }>>;
  write(domainId: string, payload: unknown): Promise<DatabaseClientResult<{ domainId: string; payload: unknown }>>;
  upsert(domainId: string, id: string, payload: unknown): Promise<DatabaseClientResult<{ domainId: string; id: string; payload: unknown }>>;
  query(domainId: string, queryText: string): Promise<DatabaseClientResult<{ domainId: string; queryText: string }>>;
  audit(action: string, metadata?: Record<string, unknown>): Promise<DatabaseClientResult>;
}

function result<T>(environmentId: RuntimeEnvironmentId, config: DatabaseConfig, action: string, data?: T): DatabaseClientResult<T> {
  const degraded = config.connectionStatus !== 'connected';
  const status = config.connectionStatus;
  appendAuditEvent({
    actor: 'database-client-factory',
    action,
    targetType: 'database',
    targetId: config.id,
    environment: environmentId,
    status: status === 'missing_config' ? 'blocked' : degraded ? 'warning' : 'success',
    metadata: { mode: config.mode, provider: config.provider },
  });
  return {
    status,
    mode: config.mode,
    environmentId,
    degraded,
    message: degraded
      ? `${config.name} is ${status}; real persistence is not available yet.`
      : `${config.name} is ready for persistence operations.`,
    data,
  };
}

export function createDatabaseClient(environmentId: RuntimeEnvironmentId): DatabaseClient {
  const config = getDatabaseConfigForEnvironment(environmentId);
  return {
    describe: () => ({
      environmentId,
      mode: config.mode,
      provider: config.provider,
      hostLabel: config.hostLabel,
      configured: config.connectionStatus !== 'missing_config',
      schemaVersion: config.schemaVersion,
    }),
    healthCheck: async () => result(environmentId, config, 'database.health_check', config),
    read: async (domainId, id) => result(environmentId, config, 'database.read', { domainId, id }),
    write: async (domainId, payload) => result(environmentId, config, 'database.write', { domainId, payload }),
    upsert: async (domainId, id, payload) => result(environmentId, config, 'database.upsert', { domainId, id, payload }),
    query: async (domainId, queryText) => result(environmentId, config, 'database.query', { domainId, queryText }),
    audit: async (action, metadata) => {
      appendAuditEvent({
        actor: 'database-client-factory',
        action,
        targetType: 'database',
        targetId: config.id,
        environment: environmentId,
        status: config.connectionStatus === 'missing_config' ? 'blocked' : 'success',
        metadata: metadata ?? {},
      });
      return result(environmentId, config, 'database.audit');
    },
  };
}
