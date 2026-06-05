import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import { getEvidenceAdjustedAuthReadinessReport } from './auth-readiness-store';
import { getEvidenceAdjustedBackendReadinessReport } from './backend-health';
import { getEvidenceAdjustedDatabaseReadinessReport } from './database-readiness';
import { getDeploymentConfigDashboard } from './deployment-config-store';
import { getEvidenceAdjustedEnvironmentReadinessReport } from './environment-readiness-store';
import { selectGoLiveControl } from './go-live-control-store';
import { selectPreGoLiveValidationSummary } from './pre-golive-validation-store';
import { selectIncidentCommandReadiness } from './production-incident-store';
import { selectObservabilityDashboard } from './production-observability-store';
import { getProductionReadinessDashboard } from './production-readiness-store';
import { selectProductionRunbook } from './production-runbook-store';
import { selectBreachedSlaTickets, selectSupportReadiness, selectSupportSlaStatus } from './production-support-store';
import {
  deriveOpsHealth,
  type ProductionOperationsDashboard,
  type ProductionOpsActionItem,
  type ProductionOpsItemStatus,
  type ProductionOpsItemType,
  type ProductionOpsSignal,
  type ProductionOpsSnapshot,
  type ProductionOpsStatus,
} from './production-operations';

const PRODUCTION_OPS_KEY = 'uikigai-production-operations-v1';

interface ProductionOperationsState {
  snapshots: ProductionOpsSnapshot[];
  actionItems: ProductionOpsActionItem[];
  activeSnapshotId?: string;
  artifacts: ArtifactRecord[];
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): ProductionOperationsState {
  return { snapshots: [], actionItems: [], artifacts: [], updatedAt: nowIso() };
}

function readState(): ProductionOperationsState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(PRODUCTION_OPS_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ProductionOperationsState>;
    return {
      snapshots: parsed.snapshots ?? [],
      actionItems: parsed.actionItems ?? [],
      activeSnapshotId: parsed.activeSnapshotId,
      artifacts: parsed.artifacts ?? [],
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ProductionOperationsState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PRODUCTION_OPS_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function timeline(itemId: string, type: string, message: string, actor?: string): ProductionOpsActionItem['timeline'][number] {
  return { id: unique(`ops-${type}`), type, message, actor, timestamp: nowIso() };
}

function signal(input: Omit<ProductionOpsSignal, 'id'>): ProductionOpsSignal {
  return { id: `ops-signal-${input.source.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, ...input };
}

function statusFrom(blockers: unknown[], warnings: unknown[], degraded = false): ProductionOpsStatus {
  if (blockers.length) return 'blocked';
  if (degraded) return 'degraded';
  if (warnings.length) return 'warning';
  return 'healthy';
}

function queueItem(type: ProductionOpsItemType, title: string, source: string, route: string, priority: ProductionOpsActionItem['priority'], details: string, linkedEntityId?: string): ProductionOpsActionItem {
  const createdAt = nowIso();
  const id = `ops-item-${type}-${linkedEntityId ?? title}`.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  return {
    id,
    type,
    title,
    source,
    route,
    priority,
    status: 'open',
    createdAt,
    details,
    linkedEntityId,
    timeline: [timeline(id, 'ops.item_created', title, 'Live Ops')],
  };
}

function mergeActionItems(generated: ProductionOpsActionItem[], stored: ProductionOpsActionItem[]): ProductionOpsActionItem[] {
  const storedById = new Map(stored.map((item) => [item.id, item]));
  const merged = generated.map((item) => ({ ...item, ...(storedById.get(item.id) ?? {}) }));
  const generatedIds = new Set(generated.map((item) => item.id));
  const manualItems = stored.filter((item) => !generatedIds.has(item.id) && item.status !== 'resolved');
  return [...merged, ...manualItems];
}

function buildSignals(): { signals: ProductionOpsSignal[]; blockers: string[]; warnings: string[] } {
  const goLive = selectGoLiveControl();
  const productionReadiness = getProductionReadinessDashboard();
  const backend = getEvidenceAdjustedBackendReadinessReport('PRODUCTION');
  const database = getEvidenceAdjustedDatabaseReadinessReport('PRODUCTION');
  const auth = getEvidenceAdjustedAuthReadinessReport('PRODUCTION');
  const environment = getEvidenceAdjustedEnvironmentReadinessReport('PRODUCTION');
  const deployment = getDeploymentConfigDashboard();
  const observability = selectObservabilityDashboard();
  const incidents = selectIncidentCommandReadiness();
  const support = selectSupportReadiness();
  const preGoLive = selectPreGoLiveValidationSummary();
  const signals: ProductionOpsSignal[] = [
    signal({ source: 'go-live', label: 'Go-Live status', value: goLive.finalVerdict, status: goLive.blockerCount ? 'blocked' : goLive.warningCount ? 'warning' : 'healthy', route: '/go-live-control', blockers: goLive.blockers.map((entry) => entry.reason), warnings: goLive.warnings.map((entry) => entry.reason) }),
    signal({ source: 'production-readiness', label: 'Production readiness', value: productionReadiness.status, status: productionReadiness.blockers.length ? 'blocked' : productionReadiness.warnings.length ? 'warning' : 'healthy', route: '/production-readiness', blockers: productionReadiness.blockers.map((entry) => entry.reason), warnings: productionReadiness.warnings.map((entry) => entry.reason) }),
    signal({ source: 'backend', label: 'Backend health', value: backend.status, status: statusFrom(backend.blockers, backend.warnings), route: '/backend-readiness', blockers: backend.blockers, warnings: backend.warnings }),
    signal({ source: 'database', label: 'Database readiness', value: database.status, status: statusFrom(database.blockers, database.warnings), route: '/database-readiness', blockers: database.blockers, warnings: database.warnings }),
    signal({ source: 'auth', label: 'Auth readiness', value: auth.status, status: statusFrom(auth.blockers, auth.warnings), route: '/auth-readiness', blockers: auth.blockers, warnings: auth.warnings }),
    signal({ source: 'environment', label: 'Environment readiness', value: environment.status, status: statusFrom(environment.blockers, environment.warnings), route: '/environment-readiness', blockers: environment.blockers, warnings: environment.warnings }),
    signal({ source: 'deployment', label: 'Deployment status', value: deployment.status, status: deployment.blockers.length ? 'blocked' : deployment.warnings.length ? 'warning' : 'healthy', route: '/deployment-config', blockers: deployment.blockers.map((entry) => entry.reason), warnings: deployment.warnings.map((entry) => entry.reason) }),
    signal({ source: 'observability', label: 'Observability status', value: observability.verdict, status: observability.blockers.length ? 'blocked' : observability.warnings.length ? 'warning' : 'healthy', route: '/production-observability', blockers: observability.blockers, warnings: observability.warnings }),
    signal({ source: 'incidents', label: 'Incident status', value: incidents.status, status: incidents.criticalCount ? 'critical' : incidents.blockers.length ? 'blocked' : incidents.warnings.length ? 'warning' : 'healthy', route: '/production-incidents', blockers: incidents.blockers.map((entry) => entry.reason), warnings: incidents.warnings.map((entry) => entry.reason) }),
    signal({ source: 'support', label: 'Support SLA status', value: support.status, status: support.blockers.length ? 'critical' : support.warnings.length ? 'warning' : 'healthy', route: '/production-support', blockers: support.blockers.map((entry) => entry.reason), warnings: support.warnings.map((entry) => entry.reason) }),
    signal({ source: 'pre-golive', label: 'Pre-Go-Live validation', value: preGoLive.finalVerdict, status: preGoLive.blockers.length ? 'blocked' : preGoLive.warnings.length ? 'warning' : 'healthy', route: '/pre-golive-validation', blockers: preGoLive.blockers.map((entry) => typeof entry === 'string' ? entry : JSON.stringify(entry)), warnings: preGoLive.warnings.map((entry) => typeof entry === 'string' ? entry : JSON.stringify(entry)) }),
  ];
  return {
    signals,
    blockers: signals.flatMap((entry) => entry.blockers.map((reason) => `${entry.label}: ${reason}`)),
    warnings: signals.flatMap((entry) => entry.warnings.map((reason) => `${entry.label}: ${reason}`)),
  };
}

function buildGeneratedQueue(): ProductionOpsActionItem[] {
  const incidents = selectIncidentCommandReadiness();
  const support = selectSupportReadiness();
  const breachedTickets = selectBreachedSlaTickets();
  const runbook = selectProductionRunbook();
  const goLive = selectGoLiveControl();
  const productionReadiness = getProductionReadinessDashboard();
  const items: ProductionOpsActionItem[] = [];
  incidents.blockers.forEach((entry) => items.push(queueItem('incident', entry.reason, 'Production Incident Command', '/production-incidents', entry.severity === 'critical' ? 'critical' : 'urgent', entry.recommendedFix, entry.incidentId)));
  incidents.warnings.forEach((entry) => items.push(queueItem('incident', entry.reason, 'Production Incident Command', '/production-incidents', 'high', entry.recommendedFix, entry.incidentId)));
  support.blockers.forEach((entry) => items.push(queueItem('support_sla', entry.reason, 'Production Support Desk', '/production-support', entry.severity === 'critical' ? 'critical' : 'urgent', entry.recommendedFix, entry.ticketId)));
  support.warnings.forEach((entry) => items.push(queueItem('support_sla', entry.reason, 'Production Support Desk', '/production-support', 'high', entry.recommendedFix, entry.ticketId)));
  breachedTickets.forEach((ticket) => items.push(queueItem('support_sla', `Breached SLA for ${ticket.customerName}.`, 'Production Support Desk', '/production-support', 'critical', 'Update customer communication and resolve SLA breach.', ticket.ticketId)));
  if (runbook.handoffStatus !== 'accepted') items.push(queueItem('runbook_handoff', 'Operator handoff is not accepted.', 'Production Runbook', '/production-runbook', 'high', 'Accept operator handoff before live operations are considered ready.', runbook.runbookId));
  if (runbook.rollbackStatus === 'missing') items.push(queueItem('rollback_readiness', 'Rollback readiness requires review.', 'Production Runbook', '/production-runbook', 'urgent', 'Complete rollback checklist and request rollback review.', runbook.runbookId));
  if (goLive.blockerCount) items.push(queueItem('go_live_review', 'Go-Live review has active blockers.', 'Go-Live Control', '/go-live-control', 'urgent', 'Resolve blockers before requesting live operator signoff.', goLive.releaseId));
  if (productionReadiness.blockers.length) items.push(queueItem('readiness', 'Production readiness has unresolved blockers.', 'Production Readiness', '/production-readiness', 'urgent', 'Resolve readiness blockers before Go-Live.', productionReadiness.activeCheck?.id));
  return items;
}

function buildSnapshot(existingQueue: ProductionOpsActionItem[] = readState().actionItems): ProductionOpsSnapshot {
  const { signals, blockers, warnings } = buildSignals();
  const generated = mergeActionItems(buildGeneratedQueue(), existingQueue).filter((item) => item.status !== 'resolved');
  const criticalSignals = signals.filter((entry) => entry.status === 'critical').length;
  const goLive = signals.find((entry) => entry.source === 'go-live');
  const productionReadiness = signals.find((entry) => entry.source === 'production-readiness');
  const backend = signals.find((entry) => entry.source === 'backend');
  const database = signals.find((entry) => entry.source === 'database');
  const auth = signals.find((entry) => entry.source === 'auth');
  const environment = signals.find((entry) => entry.source === 'environment');
  const observability = signals.find((entry) => entry.source === 'observability');
  const incidents = signals.find((entry) => entry.source === 'incidents');
  const support = signals.find((entry) => entry.source === 'support');
  return {
    id: unique('production-ops-snapshot'),
    createdAt: nowIso(),
    overallHealth: deriveOpsHealth(blockers, warnings, criticalSignals),
    goLiveStatus: String(goLive?.value ?? 'not_checked'),
    productionReadiness: String(productionReadiness?.value ?? 'not_checked'),
    backendHealth: String(backend?.value ?? 'not_checked'),
    databaseReadiness: String(database?.value ?? 'not_checked'),
    authReadiness: String(auth?.value ?? 'not_checked'),
    environmentReadiness: String(environment?.value ?? 'not_checked'),
    observabilityStatus: String(observability?.value ?? 'not_checked'),
    incidentStatus: String(incidents?.value ?? 'not_checked'),
    supportSlaStatus: String(support?.value ?? 'not_checked'),
    signals,
    blockers,
    warnings,
    actionQueue: generated,
  };
}

function persistSnapshot(snapshot: ProductionOpsSnapshot): ProductionOpsSnapshot {
  const state = readState();
  writeState({
    ...state,
    snapshots: [snapshot, ...state.snapshots].slice(0, 20),
    actionItems: snapshot.actionQueue,
    activeSnapshotId: snapshot.id,
  });
  return clone(snapshot);
}

function currentSnapshot(): ProductionOpsSnapshot {
  const state = readState();
  const snapshot = state.activeSnapshotId ? state.snapshots.find((entry) => entry.id === state.activeSnapshotId) : state.snapshots[0];
  return snapshot ? buildSnapshot(state.actionItems) : createOpsSnapshot();
}

function updateItem(itemId: string | undefined, status: ProductionOpsItemStatus, message: string, patch: Partial<ProductionOpsActionItem> = {}): ProductionOpsActionItem {
  const state = readState();
  const snapshot = buildSnapshot(state.actionItems);
  const target = itemId ? snapshot.actionQueue.find((item) => item.id === itemId) : snapshot.actionQueue[0];
  const fallback = target ?? queueItem('readiness', 'Operations item created manually.', 'Production Operations', '/production-operations', 'normal', 'Manual operations action.');
  const updated: ProductionOpsActionItem = {
    ...fallback,
    ...patch,
    status,
    acknowledgedAt: status === 'acknowledged' ? nowIso() : fallback.acknowledgedAt,
    resolvedAt: status === 'resolved' ? nowIso() : fallback.resolvedAt,
    timeline: [timeline(fallback.id, `ops.${status}`, message, patch.owner ?? patch.escalationOwner), ...fallback.timeline],
  };
  const nextItems = [updated, ...snapshot.actionQueue.filter((item) => item.id !== updated.id)];
  const nextSnapshot = buildSnapshot(nextItems);
  writeState({ ...state, snapshots: [nextSnapshot, ...state.snapshots].slice(0, 20), actionItems: nextItems, activeSnapshotId: nextSnapshot.id });
  return clone(updated);
}

export function clearProductionOperationsStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PRODUCTION_OPS_KEY);
}

export function createOpsSnapshot(): ProductionOpsSnapshot {
  return persistSnapshot(buildSnapshot());
}

export function refreshReadinessSnapshot(): ProductionOpsSnapshot {
  return createOpsSnapshot();
}

export function acknowledgeOpsAlert(itemId?: string): ProductionOpsActionItem {
  return updateItem(itemId, 'acknowledged', 'Operations alert acknowledged.');
}

export function assignOpsOwner(itemId: string | undefined, owner = 'Live Ops Lead'): ProductionOpsActionItem {
  return updateItem(itemId, 'assigned', `Assigned to ${owner}.`, { owner });
}

export function escalateOpsItem(itemId: string | undefined, escalationOwner = 'VP Operations'): ProductionOpsActionItem {
  const current = readState().actionItems.find((item) => item.id === itemId);
  return updateItem(itemId, 'escalated', `Escalated to ${escalationOwner}.`, { owner: current?.owner, escalationOwner });
}

export function markOpsItemResolved(itemId?: string): ProductionOpsActionItem {
  return updateItem(itemId, 'resolved', 'Operations action item marked resolved.');
}

export function requestRollbackReview(itemId?: string): ProductionOpsActionItem {
  const existing = itemId ? readState().actionItems.find((item) => item.id === itemId) : undefined;
  const item = existing?.type === 'rollback_readiness'
    ? existing
    : queueItem('rollback_readiness', 'Rollback readiness review requested.', 'Production Operations', '/production-runbook', 'urgent', 'Review rollback readiness before live operations continue.');
  const state = readState();
  writeState({ ...state, actionItems: [item, ...state.actionItems.filter((entry) => entry.id !== item.id)] });
  return updateItem(item.id, 'acknowledged', 'Rollback readiness review requested.', { owner: item.owner ?? 'Release Operator' });
}

export function requestGoLiveReview(): ProductionOpsActionItem {
  const goLive = selectGoLiveControl();
  const item = queueItem('go_live_review', 'Live operator Go-Live review requested.', 'Production Operations', '/go-live-control', goLive.blockerCount ? 'urgent' : 'normal', goLive.blockerCount ? 'Review requested but blockers remain active.' : 'Review requested with no active Go-Live blockers.', goLive.releaseId);
  const state = readState();
  writeState({ ...state, actionItems: [item, ...state.actionItems.filter((entry) => entry.id !== item.id)] });
  return clone(item);
}

function exportedArtifact(name: string, type: ArtifactRecord['type'], content: unknown): ArtifactRecord {
  const createdAt = nowIso();
  return registerArtifact({
    id: `artifact-production-operations-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    type,
    lifecycle: 'AVAILABLE',
    workspaceId: demoWorkspace.id,
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      source: 'mock',
      sourceType: 'production-operations',
      contentSummary: `${name} generated by Production Operations Console.`,
      tags: ['production-operations', 'live-ops', 'operator-handoff'],
      sizeBytes: JSON.stringify(content).length,
    },
    createdAt,
    updatedAt: createdAt,
  });
}

export function exportOpsPack(): ArtifactRecord[] {
  const dashboard = selectProductionOperationsDashboard();
  const artifacts = [
    exportedArtifact('production-operations-snapshot.json', 'AUDIT', dashboard),
    exportedArtifact('production-operations-report.md', 'REPORT', dashboard),
    exportedArtifact('production-action-queue.json', 'AUDIT', dashboard.actionQueue),
    exportedArtifact('production-escalation-summary.md', 'REPORT', dashboard.escalations),
    exportedArtifact('rollback-readiness-review.md', 'REPORT', dashboard.actionQueue.filter((item) => item.type === 'rollback_readiness')),
    exportedArtifact('go-live-ops-handoff.md', 'EXPORT', { health: dashboard.overallHealth, blockers: dashboard.blockers, warnings: dashboard.warnings }),
  ];
  const state = readState();
  writeState({ ...state, artifacts });
  return clone(artifacts);
}

export function selectProductionOpsSnapshot(): ProductionOpsSnapshot {
  return clone(currentSnapshot());
}

export function selectProductionOpsHealth(): ProductionOpsStatus {
  return selectProductionOpsSnapshot().overallHealth;
}

export function selectProductionOpsActionQueue(): ProductionOpsActionItem[] {
  return clone(currentSnapshot().actionQueue);
}

export function selectProductionOpsBlockers(): string[] {
  return clone(currentSnapshot().blockers);
}

export function selectProductionOpsWarnings(): string[] {
  return clone(currentSnapshot().warnings);
}

export function selectProductionOpsEscalations(): ProductionOpsActionItem[] {
  return clone(currentSnapshot().actionQueue.filter((item) => item.status === 'escalated' || item.priority === 'critical'));
}

export function selectProductionOpsArtifacts(): ArtifactRecord[] {
  return clone(readState().artifacts);
}

export function selectProductionOperationsDashboard(): ProductionOperationsDashboard {
  const state = readState();
  const snapshot = currentSnapshot();
  return {
    ...snapshot,
    snapshots: clone(state.snapshots),
    escalations: selectProductionOpsEscalations(),
    artifacts: selectProductionOpsArtifacts(),
  };
}
