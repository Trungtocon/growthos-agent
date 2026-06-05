import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import { selectUnresolvedCriticalSupportTicketsByIncident } from './production-support-store';
import {
  isCriticalIncident,
  isIncidentActive,
  type IncidentCommandBlocker,
  type IncidentCommandReadiness,
  type IncidentCommandWarning,
  type IncidentTimelineEvent,
  type ProductionIncident,
  type ProductionIncidentDashboard,
  type ProductionIncidentInput,
} from './production-incident';

const PRODUCTION_INCIDENT_KEY = 'uikigai-production-incident-v1';

interface ProductionIncidentState {
  incidents: ProductionIncident[];
  activeIncidentId?: string;
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

function emptyState(): ProductionIncidentState {
  return { incidents: [], artifacts: [], updatedAt: nowIso() };
}

function readState(): ProductionIncidentState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(PRODUCTION_INCIDENT_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ProductionIncidentState>;
    return {
      incidents: parsed.incidents ?? [],
      activeIncidentId: parsed.activeIncidentId,
      artifacts: parsed.artifacts ?? [],
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ProductionIncidentState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PRODUCTION_INCIDENT_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function event(incidentId: string, type: string, message: string, actor?: string, metadata?: Record<string, unknown>): IncidentTimelineEvent {
  return { id: unique(`production-incident-${type}`), incidentId, type, message, actor, timestamp: nowIso(), metadata };
}

function blocker(incidentId: string | undefined, reason: string, recommendedFix: string, severity: IncidentCommandBlocker['severity'] = 'blocking'): IncidentCommandBlocker {
  return { id: `incident-blocker-${incidentId ?? 'workspace'}-${reason.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, incidentId, reason, recommendedFix, severity, createdAt: nowIso() };
}

function warning(incidentId: string | undefined, reason: string, recommendedFix: string): IncidentCommandWarning {
  return { id: unique(`incident-warning-${incidentId ?? 'workspace'}`), incidentId, reason, recommendedFix, createdAt: nowIso() };
}

function persistIncident(incident: ProductionIncident): ProductionIncident {
  const state = readState();
  const updated = { ...incident, updatedAt: nowIso() };
  writeState({
    ...state,
    incidents: [updated, ...state.incidents.filter((entry) => entry.incidentId !== updated.incidentId)].slice(0, 50),
    activeIncidentId: updated.incidentId,
  });
  return clone(updated);
}

function activeIncident(): ProductionIncident {
  const state = readState();
  const existing = state.activeIncidentId ? state.incidents.find((entry) => entry.incidentId === state.activeIncidentId) : state.incidents[0];
  return existing ? clone(existing) : createIncident();
}

function resolveIncidentRecord(incidentId?: string): ProductionIncident {
  if (!incidentId) return activeIncident();
  const found = readState().incidents.find((entry) => entry.incidentId === incidentId);
  return found ? clone(found) : activeIncident();
}

export function clearProductionIncidentStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PRODUCTION_INCIDENT_KEY);
}

export function getProductionIncidentState(): ProductionIncidentState {
  return clone(readState());
}

export function createIncident(input: ProductionIncidentInput = {}): ProductionIncident {
  const createdAt = nowIso();
  const incidentId = unique('production-incident');
  const incident: ProductionIncident = {
    incidentId,
    releaseId: input.releaseId ?? 'go-live-release-current',
    environment: input.environment ?? 'PRODUCTION',
    severity: input.severity ?? 'SEV2',
    status: 'detected',
    owner: input.owner,
    commander: input.commander,
    responders: input.responders ?? [],
    escalationOwner: input.escalationOwner,
    createdAt,
    updatedAt: createdAt,
    detectedAt: createdAt,
    affectedServices: input.affectedServices ?? ['runtime'],
    customerImpact: input.customerImpact ?? 'Customer impact under triage.',
    mitigationSteps: [],
    evidenceLinks: [],
    timelineEvents: [event(incidentId, 'incident.detected', 'Production incident detected.', input.commander)],
  };
  return persistIncident(incident);
}

export function acknowledgeIncident(incidentId?: string, commander = 'Incident Commander'): ProductionIncident {
  const incident = resolveIncidentRecord(incidentId);
  return persistIncident({
    ...incident,
    status: 'triaging',
    commander: incident.commander ?? commander,
    acknowledgedAt: nowIso(),
    timelineEvents: [event(incident.incidentId, 'incident.acknowledged', `Incident acknowledged by ${commander}.`, commander), ...incident.timelineEvents],
  });
}

export function assignIncidentOwner(incidentId?: string, input: { owner?: string; commander?: string; responders?: string[] } = {}): ProductionIncident {
  const incident = resolveIncidentRecord(incidentId);
  return persistIncident({
    ...incident,
    owner: input.owner ?? incident.owner ?? 'SRE Primary',
    commander: input.commander ?? incident.commander ?? 'Incident Commander',
    responders: input.responders ?? incident.responders,
    timelineEvents: [event(incident.incidentId, 'incident.owner_assigned', 'Incident owner and commander assigned.', input.commander ?? incident.commander), ...incident.timelineEvents],
  });
}

export function escalateIncident(incidentId?: string, escalationOwner = 'VP Engineering'): ProductionIncident {
  const incident = resolveIncidentRecord(incidentId);
  return persistIncident({
    ...incident,
    status: 'escalated',
    escalationOwner,
    timelineEvents: [event(incident.incidentId, 'incident.escalated', `Incident escalated to ${escalationOwner}.`, escalationOwner), ...incident.timelineEvents],
  });
}

export function addIncidentTimelineEvent(incidentId: string | undefined, type: string, message: string, actor = 'Operator'): ProductionIncident {
  const incident = resolveIncidentRecord(incidentId);
  return persistIncident({
    ...incident,
    timelineEvents: [event(incident.incidentId, type, message, actor), ...incident.timelineEvents],
  });
}

export function markMitigating(incidentId?: string, step = 'Mitigation started.'): ProductionIncident {
  const incident = resolveIncidentRecord(incidentId);
  return persistIncident({
    ...incident,
    status: 'mitigating',
    mitigationSteps: [...incident.mitigationSteps, step],
    timelineEvents: [event(incident.incidentId, 'incident.mitigating', step, incident.commander), ...incident.timelineEvents],
  });
}

export function markMonitoring(incidentId?: string, note = 'Monitoring after mitigation.'): ProductionIncident {
  const incident = resolveIncidentRecord(incidentId);
  return persistIncident({
    ...incident,
    status: 'monitoring',
    mitigatedAt: incident.mitigatedAt ?? nowIso(),
    timelineEvents: [event(incident.incidentId, 'incident.monitoring', note, incident.commander), ...incident.timelineEvents],
  });
}

export function requestRollback(incidentId?: string, reason = 'Rollback requested by incident command.'): ProductionIncident {
  const incident = resolveIncidentRecord(incidentId);
  return persistIncident({
    ...incident,
    status: 'rollback_required',
    rollbackDecision: { required: true, reason, requestedAt: nowIso() },
    timelineEvents: [event(incident.incidentId, 'rollback.requested', reason, incident.commander), ...incident.timelineEvents],
  });
}

export function triggerRollbackProcedure(incidentId?: string, triggeredBy = 'Release Operator'): ProductionIncident {
  const incident = resolveIncidentRecord(incidentId);
  const decision = incident.rollbackDecision ?? { required: true, reason: 'Rollback triggered by incident command.', requestedAt: nowIso() };
  return persistIncident({
    ...incident,
    rollbackDecision: { ...decision, required: true, triggeredAt: nowIso(), triggeredBy },
    timelineEvents: [event(incident.incidentId, 'rollback.triggered', `Rollback procedure triggered by ${triggeredBy}.`, triggeredBy), ...incident.timelineEvents],
  });
}

export function resolveIncident(incidentId?: string, input: { rootCause?: string; evidenceLinks?: string[]; mitigationSteps?: string[] } = {}): ProductionIncident {
  const incident = resolveIncidentRecord(incidentId);
  const evidenceLinks = input.evidenceLinks ?? incident.evidenceLinks;
  if (!evidenceLinks.length) {
    return persistIncident({
      ...incident,
      timelineEvents: [event(incident.incidentId, 'incident.resolve_blocked', 'Resolution requires mitigation evidence.', incident.commander), ...incident.timelineEvents],
    });
  }
  return persistIncident({
    ...incident,
    status: 'resolved',
    rootCause: input.rootCause ?? incident.rootCause ?? 'Root cause documented in postmortem.',
    mitigationSteps: input.mitigationSteps ?? incident.mitigationSteps,
    evidenceLinks,
    resolvedAt: nowIso(),
    timelineEvents: [event(incident.incidentId, 'incident.resolved', 'Incident resolved with mitigation evidence.', incident.commander), ...incident.timelineEvents],
  });
}

export function closeIncident(incidentId?: string, input: { postmortemRequired: boolean; closedBy?: string } = { postmortemRequired: true }): ProductionIncident {
  const incident = resolveIncidentRecord(incidentId);
  const unresolvedCriticalSupport = selectUnresolvedCriticalSupportTicketsByIncident(incident.incidentId);
  if (unresolvedCriticalSupport.length) {
    return persistIncident({
      ...incident,
      timelineEvents: [event(incident.incidentId, 'incident.close_blocked', `Incident close blocked by ${unresolvedCriticalSupport.length} unresolved critical support ticket(s).`, input.closedBy), ...incident.timelineEvents],
    });
  }
  if (incident.status !== 'resolved' || typeof input.postmortemRequired !== 'boolean') return persistIncident(incident);
  return persistIncident({
    ...incident,
    status: 'closed',
    postmortemRequired: input.postmortemRequired,
    closedAt: nowIso(),
    timelineEvents: [event(incident.incidentId, 'incident.closed', `Incident closed by ${input.closedBy ?? 'Incident Commander'}.`, input.closedBy), ...incident.timelineEvents],
  });
}

function exportedArtifact(name: string, type: ArtifactRecord['type'], content: unknown): ArtifactRecord {
  const createdAt = nowIso();
  return registerArtifact({
    id: `artifact-production-incident-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    type,
    lifecycle: 'AVAILABLE',
    workspaceId: demoWorkspace.id,
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      source: 'mock',
      sourceType: 'production-incident',
      contentSummary: `${name} generated by production incident command center.`,
      tags: ['production-incident', 'incident-command', 'operations'],
      sizeBytes: JSON.stringify(content).length,
    },
    createdAt,
    updatedAt: createdAt,
  });
}

export function exportIncidentPack(incidentId?: string): ArtifactRecord[] {
  const incident = resolveIncidentRecord(incidentId);
  const artifacts = [
    exportedArtifact('production-incident-report.md', 'REPORT', incident),
    exportedArtifact('production-incident-timeline.json', 'AUDIT', incident.timelineEvents),
    exportedArtifact('incident-command-summary.md', 'REPORT', selectIncidentCommandReadiness()),
    exportedArtifact('rollback-decision-record.md', 'REPORT', incident.rollbackDecision ?? { required: false }),
    exportedArtifact('incident-postmortem-template.md', 'REPORT', { incidentId: incident.incidentId, postmortemRequired: incident.postmortemRequired }),
    exportedArtifact('incident-escalation-log.json', 'AUDIT', incident.timelineEvents.filter((entry) => /escalat/i.test(entry.type))),
    exportedArtifact('incident-resolution-evidence.md', 'REPORT', incident.evidenceLinks),
  ];
  const state = readState();
  writeState({ ...state, artifacts });
  return clone(artifacts);
}

export function selectProductionIncidents(): ProductionIncident[] {
  return clone(readState().incidents);
}

export function selectActiveProductionIncidents(): ProductionIncident[] {
  return selectProductionIncidents().filter(isIncidentActive);
}

export function selectCriticalProductionIncidents(): ProductionIncident[] {
  return selectProductionIncidents().filter(isCriticalIncident);
}

export function selectIncidentTimeline(incidentId?: string): IncidentTimelineEvent[] {
  return resolveIncidentRecord(incidentId).timelineEvents;
}

export function selectIncidentEscalationMatrix() {
  const incidents = selectProductionIncidents();
  return incidents.map((incident) => ({
    incidentId: incident.incidentId,
    severity: incident.severity,
    owner: incident.owner ?? 'missing',
    commander: incident.commander ?? 'missing',
    escalationOwner: incident.escalationOwner ?? 'missing',
  }));
}

export function selectIncidentRollbackRequests(): ProductionIncident[] {
  return selectProductionIncidents().filter((incident) => incident.status === 'rollback_required' || Boolean(incident.rollbackDecision?.required));
}

export function selectIncidentPostmortemQueue(): ProductionIncident[] {
  return selectProductionIncidents().filter((incident) => incident.status === 'closed' && incident.postmortemRequired);
}

export function selectIncidentArtifacts(): ArtifactRecord[] {
  return clone(readState().artifacts);
}

export function selectIncidentBlockers(): IncidentCommandBlocker[] {
  const blockers: IncidentCommandBlocker[] = [];
  selectActiveProductionIncidents().forEach((incident) => {
    if (incident.severity === 'SEV0' || incident.severity === 'SEV1') {
      blockers.push(blocker(incident.incidentId, `${incident.severity} incident ${incident.incidentId} is active.`, 'Resolve or close the critical incident before production GO.', 'critical'));
    }
    if (incident.status === 'rollback_required') {
      blockers.push(blocker(incident.incidentId, `Incident ${incident.incidentId} requires rollback.`, 'Trigger rollback procedure or resolve rollback decision before production GO.', 'critical'));
    }
    if (!incident.owner || !incident.commander) {
      blockers.push(blocker(incident.incidentId, `Incident ${incident.incidentId} is missing owner or commander.`, 'Assign incident owner and commander before continuing incident command.', 'blocking'));
    }
  });
  return blockers;
}

export function selectIncidentWarnings(): IncidentCommandWarning[] {
  const warnings: IncidentCommandWarning[] = [];
  selectProductionIncidents().forEach((incident) => {
    if (isIncidentActive(incident) && incident.severity !== 'SEV0' && incident.severity !== 'SEV1') {
      warnings.push(warning(incident.incidentId, `Unresolved ${incident.severity} incident ${incident.incidentId}.`, 'Continue mitigation or close with evidence before final production signoff.'));
    }
    if (incident.status === 'resolved' && typeof incident.postmortemRequired !== 'boolean') {
      warnings.push(warning(incident.incidentId, `Incident ${incident.incidentId} has no postmortem decision.`, 'Record whether postmortem is required before closing.'));
    }
  });
  return warnings;
}

export function selectIncidentCommandReadiness(): IncidentCommandReadiness {
  const active = selectActiveProductionIncidents();
  const critical = selectCriticalProductionIncidents();
  const rollbackRequests = selectIncidentRollbackRequests();
  const postmortemQueue = selectIncidentPostmortemQueue();
  const blockers = selectIncidentBlockers();
  const warnings = selectIncidentWarnings();
  return {
    status: blockers.length ? 'blocked' : warnings.length ? 'warning' : 'ready',
    blockers,
    warnings,
    activeCount: active.length,
    criticalCount: critical.length,
    rollbackRequestCount: rollbackRequests.length,
    postmortemQueueCount: postmortemQueue.length,
  };
}

export function selectProductionIncidentDashboard(): ProductionIncidentDashboard {
  const readiness = selectIncidentCommandReadiness();
  return {
    ...readiness,
    incidents: selectProductionIncidents(),
    activeIncidents: selectActiveProductionIncidents(),
    criticalIncidents: selectCriticalProductionIncidents(),
    rollbackRequests: selectIncidentRollbackRequests(),
    postmortemQueue: selectIncidentPostmortemQueue(),
    artifacts: selectIncidentArtifacts(),
  };
}
