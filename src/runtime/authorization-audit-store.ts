import { demoCurrentUser, demoWorkspace } from '../data/demo-fixtures';
import {
  authorizationAuditArtifacts,
  createAuthorizationReviewItem,
  detectHighRiskAuthorizationAttempts,
  detectRepeatedDeniedActions,
  recordAuthorizationDecision as buildAuthorizationAuditEvent,
  summarizeAuthorizationEvents,
  type AuthorizationAuditEvent,
  type AuthorizationAuditSummary,
  type AuthorizationReviewItem,
} from './authorization-audit';
import type { AuthorizationDecision } from './rbac';

const AUTHORIZATION_AUDIT_KEY = 'uikigai-authorization-audit-v1';
const ORGANIZATION_ID = 'org-growthos-enterprise';
const TENANT_ID = 'tenant-operations';

interface AuthorizationAuditState {
  authorizationEvents: AuthorizationAuditEvent[];
  deniedActions: AuthorizationAuditEvent[];
  reviewItems: AuthorizationReviewItem[];
  auditSummaries: AuthorizationAuditSummary[];
}

const actorNames: Record<string, string> = {
  [demoCurrentUser.id]: demoCurrentUser.name,
  'member-admin': 'Linh Nguyen',
  'member-manager': 'Minh Tran',
  'member-operator': 'An Pham',
  'member-growth': 'Hoa Le',
  'member-viewer': 'Tuan Vo',
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): AuthorizationAuditState {
  const summary = summarizeAuthorizationEvents([]);
  return {
    authorizationEvents: [],
    deniedActions: [],
    reviewItems: [],
    auditSummaries: [summary],
  };
}

function readState(): AuthorizationAuditState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(AUTHORIZATION_AUDIT_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<AuthorizationAuditState> : {};
    const events = parsed.authorizationEvents ?? [];
    const summary = summarizeAuthorizationEvents(events);
    return {
      authorizationEvents: events,
      deniedActions: parsed.deniedActions ?? events.filter((event) => !event.allowed),
      reviewItems: parsed.reviewItems ?? [],
      auditSummaries: parsed.auditSummaries?.length ? parsed.auditSummaries : [summary],
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: AuthorizationAuditState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(AUTHORIZATION_AUDIT_KEY, JSON.stringify(state));
}

function rebuildState(events: AuthorizationAuditEvent[]): AuthorizationAuditState {
  const orderedEvents = [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 250);
  const deniedActions = orderedEvents.filter((event) => !event.allowed);
  const highRiskEvents = detectHighRiskAuthorizationAttempts(orderedEvents);
  const repeatedEvents = detectRepeatedDeniedActions(orderedEvents);
  const reviewItemsById = new Map<string, AuthorizationReviewItem>();
  for (const event of [...highRiskEvents, ...repeatedEvents]) {
    const item = createAuthorizationReviewItem(event);
    if (item) reviewItemsById.set(item.id, item);
  }
  const summary = summarizeAuthorizationEvents(orderedEvents);
  return {
    authorizationEvents: orderedEvents,
    deniedActions,
    reviewItems: [...reviewItemsById.values()].slice(0, 100),
    auditSummaries: [summary, ...readState().auditSummaries].slice(0, 20),
  };
}

export function recordAuthorizationDecision(decision: AuthorizationDecision, source = 'rbac-store'): AuthorizationAuditEvent {
  const state = readState();
  const event = buildAuthorizationAuditEvent({
    decision,
    actorName: actorNames[decision.actorId] ?? decision.actorId,
    organizationId: ORGANIZATION_ID,
    tenantId: TENANT_ID,
    workspaceId: demoWorkspace.id,
    source,
    previousEvents: state.authorizationEvents,
  });
  const nextState = rebuildState([event, ...state.authorizationEvents]);
  writeState(nextState);
  return event;
}

export function getAuthorizationAuditEvents(): AuthorizationAuditEvent[] {
  return clone(readState().authorizationEvents);
}

export function getAuthorizationDeniedActions(): AuthorizationAuditEvent[] {
  return clone(readState().deniedActions);
}

export function getAuthorizationReviewItems(): AuthorizationReviewItem[] {
  return clone(readState().reviewItems);
}

export function getAuthorizationAuditSummaries(): AuthorizationAuditSummary[] {
  return clone(readState().auditSummaries);
}

export function getAuthorizationAuditSummary(): AuthorizationAuditSummary {
  return clone(readState().auditSummaries[0] ?? summarizeAuthorizationEvents([]));
}

export function getDeniedActionSummary() {
  const deniedActions = getAuthorizationDeniedActions();
  const repeated = detectRepeatedDeniedActions(getAuthorizationAuditEvents());
  return {
    totalDenied: deniedActions.length,
    repeatedDenied: repeated.length,
    byAction: Object.entries(deniedActions.reduce((acc, event) => {
      acc[event.action] = (acc[event.action] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)).map(([action, count]) => ({ action, count })),
  };
}

export function getAuthorizationRiskSummary() {
  const summary = getAuthorizationAuditSummary();
  return {
    byRisk: summary.byRisk,
    highRiskEvents: summary.highRiskEvents,
    criticalEvents: summary.criticalEvents,
    reviewItems: getAuthorizationReviewItems().length,
  };
}

export function getHighRiskAuthorizationEvents(): AuthorizationAuditEvent[] {
  return clone(detectHighRiskAuthorizationAttempts(readState().authorizationEvents));
}

export function getAuthorizationAuditByWorkspace(workspaceId?: string) {
  const events = getAuthorizationAuditEvents();
  return workspaceId ? events.filter((event) => event.workspaceId === workspaceId) : getAuthorizationAuditSummary().byWorkspace;
}

export function getAuthorizationAuditByTenant(tenantId?: string) {
  const events = getAuthorizationAuditEvents();
  return tenantId ? events.filter((event) => event.tenantId === tenantId) : getAuthorizationAuditSummary().byTenant;
}

export function getAuthorizationAuditByActor(actorId?: string) {
  const events = getAuthorizationAuditEvents();
  return actorId ? events.filter((event) => event.actorId === actorId) : getAuthorizationAuditSummary().byActor;
}

export function generateAuthorizationAuditArtifacts(runId: string) {
  return authorizationAuditArtifacts({
    events: getAuthorizationAuditEvents(),
    deniedActions: getAuthorizationDeniedActions(),
    reviewItems: getAuthorizationReviewItems(),
    summary: getAuthorizationAuditSummary(),
  }, runId);
}

export function clearAuthorizationAudit() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(AUTHORIZATION_AUDIT_KEY);
}
