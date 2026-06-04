import type { DatabaseReadinessStatus } from './database-config';

export interface PersistenceDomain {
  domainId: string;
  tableName: string;
  owner: string;
  requiredForProduction: boolean;
  readiness: DatabaseReadinessStatus;
  lastSyncAt: string;
  recordCountEstimate: number;
  blockers: string[];
  warnings: string[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function domain(
  domainId: string,
  tableName: string,
  owner: string,
  requiredForProduction = true,
  recordCountEstimate = 0,
): PersistenceDomain {
  return {
    domainId,
    tableName,
    owner,
    requiredForProduction,
    readiness: requiredForProduction ? 'BLOCKED' : 'WARNING',
    lastSyncAt: nowIso(),
    recordCountEstimate,
    blockers: requiredForProduction ? [`${tableName} is not bound to a production database table.`] : [],
    warnings: [`${domainId} currently reads from browser/session runtime state.`],
  };
}

export function getPersistenceDomains(): PersistenceDomain[] {
  return [
    domain('runtime_runs', 'runtime_runs', 'runtime-orchestrator', true, 3),
    domain('artifacts', 'artifacts', 'artifact-registry', true, 12),
    domain('approvals', 'approvals', 'approval-center', true, 5),
    domain('governance_decisions', 'governance_decisions', 'governance-engine', true, 16),
    domain('workers', 'workers', 'worker-runtime', true, 4),
    domain('evaluation_results', 'evaluation_results', 'evaluation-engine', true, 6),
    domain('feedback_actions', 'feedback_actions', 'feedback-loop', true, 8),
    domain('recommendations', 'recommendations', 'learning-memory', true, 9),
    domain('audit_logs', 'audit_logs', 'audit-log-store', true, 1),
    domain('usage_ledger', 'usage_ledger', 'usage-ledger', true, 7),
    domain('cost_reports', 'cost_reports', 'cost-reconciliation', true, 4),
    domain('pre_golive_reports', 'pre_golive_reports', 'pre-golive-validation', true, 2),
  ];
}

export function getRequiredPersistenceDomains(): PersistenceDomain[] {
  return getPersistenceDomains().filter((domainEntry) => domainEntry.requiredForProduction);
}

export function summarizePersistenceDomains(domains = getPersistenceDomains()) {
  return {
    total: domains.length,
    required: domains.filter((domainEntry) => domainEntry.requiredForProduction).length,
    ready: domains.filter((domainEntry) => domainEntry.readiness === 'READY').length,
    warnings: domains.reduce((sum, domainEntry) => sum + domainEntry.warnings.length, 0),
    blockers: domains.reduce((sum, domainEntry) => sum + domainEntry.blockers.length, 0),
  };
}
