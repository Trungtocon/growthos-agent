import type { Artifact } from '../domain/types';
import {
  artifactVersionFromRecord,
  matchesArtifactSearch,
  normalizeArtifactRecord,
  sortArtifactRecords,
  type ArtifactLifecycle,
  type ArtifactMetadata,
  type ArtifactRecord,
  type ArtifactRecordType,
  type ArtifactSearchFilters,
  type ArtifactVersion,
} from './artifact-registry';

const ARTIFACT_REGISTRY_KEY = 'uikigai-artifact-registry-v1';

interface ArtifactRegistryState {
  artifacts: Record<string, ArtifactRecord>;
  versions: Record<string, ArtifactVersion[]>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): ArtifactRegistryState {
  return {
    artifacts: {},
    versions: {},
    updatedAt: new Date().toISOString(),
  };
}

function readState(): ArtifactRegistryState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(ARTIFACT_REGISTRY_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ArtifactRegistryState>;
    return {
      artifacts: parsed.artifacts ?? {},
      versions: parsed.versions ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ArtifactRegistryState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ARTIFACT_REGISTRY_KEY, JSON.stringify(state));
}

function isArtifactRecord(input: Artifact | ArtifactRecord): input is ArtifactRecord {
  return 'lifecycle' in input && 'workspaceId' in input && 'metadata' in input;
}

function toRecord(
  artifact: Artifact | ArtifactRecord,
  options: {
    workspaceId?: string;
    lifecycle?: ArtifactLifecycle;
    type?: ArtifactRecordType;
    metadata?: Partial<ArtifactMetadata>;
  } = {},
): ArtifactRecord {
  if (isArtifactRecord(artifact)) {
    return {
      ...artifact,
      lifecycle: options.lifecycle ?? artifact.lifecycle,
      type: options.type ?? artifact.type,
      metadata: { ...artifact.metadata, ...options.metadata },
      updatedAt: new Date().toISOString(),
    };
  }
  const record = normalizeArtifactRecord(artifact, options);
  return {
    ...record,
    metadata: { ...record.metadata, ...options.metadata },
  };
}

export function registerArtifact(
  artifact: Artifact | ArtifactRecord,
  options: {
    workspaceId?: string;
    lifecycle?: ArtifactLifecycle;
    type?: ArtifactRecordType;
    metadata?: Partial<ArtifactMetadata>;
    createdBy?: string;
  } = {},
): ArtifactRecord {
  const state = readState();
  const incoming = toRecord(artifact, options);
  const existing = state.artifacts[incoming.id];
  const now = new Date().toISOString();
  const nextVersion = existing ? existing.version : incoming.version;
  const record: ArtifactRecord = {
    ...incoming,
    createdAt: existing?.createdAt ?? incoming.createdAt,
    version: nextVersion,
    metadata: { ...(existing?.metadata ?? {}), ...incoming.metadata, ...options.metadata },
    updatedAt: now,
  };
  const versions = state.versions[record.id]?.length
    ? state.versions[record.id]
    : [artifactVersionFromRecord(record, options.createdBy)];
  writeState({
    artifacts: { ...state.artifacts, [record.id]: record },
    versions: { ...state.versions, [record.id]: versions },
    updatedAt: now,
  });
  return clone(record);
}

export function createVersion(
  artifactId: string,
  metadata: Partial<ArtifactMetadata> = {},
  options: { lifecycle?: ArtifactLifecycle; createdBy?: string } = {},
): ArtifactVersion {
  const state = readState();
  const existing = state.artifacts[artifactId];
  if (!existing) throw new Error(`Cannot create artifact version for missing artifact: ${artifactId}`);
  const now = new Date().toISOString();
  const version = existing.version + 1;
  const record: ArtifactRecord = {
    ...existing,
    version,
    lifecycle: options.lifecycle ?? existing.lifecycle,
    metadata: { ...existing.metadata, ...metadata },
    updatedAt: now,
  };
  const nextVersion = artifactVersionFromRecord(record, options.createdBy);
  writeState({
    artifacts: { ...state.artifacts, [artifactId]: record },
    versions: { ...state.versions, [artifactId]: [nextVersion, ...(state.versions[artifactId] ?? [])] },
    updatedAt: now,
  });
  return clone(nextVersion);
}

export function archiveArtifact(artifactId: string): ArtifactRecord | undefined {
  return updateLifecycle(artifactId, 'ARCHIVED');
}

export function deleteArtifact(artifactId: string): ArtifactRecord | undefined {
  return updateLifecycle(artifactId, 'DELETED');
}

function updateLifecycle(artifactId: string, lifecycle: ArtifactLifecycle): ArtifactRecord | undefined {
  const state = readState();
  const existing = state.artifacts[artifactId];
  if (!existing) return undefined;
  const now = new Date().toISOString();
  const record = { ...existing, lifecycle, updatedAt: now };
  writeState({
    artifacts: { ...state.artifacts, [artifactId]: record },
    versions: state.versions,
    updatedAt: now,
  });
  return clone(record);
}

export function updateMetadata(artifactId: string, metadata: Partial<ArtifactMetadata>): ArtifactRecord | undefined {
  const state = readState();
  const existing = state.artifacts[artifactId];
  if (!existing) return undefined;
  const now = new Date().toISOString();
  const record = {
    ...existing,
    metadata: { ...existing.metadata, ...metadata },
    updatedAt: now,
  };
  writeState({
    artifacts: { ...state.artifacts, [artifactId]: record },
    versions: state.versions,
    updatedAt: now,
  });
  return clone(record);
}

export function selectArtifactById(artifactId: string): ArtifactRecord | undefined {
  const record = readState().artifacts[artifactId];
  return record ? clone(record) : undefined;
}

export function selectArtifactsByRun(runId: string): ArtifactRecord[] {
  return searchArtifacts({ runId });
}

export function selectArtifactsByWorkspace(workspaceId: string): ArtifactRecord[] {
  return searchArtifacts({ workspaceId });
}

export function selectArtifactVersions(artifactId: string): ArtifactVersion[] {
  return clone(readState().versions[artifactId] ?? []);
}

export function selectRecentArtifacts(limit = 10): ArtifactRecord[] {
  return searchArtifacts({ sortBy: 'createdAt', sortDirection: 'desc' }).slice(0, limit);
}

export function searchArtifacts(filters: ArtifactSearchFilters = {}): ArtifactRecord[] {
  const records = Object.values(readState().artifacts).filter((record) => matchesArtifactSearch(record, filters));
  return sortArtifactRecords(records, filters);
}

export function ensureArtifactsRegistered(artifacts: Artifact[], workspaceId?: string): ArtifactRecord[] {
  return artifacts.map((artifact) => registerArtifact(artifact, { workspaceId }));
}

export function exportArtifactRegistryJson(): string {
  const state = readState();
  return JSON.stringify({ generatedAt: new Date().toISOString(), artifacts: Object.values(state.artifacts), versions: state.versions }, null, 2);
}

export function exportArtifactSummaryMarkdown(): string {
  const records = searchArtifacts();
  const lines = [
    '# Artifact Registry Summary',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Artifacts: ${records.length}`,
    '',
    '| Artifact | Type | Workspace | Run | Status | Version |',
    '|---|---|---|---|---|---:|',
    ...records.map((record) => `| ${record.name} | ${record.type} | ${record.workspaceId} | ${record.runId ?? '-'} | ${record.lifecycle} | ${record.version} |`),
  ];
  return `${lines.join('\n')}\n`;
}

export function exportArtifactHealthReportMarkdown(): string {
  const records = searchArtifacts();
  const deleted = records.filter((record) => record.lifecycle === 'DELETED').length;
  const archived = records.filter((record) => record.lifecycle === 'ARCHIVED').length;
  const missingRun = records.filter((record) => !record.runId).length;
  const lines = [
    '# Artifact Health Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Check | Result |',
    '|---|---|',
    `| Available artifacts | ${records.filter((record) => record.lifecycle === 'AVAILABLE').length} |`,
    `| Archived artifacts | ${archived} |`,
    `| Deleted artifacts | ${deleted} |`,
    `| Records without run linkage | ${missingRun} |`,
  ];
  return `${lines.join('\n')}\n`;
}

export function clearArtifactRegistry() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ARTIFACT_REGISTRY_KEY);
}
