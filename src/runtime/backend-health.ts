import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import { validateAuthProvider, type AuthProviderStatus } from './auth-provider';
import { getEndpointRegistry, type BackendEndpointDefinition } from './endpoint-registry';
import {
  getEnvironmentById,
  getEnvironmentRegistry,
  type RuntimeEnvironment,
  type RuntimeEnvironmentId,
} from './environment-registry';
import { getDatabaseReadinessReport, type DatabaseReadinessReport } from './database-readiness';
import { filterReadinessBlockersForEvidence } from './production-config-evidence-store';
import { selectObservabilityDashboard } from './production-observability-store';

export interface BackendHealthReport {
  environment: RuntimeEnvironment;
  status: 'online' | 'degraded' | 'offline' | 'missing_config';
  latencyMs: number;
  availability: number;
  auth: AuthProviderStatus;
  endpointReachability: Array<BackendEndpointDefinition & { reachable: boolean; reason: string }>;
  databaseReadiness?: Pick<DatabaseReadinessReport, 'status' | 'readinessScore' | 'schemaVersion' | 'migrationStatus'>;
  observabilityReadiness?: { verdict: string; readinessScore: number; blockers: number };
  readinessScore: number;
  blockers: string[];
  warnings: string[];
  checkedAt: string;
}

const BACKEND_HEALTH_KEY = 'uikigai-backend-health-v1';

interface BackendHealthState {
  reports: BackendHealthReport[];
  artifacts: ArtifactRecord[];
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): BackendHealthState {
  return { reports: [], artifacts: [], updatedAt: nowIso() };
}

function readState(): BackendHealthState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(BACKEND_HEALTH_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<BackendHealthState>;
    return { reports: parsed.reports ?? [], artifacts: parsed.artifacts ?? [], updatedAt: parsed.updatedAt ?? nowIso() };
  } catch {
    return emptyState();
  }
}

function writeState(state: BackendHealthState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(BACKEND_HEALTH_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

export function checkBackendReadiness(environmentId: RuntimeEnvironmentId = 'PRODUCTION'): BackendHealthReport {
  const environment = getEnvironmentById(environmentId);
  const auth = validateAuthProvider(environmentId);
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!environment.baseUrl) blockers.push(`${environment.name} base URL is not configured.`);
  if (auth.status === 'missing_config') blockers.push(auth.reason);
  if (environment.id !== 'PRODUCTION') warnings.push(`${environment.name} is not production; keep go-live in review mode.`);
  const endpointReachability = getEndpointRegistry().map((endpoint) => ({
    ...endpoint,
    status: environment.baseUrl ? 'degraded' as const : 'missing_config' as const,
    reachable: Boolean(environment.baseUrl),
    reason: environment.baseUrl ? `${endpoint.owner} endpoint is configured for gateway binding.` : 'Backend base URL missing.',
  }));
  const databaseReadiness = getDatabaseReadinessReport(environmentId);
  const observability = selectObservabilityDashboard();
  if (databaseReadiness.status === 'BLOCKED') blockers.push(`Database readiness is blocked: ${databaseReadiness.blockers[0] ?? 'production database is not configured.'}`);
  if (databaseReadiness.status === 'WARNING') warnings.push(`Database readiness warning: ${databaseReadiness.warnings[0] ?? 'database is not production ready.'}`);
  const missingEndpoints = endpointReachability.filter((endpoint) => !endpoint.reachable).length;
  const status = blockers.length ? 'missing_config' : warnings.length ? 'degraded' : 'online';
  const readinessScore = blockers.length ? 25 : warnings.length ? 78 : 100;
  const report: BackendHealthReport = {
    environment,
    status,
    latencyMs: environment.baseUrl ? 42 : 0,
    availability: environment.baseUrl ? 99.5 : 0,
    auth,
    endpointReachability,
    databaseReadiness: {
      status: databaseReadiness.status,
      readinessScore: databaseReadiness.readinessScore,
      schemaVersion: databaseReadiness.schemaVersion,
      migrationStatus: databaseReadiness.migrationStatus,
    },
    observabilityReadiness: {
      verdict: observability.verdict,
      readinessScore: observability.readinessScore,
      blockers: observability.blockers.length,
    },
    readinessScore,
    blockers: blockers.concat(missingEndpoints ? [`${missingEndpoints} backend endpoints are not reachable without a base URL.`] : []),
    warnings,
    checkedAt: nowIso(),
  };
  const state = readState();
  writeState({ ...state, reports: [report, ...state.reports.filter((entry) => entry.environment.id !== environmentId)].slice(0, 8) });
  return clone(report);
}

export function getBackendReadinessReport(environmentId: RuntimeEnvironmentId = 'PRODUCTION'): BackendHealthReport {
  const state = readState();
  const report = state.reports.find((entry) => entry.environment.id === environmentId);
  return report ? clone(report) : checkBackendReadiness(environmentId);
}

export function getEvidenceAdjustedBackendReadinessReport(environmentId: RuntimeEnvironmentId = 'PRODUCTION'): BackendHealthReport {
  const report = getBackendReadinessReport(environmentId);
  if (environmentId !== 'PRODUCTION') return report;
  const blockers = filterReadinessBlockersForEvidence('backend-readiness', report.blockers);
  return {
    ...report,
    blockers,
    status: blockers.length ? report.status : report.warnings.length ? 'degraded' : 'online',
    readinessScore: blockers.length ? report.readinessScore : Math.max(report.readinessScore, 78),
  };
}

function exportedArtifact(name: string, type: ArtifactRecord['type'], content: unknown): ArtifactRecord {
  const createdAt = nowIso();
  return registerArtifact({
    id: `artifact-backend-readiness-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    type,
    lifecycle: 'AVAILABLE',
    workspaceId: demoWorkspace.id,
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      source: 'mock',
      sourceType: 'backend-readiness',
      contentSummary: `${name} generated by backend readiness layer.`,
      tags: ['backend-readiness', 'go-live'],
      sizeBytes: JSON.stringify(content).length,
    },
    createdAt,
    updatedAt: createdAt,
  });
}

export function exportBackendReadinessArtifacts(environmentId: RuntimeEnvironmentId = 'PRODUCTION'): ArtifactRecord[] {
  const report = getBackendReadinessReport(environmentId);
  const artifacts = [
    exportedArtifact('backend-readiness-report.md', 'REPORT', report),
    exportedArtifact('environment-registry.json', 'AUDIT', getEnvironmentRegistry()),
    exportedArtifact('endpoint-matrix.json', 'AUDIT', report.endpointReachability),
    exportedArtifact('backend-health-report.md', 'REPORT', report),
    exportedArtifact('auth-status.json', 'AUDIT', report.auth),
  ];
  const state = readState();
  writeState({ ...state, artifacts });
  return clone(artifacts);
}

export function getBackendReadinessArtifacts(): ArtifactRecord[] {
  return clone(readState().artifacts);
}
