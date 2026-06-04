import type { ArtifactRecord } from './artifact-registry';

export type ProductionIncidentSeverity = 'SEV0' | 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';

export type ProductionIncidentStatus =
  | 'detected'
  | 'triaging'
  | 'investigating'
  | 'mitigating'
  | 'monitoring'
  | 'resolved'
  | 'closed'
  | 'escalated'
  | 'rollback_required';

export interface IncidentTimelineEvent {
  id: string;
  incidentId: string;
  type: string;
  message: string;
  actor?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface IncidentRollbackDecision {
  required: boolean;
  reason: string;
  requestedAt: string;
  triggeredAt?: string;
  triggeredBy?: string;
}

export interface ProductionIncident {
  incidentId: string;
  releaseId: string;
  environment: string;
  severity: ProductionIncidentSeverity;
  status: ProductionIncidentStatus;
  owner?: string;
  commander?: string;
  responders: string[];
  escalationOwner?: string;
  createdAt: string;
  updatedAt: string;
  detectedAt: string;
  acknowledgedAt?: string;
  mitigatedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  affectedServices: string[];
  customerImpact: string;
  rootCause?: string;
  mitigationSteps: string[];
  rollbackDecision?: IncidentRollbackDecision;
  postmortemRequired?: boolean;
  evidenceLinks: string[];
  timelineEvents: IncidentTimelineEvent[];
}

export interface ProductionIncidentInput {
  releaseId?: string;
  environment?: string;
  severity?: ProductionIncidentSeverity;
  owner?: string;
  commander?: string;
  responders?: string[];
  escalationOwner?: string;
  affectedServices?: string[];
  customerImpact?: string;
}

export interface IncidentCommandBlocker {
  id: string;
  incidentId?: string;
  reason: string;
  recommendedFix: string;
  severity: 'blocking' | 'critical';
  createdAt: string;
}

export interface IncidentCommandWarning {
  id: string;
  incidentId?: string;
  reason: string;
  recommendedFix: string;
  createdAt: string;
}

export interface IncidentCommandReadiness {
  status: 'ready' | 'warning' | 'blocked';
  blockers: IncidentCommandBlocker[];
  warnings: IncidentCommandWarning[];
  activeCount: number;
  criticalCount: number;
  rollbackRequestCount: number;
  postmortemQueueCount: number;
}

export interface ProductionIncidentDashboard extends IncidentCommandReadiness {
  incidents: ProductionIncident[];
  activeIncidents: ProductionIncident[];
  criticalIncidents: ProductionIncident[];
  rollbackRequests: ProductionIncident[];
  postmortemQueue: ProductionIncident[];
  artifacts: ArtifactRecord[];
}

export const CLOSED_INCIDENT_STATUSES: ProductionIncidentStatus[] = ['resolved', 'closed'];

export function isIncidentActive(incident: ProductionIncident): boolean {
  return !CLOSED_INCIDENT_STATUSES.includes(incident.status);
}

export function isCriticalIncident(incident: ProductionIncident): boolean {
  return isIncidentActive(incident) && (incident.severity === 'SEV0' || incident.severity === 'SEV1');
}
