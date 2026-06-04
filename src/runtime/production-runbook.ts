import type { RuntimeEnvironmentId } from './environment-registry';

export type ProductionRunbookStatus = 'draft' | 'incomplete' | 'ready' | 'approved' | 'expired';
export type OperatorHandoffStatus = 'pending' | 'ready' | 'accepted' | 'rejected';
export type RunbookReadinessStatus = 'missing' | 'incomplete' | 'ready' | 'approved' | 'verified' | 'failed';
export type RunbookSectionType =
  | 'deployment_checklist'
  | 'go_live_checklist'
  | 'post_release_monitoring'
  | 'incident_response'
  | 'rollback_procedure'
  | 'escalation_matrix'
  | 'support_contacts'
  | 'slo_sla_rto_rpo'
  | 'known_risks'
  | 'manual_verification';

export interface ProductionRunbookSupportWindow {
  start: string;
  end: string;
  timezone: string;
}

export interface ProductionRunbookSection {
  id: string;
  type: RunbookSectionType;
  title: string;
  description: string;
  required: boolean;
  status: 'pending' | 'done' | 'blocked';
  evidence: string[];
  owner?: string;
  updatedAt: string;
}

export interface ProductionRunbookBlocker {
  id: string;
  reason: string;
  recommendedFix: string;
  severity: 'blocking' | 'critical';
  sectionId?: string;
  createdAt: string;
}

export interface ProductionRunbookWarning {
  id: string;
  reason: string;
  recommendedFix: string;
  sectionId?: string;
  createdAt: string;
}

export interface ProductionRunbookEvent {
  id: string;
  runbookId: string;
  type:
    | 'runbook.created'
    | 'runbook.refreshed'
    | 'checklist.completed'
    | 'runbook.ready'
    | 'runbook.approved'
    | 'runbook.rejected'
    | 'handoff.accepted'
    | 'rollback.drill'
    | 'runbook.exported'
    | 'summary.copied';
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ProductionRunbook {
  runbookId: string;
  releaseId: string;
  environment: RuntimeEnvironmentId;
  operatorOwner?: string;
  escalationOwner?: string;
  incidentOwner?: string;
  supportWindow?: ProductionRunbookSupportWindow;
  runbookStatus: ProductionRunbookStatus;
  handoffStatus: OperatorHandoffStatus;
  rollbackStatus: RunbookReadinessStatus;
  monitoringStatus: RunbookReadinessStatus;
  supportStatus: RunbookReadinessStatus;
  incidentResponseStatus: RunbookReadinessStatus;
  evidencePackStatus: RunbookReadinessStatus;
  sections: ProductionRunbookSection[];
  blockers: ProductionRunbookBlocker[];
  warnings: ProductionRunbookWarning[];
  timeline: ProductionRunbookEvent[];
  approvedBy?: string;
  approvedAt?: string;
  acceptedBy?: string;
  acceptedAt?: string;
  rejectedReason?: string;
  operatorSummary?: string;
  artifacts: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductionRunbookDashboard extends ProductionRunbook {
  checklistCompletion: number;
  canApproveRunbook: boolean;
  canAcceptHandoff: boolean;
}

export interface ProductionRunbookInput {
  releaseId?: string;
  environment?: RuntimeEnvironmentId;
  operatorOwner?: string;
  escalationOwner?: string;
  incidentOwner?: string;
  supportWindow?: ProductionRunbookSupportWindow;
}

export function calculateRunbookCompletion(sections: ProductionRunbookSection[]): number {
  const required = sections.filter((section) => section.required);
  if (!required.length) return 0;
  return Math.round((required.filter((section) => section.status === 'done').length / required.length) * 100);
}

export function deriveRunbookStatuses(runbook: Pick<ProductionRunbook, 'sections' | 'supportWindow' | 'runbookStatus' | 'handoffStatus' | 'operatorOwner' | 'escalationOwner' | 'incidentOwner'>) {
  const sectionDone = (type: RunbookSectionType) => runbook.sections.some((section) => section.type === type && section.status === 'done');
  return {
    rollbackStatus: sectionDone('rollback_procedure') ? 'ready' : 'missing',
    monitoringStatus: sectionDone('post_release_monitoring') ? 'ready' : 'missing',
    supportStatus: runbook.supportWindow && sectionDone('support_contacts') ? 'ready' : 'missing',
    incidentResponseStatus: runbook.incidentOwner && sectionDone('incident_response') ? 'ready' : 'missing',
    evidencePackStatus: sectionDone('deployment_checklist') && sectionDone('go_live_checklist') ? 'ready' : 'incomplete',
  } satisfies Pick<ProductionRunbook, 'rollbackStatus' | 'monitoringStatus' | 'supportStatus' | 'incidentResponseStatus' | 'evidencePackStatus'>;
}
