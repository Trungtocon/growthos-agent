import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import { selectAuditLogSummary } from './audit-log-store';
import { createDatabaseClient } from './database-client-factory';
import {
  getDatabaseConfigForEnvironment,
  getDatabaseConfigs,
  type DatabaseConfig,
  type DatabaseReadinessStatus,
} from './database-config';
import type { RuntimeEnvironmentId } from './environment-registry';
import { getPersistenceDomains, summarizePersistenceDomains, type PersistenceDomain } from './persistence-registry';

export interface DatabaseReadinessReport {
  environmentId: RuntimeEnvironmentId;
  config: DatabaseConfig;
  status: DatabaseReadinessStatus;
  readinessScore: number;
  connectionHealth: string;
  schemaVersion: string;
  migrationStatus: string;
  auditWritable: boolean;
  persistenceDomains: PersistenceDomain[];
  blockers: string[];
  warnings: string[];
  checkedAt: string;
}

const DATABASE_READINESS_KEY = 'uikigai-database-readiness-v1';

interface DatabaseReadinessState {
  reports: DatabaseReadinessReport[];
  artifacts: ArtifactRecord[];
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): DatabaseReadinessState {
  return { reports: [], artifacts: [], updatedAt: nowIso() };
}

function readState(): DatabaseReadinessState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(DATABASE_READINESS_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<DatabaseReadinessState>;
    return {
      reports: parsed.reports ?? [],
      artifacts: parsed.artifacts ?? [],
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: DatabaseReadinessState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(DATABASE_READINESS_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function calculateStatus(environmentId: RuntimeEnvironmentId, blockers: string[], warnings: string[]): DatabaseReadinessStatus {
  if (blockers.length) return 'BLOCKED';
  if (environmentId !== 'PRODUCTION' || warnings.length) return 'WARNING';
  return 'READY';
}

function calculateScore(status: DatabaseReadinessStatus, blockers: string[], warnings: string[]) {
  if (status === 'READY') return 100;
  if (status === 'WARNING') return Math.max(60, 84 - warnings.length * 2);
  return Math.max(15, 45 - blockers.length * 2);
}

export function evaluateDatabaseReadiness(environmentId: RuntimeEnvironmentId = 'PRODUCTION'): DatabaseReadinessReport {
  const config = getDatabaseConfigForEnvironment(environmentId);
  const client = createDatabaseClient(environmentId);
  const domains = getPersistenceDomains();
  const domainSummary = summarizePersistenceDomains(domains);
  const audit = selectAuditLogSummary();
  const rawBlockers = [
    ...config.blockers,
    ...domains.flatMap((domain) => domain.requiredForProduction ? domain.blockers : []),
  ];
  const rawWarnings = [
    ...config.warnings,
    ...domains.flatMap((domain) => domain.warnings),
  ];
  if (!audit.writable) rawBlockers.push('Audit log is not writable.');
  if (config.schemaVersion === 'missing') rawBlockers.push('Database schema version is missing.');
  if (config.migrationStatus === 'missing') rawBlockers.push('Database migration status is missing.');
  if (domainSummary.blockers) rawBlockers.push(`${domainSummary.blockers} persistence domains are not production-bound.`);
  const blockers = environmentId === 'PRODUCTION' ? rawBlockers : [];
  const warnings = environmentId === 'PRODUCTION'
    ? rawWarnings
    : [
      ...rawWarnings,
      ...rawBlockers.map((entry) => `${environmentId} fallback: ${entry}`),
      `${environmentId} database readiness cannot approve production go-live.`,
    ];
  const status = calculateStatus(environmentId, blockers, warnings);
  const report: DatabaseReadinessReport = {
    environmentId,
    config,
    status,
    readinessScore: calculateScore(status, blockers, warnings),
    connectionHealth: client.describe().configured ? config.connectionStatus : 'missing_config',
    schemaVersion: config.schemaVersion,
    migrationStatus: config.migrationStatus,
    auditWritable: audit.writable,
    persistenceDomains: domains,
    blockers,
    warnings,
    checkedAt: nowIso(),
  };
  const state = readState();
  writeState({
    ...state,
    reports: [report, ...state.reports.filter((entry) => entry.environmentId !== environmentId)].slice(0, 8),
  });
  return clone(report);
}

export function getDatabaseReadinessReport(environmentId: RuntimeEnvironmentId = 'PRODUCTION'): DatabaseReadinessReport {
  const state = readState();
  const report = state.reports.find((entry) => entry.environmentId === environmentId);
  return report ? clone(report) : evaluateDatabaseReadiness(environmentId);
}

function exportedArtifact(name: string, type: ArtifactRecord['type'], content: unknown): ArtifactRecord {
  const createdAt = nowIso();
  return registerArtifact({
    id: `artifact-database-readiness-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    type,
    lifecycle: 'AVAILABLE',
    workspaceId: demoWorkspace.id,
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      source: 'mock',
      sourceType: 'database-readiness',
      contentSummary: `${name} generated by database readiness layer.`,
      tags: ['database-readiness', 'persistence', 'go-live'],
      sizeBytes: JSON.stringify(content).length,
    },
    createdAt,
    updatedAt: createdAt,
  });
}

export function exportDatabaseReadinessArtifacts(environmentId: RuntimeEnvironmentId = 'PRODUCTION'): ArtifactRecord[] {
  const report = getDatabaseReadinessReport(environmentId);
  const artifacts = [
    exportedArtifact('database-readiness-report.md', 'REPORT', report),
    exportedArtifact('database-config.json', 'AUDIT', getDatabaseConfigs()),
    exportedArtifact('persistence-domain-matrix.json', 'AUDIT', report.persistenceDomains),
    exportedArtifact('audit-log-summary.md', 'REPORT', selectAuditLogSummary()),
    exportedArtifact('database-blockers.json', 'AUDIT', report.blockers),
    exportedArtifact('database-go-live-evidence.md', 'REPORT', {
      status: report.status,
      score: report.readinessScore,
      schemaVersion: report.schemaVersion,
      migrationStatus: report.migrationStatus,
      auditWritable: report.auditWritable,
    }),
  ];
  const state = readState();
  writeState({ ...state, artifacts });
  return clone(artifacts);
}

export function getDatabaseReadinessArtifacts(): ArtifactRecord[] {
  return clone(readState().artifacts);
}

export function selectDatabaseConfig() {
  return getDatabaseReadinessReport('PRODUCTION').config;
}

export function selectDatabaseHealth() {
  const report = getDatabaseReadinessReport('PRODUCTION');
  return {
    status: report.connectionHealth,
    readiness: report.status,
    score: report.readinessScore,
    checkedAt: report.checkedAt,
  };
}

export function selectDatabaseReadiness() {
  return getDatabaseReadinessReport('PRODUCTION');
}

export function selectDatabaseBlockers() {
  return getDatabaseReadinessReport('PRODUCTION').blockers;
}

export function selectDatabaseWarnings() {
  return getDatabaseReadinessReport('PRODUCTION').warnings;
}
