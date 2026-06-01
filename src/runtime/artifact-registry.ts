import type { Artifact } from '../domain/types';

export type ArtifactRecordType =
  | 'REPORT'
  | 'FILE'
  | 'EXPORT'
  | 'PLAN'
  | 'POLICY'
  | 'APPROVAL'
  | 'AUDIT'
  | 'RUNTIME_OUTPUT';

export type ArtifactLifecycle = 'CREATED' | 'INDEXED' | 'AVAILABLE' | 'ARCHIVED' | 'DELETED';

export interface ArtifactMetadata {
  workspaceId: string;
  runId?: string;
  toolId?: string;
  source?: 'paperclip' | 'hermes' | 'mock';
  sourceType?: string;
  contentSummary?: string;
  language?: string;
  url?: string;
  sizeBytes?: number;
  tags: string[];
}

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  version: number;
  lifecycle: ArtifactLifecycle;
  metadata: ArtifactMetadata;
  createdAt: string;
  createdBy: string;
}

export interface ArtifactRecord {
  id: string;
  name: string;
  type: ArtifactRecordType;
  lifecycle: ArtifactLifecycle;
  workspaceId: string;
  runId?: string;
  version: number;
  metadata: ArtifactMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactSearchFilters {
  query?: string;
  type?: ArtifactRecordType | 'ALL';
  workspaceId?: string;
  runId?: string;
  lifecycle?: ArtifactLifecycle | 'ALL';
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'type' | 'lifecycle' | 'version';
  sortDirection?: 'asc' | 'desc';
}

const DEFAULT_WORKSPACE_ID = 'workspace-uikigai-demo';

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

export function inferArtifactRecordType(artifact: Artifact): ArtifactRecordType {
  const identityText = `${artifact.id} ${artifact.name} ${artifact.type}`.toLowerCase();
  const text = `${identityText} ${artifact.contentSummary ?? ''}`.toLowerCase();
  if (includesAny(identityText, ['approval'])) return 'APPROVAL';
  if (includesAny(identityText, ['policy', 'rbac', 'permission'])) return 'POLICY';
  if (includesAny(text, ['audit', 'governance', 'authorization', 'enforcement', 'decision'])) return 'AUDIT';
  if (includesAny(text, ['plan', 'planner'])) return 'PLAN';
  if (includesAny(text, ['export', 'summary', 'health-report'])) return 'EXPORT';
  if (includesAny(text, ['report', 'markdown', '.md'])) return 'REPORT';
  if (includesAny(text, ['json', 'patch', 'code', 'runtime-output'])) return 'RUNTIME_OUTPUT';
  return 'FILE';
}

export function normalizeArtifactRecord(
  artifact: Artifact,
  options: {
    workspaceId?: string;
    lifecycle?: ArtifactLifecycle;
    type?: ArtifactRecordType;
    createdBy?: string;
  } = {},
): ArtifactRecord {
  const now = new Date().toISOString();
  const workspaceId = options.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const tags = [
    artifact.source ?? 'mock',
    artifact.type,
    artifact.runId ? 'run-linked' : 'workspace',
    artifact.toolId ? 'tool-linked' : 'runtime',
  ];
  return {
    id: artifact.id,
    name: artifact.name,
    type: options.type ?? inferArtifactRecordType(artifact),
    lifecycle: options.lifecycle ?? 'AVAILABLE',
    workspaceId,
    runId: artifact.runId,
    version: 1,
    metadata: {
      workspaceId,
      runId: artifact.runId,
      toolId: artifact.toolId,
      source: artifact.source ?? 'mock',
      sourceType: artifact.type,
      contentSummary: artifact.contentSummary,
      language: artifact.language,
      url: artifact.url,
      sizeBytes: artifact.sizeBytes,
      tags,
    },
    createdAt: artifact.createdAt || now,
    updatedAt: now,
  };
}

export function artifactVersionFromRecord(record: ArtifactRecord, createdBy = 'runtime-registry'): ArtifactVersion {
  return {
    id: `${record.id}-v${record.version}`,
    artifactId: record.id,
    version: record.version,
    lifecycle: record.lifecycle,
    metadata: record.metadata,
    createdAt: record.updatedAt,
    createdBy,
  };
}

export function matchesArtifactSearch(record: ArtifactRecord, filters: ArtifactSearchFilters = {}): boolean {
  const query = filters.query?.trim().toLowerCase();
  if (query) {
    const searchable = [
      record.id,
      record.name,
      record.type,
      record.lifecycle,
      record.workspaceId,
      record.runId ?? '',
      record.metadata.contentSummary ?? '',
      record.metadata.tags.join(' '),
    ].join(' ').toLowerCase();
    if (!searchable.includes(query)) return false;
  }
  if (filters.type && filters.type !== 'ALL' && record.type !== filters.type) return false;
  if (filters.workspaceId && record.workspaceId !== filters.workspaceId) return false;
  if (filters.runId && record.runId !== filters.runId) return false;
  if (filters.lifecycle && filters.lifecycle !== 'ALL' && record.lifecycle !== filters.lifecycle) return false;
  if (filters.dateFrom && record.createdAt < filters.dateFrom) return false;
  if (filters.dateTo && record.createdAt > filters.dateTo) return false;
  return true;
}

export function sortArtifactRecords(records: ArtifactRecord[], filters: ArtifactSearchFilters = {}): ArtifactRecord[] {
  const sortBy = filters.sortBy ?? 'createdAt';
  const direction = filters.sortDirection ?? 'desc';
  return [...records].sort((a, b) => {
    const aValue = String(a[sortBy] ?? '');
    const bValue = String(b[sortBy] ?? '');
    const result = aValue.localeCompare(bValue);
    return direction === 'asc' ? result : -result;
  });
}
