import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import {
  isCriticalSupportTicket,
  isSupportTicketOpen,
  type CustomerImpactSummary,
  type ProductionSupportDashboard,
  type ProductionSupportInput,
  type ProductionSupportTicket,
  type SupportReadiness,
  type SupportReadinessFinding,
  type SupportTimelineEvent,
} from './production-support';

const PRODUCTION_SUPPORT_KEY = 'uikigai-production-support-v1';

interface ProductionSupportState {
  tickets: ProductionSupportTicket[];
  activeTicketId?: string;
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

function emptyState(): ProductionSupportState {
  return { tickets: [], artifacts: [], updatedAt: nowIso() };
}

function readState(): ProductionSupportState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(PRODUCTION_SUPPORT_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ProductionSupportState>;
    return {
      tickets: parsed.tickets ?? [],
      activeTicketId: parsed.activeTicketId,
      artifacts: parsed.artifacts ?? [],
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ProductionSupportState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PRODUCTION_SUPPORT_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function event(ticketId: string, type: string, message: string, actor?: string): SupportTimelineEvent {
  return { id: unique(`support-${type}`), ticketId, type, message, actor, timestamp: nowIso() };
}

function finding(ticketId: string | undefined, reason: string, recommendedFix: string, severity: SupportReadinessFinding['severity']): SupportReadinessFinding {
  return {
    id: `support-finding-${ticketId ?? 'workspace'}-${reason.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    ticketId,
    reason,
    recommendedFix,
    severity,
    createdAt: nowIso(),
  };
}

function persistTicket(ticket: ProductionSupportTicket): ProductionSupportTicket {
  const state = readState();
  writeState({
    ...state,
    tickets: [ticket, ...state.tickets.filter((entry) => entry.ticketId !== ticket.ticketId)].slice(0, 100),
    activeTicketId: ticket.ticketId,
  });
  return clone(ticket);
}

function activeTicket(): ProductionSupportTicket {
  const state = readState();
  const existing = state.activeTicketId ? state.tickets.find((entry) => entry.ticketId === state.activeTicketId) : state.tickets[0];
  return existing ? clone(existing) : createSupportTicket();
}

function resolveTicket(ticketId?: string): ProductionSupportTicket {
  if (!ticketId) return activeTicket();
  const found = readState().tickets.find((entry) => entry.ticketId === ticketId);
  return found ? clone(found) : activeTicket();
}

function updateTicket(ticketId: string | undefined, transform: (ticket: ProductionSupportTicket) => ProductionSupportTicket): ProductionSupportTicket {
  return persistTicket(transform(resolveTicket(ticketId)));
}

export function clearProductionSupportStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PRODUCTION_SUPPORT_KEY);
}

export function getProductionSupportState(): ProductionSupportState {
  return clone(readState());
}

export function createSupportTicket(input: ProductionSupportInput = {}): ProductionSupportTicket {
  const createdAt = nowIso();
  const ticketId = unique('support-ticket');
  const severity = input.severity ?? 'SEV2';
  const critical = severity === 'SEV0' || severity === 'SEV1' || input.impactLevel === 'critical';
  const ticket: ProductionSupportTicket = {
    ticketId,
    incidentId: input.incidentId,
    customerId: input.customerId ?? 'customer-acme',
    customerName: input.customerName ?? 'Acme Enterprise',
    customerSegment: input.customerSegment ?? 'Enterprise',
    affectedWorkspaceId: input.affectedWorkspaceId ?? demoWorkspace.id,
    severity,
    priority: input.priority ?? (critical ? 'critical' : 'high'),
    channel: input.channel ?? 'system',
    status: 'new',
    slaStatus: 'within_sla',
    impactLevel: input.impactLevel ?? (critical ? 'critical' : 'high'),
    createdAt,
    customerMessage: input.customerMessage ?? 'Customer-impacting production issue requires triage.',
    linkedArtifacts: [],
    timelineEvents: [event(ticketId, 'support.created', 'Support ticket created from production customer impact.', 'System')],
  };
  return persistTicket(ticket);
}

export function acknowledgeSupportTicket(ticketId?: string, supportAgent = 'Support Lead'): ProductionSupportTicket {
  return updateTicket(ticketId, (ticket) => ({
    ...ticket,
    status: 'acknowledged',
    supportAgent: ticket.supportAgent ?? supportAgent,
    acknowledgedAt: ticket.acknowledgedAt ?? nowIso(),
    timelineEvents: [event(ticket.ticketId, 'support.acknowledged', `Ticket acknowledged by ${supportAgent}.`, supportAgent), ...ticket.timelineEvents],
  }));
}

export function assignSupportOwner(ticketId?: string, input: { owner?: string; supportAgent?: string } = {}): ProductionSupportTicket {
  return updateTicket(ticketId, (ticket) => ({
    ...ticket,
    owner: input.owner ?? ticket.owner ?? 'Support Owner',
    supportAgent: input.supportAgent ?? ticket.supportAgent ?? 'Tier 2 Agent',
    timelineEvents: [event(ticket.ticketId, 'support.owner_assigned', 'Support owner and agent assigned.', input.supportAgent ?? ticket.supportAgent), ...ticket.timelineEvents],
  }));
}

export function linkTicketToIncident(ticketId: string | undefined, incidentId: string): ProductionSupportTicket {
  return updateTicket(ticketId, (ticket) => ({
    ...ticket,
    incidentId,
    timelineEvents: [event(ticket.ticketId, 'support.incident_linked', `Linked to production incident ${incidentId}.`, 'Incident Command'), ...ticket.timelineEvents],
  }));
}

export function escalateSupportTicket(ticketId?: string, escalationOwner = 'Customer Success Director'): ProductionSupportTicket {
  return updateTicket(ticketId, (ticket) => ({
    ...ticket,
    status: 'escalated',
    escalationOwner,
    timelineEvents: [event(ticket.ticketId, 'support.escalated', `Escalated to ${escalationOwner}.`, escalationOwner), ...ticket.timelineEvents],
  }));
}

export function addCustomerImpactNote(ticketId?: string, note = 'Customer notified of current mitigation status.'): ProductionSupportTicket {
  return updateTicket(ticketId, (ticket) => ({
    ...ticket,
    customerMessage: `${ticket.customerMessage}\n${note}`,
    timelineEvents: [event(ticket.ticketId, 'support.customer_note', note, ticket.supportAgent ?? 'Support Agent'), ...ticket.timelineEvents],
  }));
}

export function addInternalSupportNote(ticketId?: string, note = 'Internal support note added.'): ProductionSupportTicket {
  return updateTicket(ticketId, (ticket) => ({
    ...ticket,
    internalNote: ticket.internalNote ? `${ticket.internalNote}\n${note}` : note,
    timelineEvents: [event(ticket.ticketId, 'support.internal_note', note, ticket.owner ?? 'Support Owner'), ...ticket.timelineEvents],
  }));
}

export function markWaitingCustomer(ticketId?: string): ProductionSupportTicket {
  return updateTicket(ticketId, (ticket) => ({
    ...ticket,
    status: 'waiting_customer',
    timelineEvents: [event(ticket.ticketId, 'support.waiting_customer', 'Ticket is waiting on customer response.', ticket.supportAgent), ...ticket.timelineEvents],
  }));
}

export function markWaitingInternal(ticketId?: string): ProductionSupportTicket {
  return updateTicket(ticketId, (ticket) => ({
    ...ticket,
    status: 'waiting_internal',
    timelineEvents: [event(ticket.ticketId, 'support.waiting_internal', 'Ticket is waiting on internal follow-up.', ticket.owner), ...ticket.timelineEvents],
  }));
}

export function markSupportSlaNearingBreach(ticketId?: string): ProductionSupportTicket {
  return updateTicket(ticketId, (ticket) => ({
    ...ticket,
    slaStatus: 'nearing_breach',
    timelineEvents: [event(ticket.ticketId, 'support.sla_nearing_breach', 'SLA is nearing breach.', 'SLA Monitor'), ...ticket.timelineEvents],
  }));
}

export function markSupportSlaBreached(ticketId?: string): ProductionSupportTicket {
  return updateTicket(ticketId, (ticket) => ({
    ...ticket,
    slaStatus: 'breached',
    timelineEvents: [event(ticket.ticketId, 'support.sla_breached', 'SLA breached for customer-impacting ticket.', 'SLA Monitor'), ...ticket.timelineEvents],
  }));
}

export function resolveSupportTicket(ticketId?: string, input: { resolutionSummary?: string; linkedArtifacts?: string[] } = {}): ProductionSupportTicket {
  return updateTicket(ticketId, (ticket) => {
    if (!input.resolutionSummary) {
      return {
        ...ticket,
        timelineEvents: [event(ticket.ticketId, 'support.resolve_blocked', 'Resolution requires a summary.', ticket.owner), ...ticket.timelineEvents],
      };
    }
    return {
      ...ticket,
      status: 'resolved',
      resolutionSummary: input.resolutionSummary,
      linkedArtifacts: [...new Set([...ticket.linkedArtifacts, ...(input.linkedArtifacts ?? [])])],
      resolvedAt: nowIso(),
      timelineEvents: [event(ticket.ticketId, 'support.resolved', input.resolutionSummary, ticket.owner), ...ticket.timelineEvents],
    };
  });
}

export function closeSupportTicket(ticketId?: string): ProductionSupportTicket {
  return updateTicket(ticketId, (ticket) => {
    if (ticket.status !== 'resolved' || !ticket.resolutionSummary) {
      return {
        ...ticket,
        timelineEvents: [event(ticket.ticketId, 'support.close_blocked', 'Closed ticket requires resolved status and resolution summary.', ticket.owner), ...ticket.timelineEvents],
      };
    }
    return {
      ...ticket,
      status: 'closed',
      closedAt: nowIso(),
      timelineEvents: [event(ticket.ticketId, 'support.closed', 'Support ticket closed with resolution evidence.', ticket.owner), ...ticket.timelineEvents],
    };
  });
}

function exportedArtifact(name: string, type: ArtifactRecord['type'], content: unknown): ArtifactRecord {
  const createdAt = nowIso();
  return registerArtifact({
    id: `artifact-production-support-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    type,
    lifecycle: 'AVAILABLE',
    workspaceId: demoWorkspace.id,
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      source: 'mock',
      sourceType: 'production-support',
      contentSummary: `${name} generated by production support desk.`,
      tags: ['production-support', 'customer-impact', 'sla'],
      sizeBytes: JSON.stringify(content).length,
    },
    createdAt,
    updatedAt: createdAt,
  });
}

export function exportSupportPack(ticketId?: string): ArtifactRecord[] {
  const dashboard = selectProductionSupportDashboard();
  const ticket = ticketId ? dashboard.tickets.find((entry) => entry.ticketId === ticketId) : dashboard.tickets[0];
  const content = {
    generatedAt: nowIso(),
    ticket,
    dashboard: {
      status: dashboard.status,
      openCount: dashboard.openCount,
      criticalCount: dashboard.criticalCount,
      breachedSlaCount: dashboard.breachedSlaCount,
      customerImpact: dashboard.customerImpact,
    },
  };
  const artifacts = [
    exportedArtifact('production-support-report.md', 'REPORT', content),
    exportedArtifact('support-ticket-log.json', 'AUDIT', dashboard.tickets),
    exportedArtifact('customer-impact-summary.md', 'REPORT', dashboard.customerImpact),
    exportedArtifact('sla-breach-report.md', 'REPORT', dashboard.breachedSlaTickets),
    exportedArtifact('support-escalation-log.json', 'AUDIT', dashboard.escalatedTickets),
    exportedArtifact('customer-communication-drafts.md', 'REPORT', dashboard.tickets.map((entry) => entry.customerMessage)),
    exportedArtifact('support-resolution-evidence.md', 'REPORT', dashboard.tickets.map((entry) => ({ ticketId: entry.ticketId, resolutionSummary: entry.resolutionSummary, linkedArtifacts: entry.linkedArtifacts }))),
    exportedArtifact('support-handoff-summary.md', 'EXPORT', dashboard.tickets.map((entry) => ({ ticketId: entry.ticketId, owner: entry.owner, supportAgent: entry.supportAgent, escalationOwner: entry.escalationOwner }))),
  ];
  const state = readState();
  writeState({ ...state, artifacts });
  return clone(artifacts);
}

export function selectOpenSupportTickets(): ProductionSupportTicket[] {
  return clone(readState().tickets.filter(isSupportTicketOpen));
}

export function selectCriticalSupportTickets(): ProductionSupportTicket[] {
  return clone(readState().tickets.filter(isCriticalSupportTicket));
}

export function selectSupportSlaStatus(): { within: number; nearing: number; breached: number } {
  const tickets = readState().tickets.filter(isSupportTicketOpen);
  return {
    within: tickets.filter((ticket) => ticket.slaStatus === 'within_sla').length,
    nearing: tickets.filter((ticket) => ticket.slaStatus === 'nearing_breach').length,
    breached: tickets.filter((ticket) => ticket.slaStatus === 'breached').length,
  };
}

export function selectBreachedSlaTickets(): ProductionSupportTicket[] {
  return clone(readState().tickets.filter((ticket) => isSupportTicketOpen(ticket) && ticket.slaStatus === 'breached'));
}

export function selectCustomerImpactSummary(): CustomerImpactSummary {
  const tickets = readState().tickets;
  return {
    totalTickets: tickets.length,
    criticalImpact: tickets.filter((ticket) => isSupportTicketOpen(ticket) && ticket.impactLevel === 'critical').length,
    highImpact: tickets.filter((ticket) => isSupportTicketOpen(ticket) && ticket.impactLevel === 'high').length,
    breachedSla: tickets.filter((ticket) => isSupportTicketOpen(ticket) && ticket.slaStatus === 'breached').length,
    affectedCustomers: new Set(tickets.filter(isSupportTicketOpen).map((ticket) => ticket.customerId)).size,
    affectedWorkspaces: new Set(tickets.filter(isSupportTicketOpen).map((ticket) => ticket.affectedWorkspaceId)).size,
  };
}

export function selectSupportTicketsByIncident(incidentId: string): ProductionSupportTicket[] {
  return clone(readState().tickets.filter((ticket) => ticket.incidentId === incidentId));
}

export function selectUnresolvedCriticalSupportTicketsByIncident(incidentId: string): ProductionSupportTicket[] {
  return clone(readState().tickets.filter((ticket) => ticket.incidentId === incidentId && isCriticalSupportTicket(ticket)));
}

export function selectEscalatedSupportTickets(): ProductionSupportTicket[] {
  return clone(readState().tickets.filter((ticket) => isSupportTicketOpen(ticket) && ticket.status === 'escalated'));
}

export function selectSupportBlockers(): SupportReadinessFinding[] {
  return selectSupportReadiness().blockers;
}

export function selectSupportWarnings(): SupportReadinessFinding[] {
  return selectSupportReadiness().warnings;
}

export function selectSupportReadiness(): SupportReadiness {
  const openTickets = selectOpenSupportTickets();
  const criticalTickets = selectCriticalSupportTickets();
  const breachedSlaTickets = selectBreachedSlaTickets();
  const blockers: SupportReadinessFinding[] = [
    ...criticalTickets.map((ticket) => finding(ticket.ticketId, `Critical customer-impact support ticket ${ticket.ticketId} remains unresolved.`, 'Resolve or downgrade the customer impact before go-live.', 'critical')),
    ...openTickets.filter((ticket) => ticket.status === 'escalated' && !ticket.escalationOwner).map((ticket) => finding(ticket.ticketId, `Escalated support ticket ${ticket.ticketId} is missing escalation owner.`, 'Assign an escalation owner before proceeding.', 'blocking')),
  ];
  const warnings: SupportReadinessFinding[] = [
    ...breachedSlaTickets.map((ticket) => finding(ticket.ticketId, `SLA breached for support ticket ${ticket.ticketId}.`, 'Notify the customer and document mitigation evidence.', 'warning')),
    ...openTickets.filter((ticket) => ticket.impactLevel === 'high' && !isCriticalSupportTicket(ticket)).map((ticket) => finding(ticket.ticketId, `High-impact support ticket ${ticket.ticketId} remains unresolved.`, 'Review high customer impact before go-live.', 'warning')),
  ];
  return {
    status: blockers.length ? 'blocked' : warnings.length ? 'warning' : 'ready',
    blockers,
    warnings,
    openCount: openTickets.length,
    criticalCount: criticalTickets.length,
    breachedSlaCount: breachedSlaTickets.length,
  };
}

export function selectSupportArtifacts(): ArtifactRecord[] {
  return clone(readState().artifacts);
}

export function selectProductionSupportDashboard(): ProductionSupportDashboard {
  const tickets = readState().tickets;
  const readiness = selectSupportReadiness();
  return {
    ...readiness,
    tickets: clone(tickets),
    openTickets: selectOpenSupportTickets(),
    criticalTickets: selectCriticalSupportTickets(),
    breachedSlaTickets: selectBreachedSlaTickets(),
    escalatedTickets: selectEscalatedSupportTickets(),
    customerImpact: selectCustomerImpactSummary(),
    artifacts: selectSupportArtifacts(),
  };
}
