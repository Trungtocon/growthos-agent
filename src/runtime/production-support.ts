import type { ArtifactRecord } from './artifact-registry';

export type SupportChannel = 'email' | 'chat' | 'phone' | 'system' | 'internal';
export type SupportTicketStatus = 'new' | 'acknowledged' | 'investigating' | 'waiting_customer' | 'waiting_internal' | 'escalated' | 'resolved' | 'closed';
export type SupportSlaStatus = 'within_sla' | 'nearing_breach' | 'breached';
export type SupportImpactLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type SupportSeverity = 'SEV0' | 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
export type SupportPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';

export interface SupportTimelineEvent {
  id: string;
  ticketId: string;
  type: string;
  message: string;
  actor?: string;
  timestamp: string;
}

export interface ProductionSupportTicket {
  ticketId: string;
  incidentId?: string;
  customerId: string;
  customerName: string;
  customerSegment: string;
  affectedWorkspaceId: string;
  severity: SupportSeverity;
  priority: SupportPriority;
  channel: SupportChannel;
  status: SupportTicketStatus;
  slaStatus: SupportSlaStatus;
  impactLevel: SupportImpactLevel;
  owner?: string;
  supportAgent?: string;
  escalationOwner?: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  customerMessage: string;
  internalNote?: string;
  resolutionSummary?: string;
  linkedArtifacts: string[];
  timelineEvents: SupportTimelineEvent[];
}

export interface ProductionSupportInput {
  incidentId?: string;
  customerId?: string;
  customerName?: string;
  customerSegment?: string;
  affectedWorkspaceId?: string;
  severity?: SupportSeverity;
  priority?: SupportPriority;
  channel?: SupportChannel;
  impactLevel?: SupportImpactLevel;
  customerMessage?: string;
}

export interface SupportReadinessFinding {
  id: string;
  ticketId?: string;
  reason: string;
  recommendedFix: string;
  severity: 'warning' | 'blocking' | 'critical';
  createdAt: string;
}

export interface CustomerImpactSummary {
  totalTickets: number;
  criticalImpact: number;
  highImpact: number;
  breachedSla: number;
  affectedCustomers: number;
  affectedWorkspaces: number;
}

export interface SupportReadiness {
  status: 'ready' | 'warning' | 'blocked';
  blockers: SupportReadinessFinding[];
  warnings: SupportReadinessFinding[];
  openCount: number;
  criticalCount: number;
  breachedSlaCount: number;
}

export interface ProductionSupportDashboard extends SupportReadiness {
  tickets: ProductionSupportTicket[];
  openTickets: ProductionSupportTicket[];
  criticalTickets: ProductionSupportTicket[];
  breachedSlaTickets: ProductionSupportTicket[];
  escalatedTickets: ProductionSupportTicket[];
  customerImpact: CustomerImpactSummary;
  artifacts: ArtifactRecord[];
}

export function isSupportTicketOpen(ticket: ProductionSupportTicket): boolean {
  return ticket.status !== 'resolved' && ticket.status !== 'closed';
}

export function isCriticalSupportTicket(ticket: ProductionSupportTicket): boolean {
  return isSupportTicketOpen(ticket) && (ticket.severity === 'SEV0' || ticket.severity === 'SEV1' || ticket.impactLevel === 'critical');
}
