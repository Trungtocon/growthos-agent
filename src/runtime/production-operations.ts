import type { ArtifactRecord } from './artifact-registry';

export type ProductionOpsStatus = 'healthy' | 'warning' | 'degraded' | 'blocked' | 'critical';
export type ProductionOpsItemStatus = 'open' | 'acknowledged' | 'assigned' | 'escalated' | 'resolved';
export type ProductionOpsItemType =
  | 'approval'
  | 'incident'
  | 'support_sla'
  | 'missing_evidence'
  | 'runbook_handoff'
  | 'rollback_readiness'
  | 'go_live_review'
  | 'readiness';

export interface ProductionOpsSignal {
  id: string;
  source: string;
  status: ProductionOpsStatus;
  label: string;
  value: string | number;
  route: string;
  blockers: string[];
  warnings: string[];
}

export interface ProductionOpsActionItem {
  id: string;
  type: ProductionOpsItemType;
  title: string;
  source: string;
  route: string;
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'critical';
  status: ProductionOpsItemStatus;
  owner?: string;
  escalationOwner?: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  details: string;
  linkedEntityId?: string;
  timeline: Array<{ id: string; type: string; message: string; timestamp: string; actor?: string }>;
}

export interface ProductionOpsSnapshot {
  id: string;
  createdAt: string;
  overallHealth: ProductionOpsStatus;
  goLiveStatus: string;
  productionReadiness: string;
  backendHealth: string;
  databaseReadiness: string;
  authReadiness: string;
  environmentReadiness: string;
  observabilityStatus: string;
  incidentStatus: string;
  supportSlaStatus: string;
  signals: ProductionOpsSignal[];
  blockers: string[];
  warnings: string[];
  actionQueue: ProductionOpsActionItem[];
}

export interface ProductionOperationsDashboard extends ProductionOpsSnapshot {
  snapshots: ProductionOpsSnapshot[];
  escalations: ProductionOpsActionItem[];
  artifacts: ArtifactRecord[];
}

export function deriveOpsHealth(blockers: string[], warnings: string[], criticalSignals = 0): ProductionOpsStatus {
  if (criticalSignals > 0) return 'critical';
  if (blockers.length > 0) return 'blocked';
  if (warnings.length > 2) return 'degraded';
  if (warnings.length > 0) return 'warning';
  return 'healthy';
}
