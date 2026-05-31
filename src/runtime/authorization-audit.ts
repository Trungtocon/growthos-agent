import type { Artifact } from '../domain/types';
import type { AuthorizationDecision, PermissionId, RoleId } from './rbac';

export type AuthorizationRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AuthorizationAuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  roleId: RoleId;
  organizationId: string;
  tenantId: string;
  workspaceId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  allowed: boolean;
  deniedReason?: string;
  missingPermissions: PermissionId[];
  riskLevel: AuthorizationRiskLevel;
  source: string;
}

export interface AuthorizationAuditSummary {
  totalEvents: number;
  allowedEvents: number;
  deniedEvents: number;
  highRiskEvents: number;
  criticalEvents: number;
  repeatedDeniedActions: number;
  byActor: Array<{ actorId: string; actorName: string; events: number; denied: number; highRisk: number }>;
  byWorkspace: Array<{ workspaceId: string; events: number; denied: number; highRisk: number }>;
  byTenant: Array<{ tenantId: string; events: number; denied: number; highRisk: number }>;
  byRisk: Record<AuthorizationRiskLevel, number>;
}

export interface AuthorizationReviewItem {
  id: string;
  eventId: string;
  createdAt: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  riskLevel: AuthorizationRiskLevel;
  reason: string;
  status: 'open' | 'reviewed';
}

export interface AuthorizationAuditArtifactsInput {
  events: AuthorizationAuditEvent[];
  deniedActions: AuthorizationAuditEvent[];
  reviewItems: AuthorizationReviewItem[];
  summary: AuthorizationAuditSummary;
}

const riskOrder: AuthorizationRiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function riskMax(a: AuthorizationRiskLevel, b: AuthorizationRiskLevel): AuthorizationRiskLevel {
  return riskOrder.indexOf(a) >= riskOrder.indexOf(b) ? a : b;
}

function countBy<T extends string>(items: T[]): Record<T, number> {
  return items.reduce((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function resourceTypeFor(action: string, resourceId?: string): string {
  if (action.includes('budget')) return 'budget';
  if (action.includes('deployment')) return 'deployment';
  if (action.includes('policy')) return 'policy';
  if (action.includes('artifact')) return 'artifact';
  if (action.includes('run') || action.includes('plan')) return 'run';
  if (action.includes('organization') || resourceId?.startsWith('org-')) return 'organization';
  if (resourceId?.startsWith('tenant-')) return 'tenant';
  if (resourceId?.startsWith('workspace-')) return 'workspace';
  return 'workspace';
}

export function riskForAuthorizationDecision(decision: AuthorizationDecision, repeatedDeniedCount = 0): AuthorizationRiskLevel {
  if (decision.allowed) return 'LOW';
  let risk: AuthorizationRiskLevel = 'MEDIUM';
  if (decision.action === 'override_budget') risk = riskMax(risk, 'HIGH');
  if (decision.action === 'approve_deployment') risk = riskMax(risk, 'CRITICAL');
  if (decision.action === 'modify_policy') risk = riskMax(risk, 'HIGH');
  if (decision.action.includes('organization') || decision.missingPermissions.includes('organization.edit')) risk = riskMax(risk, 'CRITICAL');
  if (repeatedDeniedCount >= 2) risk = riskMax(risk, 'HIGH');
  return risk;
}

export function recordAuthorizationDecision(input: {
  decision: AuthorizationDecision;
  actorName: string;
  organizationId: string;
  tenantId: string;
  workspaceId: string;
  source?: string;
  previousEvents?: AuthorizationAuditEvent[];
}): AuthorizationAuditEvent {
  const repeatedDeniedCount = (input.previousEvents ?? []).filter((event) =>
    !event.allowed && event.actorId === input.decision.actorId && event.action === input.decision.action
  ).length;
  return {
    id: `auth-audit-${input.decision.id}`,
    timestamp: input.decision.createdAt,
    actorId: input.decision.actorId,
    actorName: input.actorName,
    roleId: input.decision.roleId,
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    action: input.decision.action,
    resourceType: resourceTypeFor(input.decision.action, input.decision.resourceId),
    resourceId: input.decision.resourceId,
    allowed: input.decision.allowed,
    deniedReason: input.decision.allowed ? undefined : input.decision.reason,
    missingPermissions: input.decision.missingPermissions,
    riskLevel: riskForAuthorizationDecision(input.decision, repeatedDeniedCount),
    source: input.source ?? 'rbac-store',
  };
}

export function detectRepeatedDeniedActions(events: AuthorizationAuditEvent[], threshold = 3): AuthorizationAuditEvent[] {
  const denied = events.filter((event) => !event.allowed);
  const counts = countBy(denied.map((event) => `${event.actorId}:${event.action}`));
  return denied.filter((event) => (counts[`${event.actorId}:${event.action}`] ?? 0) >= threshold);
}

export function detectHighRiskAuthorizationAttempts(events: AuthorizationAuditEvent[]): AuthorizationAuditEvent[] {
  return events.filter((event) => event.riskLevel === 'HIGH' || event.riskLevel === 'CRITICAL');
}

export function createAuthorizationReviewItem(event: AuthorizationAuditEvent): AuthorizationReviewItem | undefined {
  if (event.allowed && event.riskLevel !== 'CRITICAL') return undefined;
  if (event.riskLevel === 'LOW' || event.riskLevel === 'MEDIUM') return undefined;
  return {
    id: `auth-review-${event.id}`,
    eventId: event.id,
    createdAt: event.timestamp,
    actorId: event.actorId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    riskLevel: event.riskLevel,
    reason: event.deniedReason ?? `${event.action} requires governance review.`,
    status: 'open',
  };
}

function groupEvents<T extends string>(
  events: AuthorizationAuditEvent[],
  key: (event: AuthorizationAuditEvent) => T,
  label: 'actor' | 'workspace' | 'tenant',
) {
  const grouped = new Map<T, AuthorizationAuditEvent[]>();
  for (const event of events) {
    const groupKey = key(event);
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), event]);
  }
  return [...grouped.entries()].map(([id, rows]) => ({
    ...(label === 'actor' ? { actorId: id, actorName: rows[0]?.actorName ?? id } : {}),
    ...(label === 'workspace' ? { workspaceId: id } : {}),
    ...(label === 'tenant' ? { tenantId: id } : {}),
    events: rows.length,
    denied: rows.filter((event) => !event.allowed).length,
    highRisk: detectHighRiskAuthorizationAttempts(rows).length,
  }));
}

export function summarizeAuthorizationEvents(events: AuthorizationAuditEvent[]): AuthorizationAuditSummary {
  const byRisk = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  } satisfies Record<AuthorizationRiskLevel, number>;
  for (const event of events) byRisk[event.riskLevel] += 1;
  return {
    totalEvents: events.length,
    allowedEvents: events.filter((event) => event.allowed).length,
    deniedEvents: events.filter((event) => !event.allowed).length,
    highRiskEvents: byRisk.HIGH,
    criticalEvents: byRisk.CRITICAL,
    repeatedDeniedActions: detectRepeatedDeniedActions(events).length,
    byActor: groupEvents(events, (event) => event.actorId, 'actor') as AuthorizationAuditSummary['byActor'],
    byWorkspace: groupEvents(events, (event) => event.workspaceId, 'workspace') as AuthorizationAuditSummary['byWorkspace'],
    byTenant: groupEvents(events, (event) => event.tenantId, 'tenant') as AuthorizationAuditSummary['byTenant'],
    byRisk,
  };
}

export function authorizationAuditArtifacts(input: AuthorizationAuditArtifactsInput, runId: string): Artifact[] {
  const now = new Date().toISOString();
  const riskRows = Object.entries(input.summary.byRisk)
    .map(([risk, count]) => `| ${risk} | ${count} |`)
    .join('\n');
  const eventRows = input.events.slice(0, 25).map((event) =>
    `| ${event.timestamp} | ${event.actorName} | ${event.action} | ${event.allowed ? 'allowed' : 'denied'} | ${event.riskLevel} |`
  ).join('\n');
  const deniedRows = input.deniedActions.slice(0, 25).map((event) =>
    `| ${event.timestamp} | ${event.actorName} | ${event.action} | ${event.deniedReason ?? 'Denied'} | ${event.riskLevel} |`
  ).join('\n');
  return [
    {
      id: `artifact-${runId}-authorization-audit-summary`,
      runId,
      type: 'markdown',
      name: 'authorization-audit-summary.md',
      contentSummary: 'Authorization audit summary, risk counts, and recent authorization decisions.',
      contentText: `# Authorization Audit Summary\n\nTotal events: ${input.summary.totalEvents}\n\nDenied events: ${input.summary.deniedEvents}\n\nReview queue: ${input.reviewItems.length}\n\n## Risk Summary\n\n| Risk | Count |\n|---|---:|\n${riskRows}\n\n## Recent Events\n\n| Time | Actor | Action | Result | Risk |\n|---|---|---|---|---|\n${eventRows}\n`,
      source: 'mock',
      createdAt: now,
      sizeBytes: 2400,
    },
    {
      id: `artifact-${runId}-authorization-risk-report`,
      runId,
      type: 'markdown',
      name: 'authorization-risk-report.md',
      contentSummary: 'High-risk denied authorization attempts and governance review queue.',
      contentText: `# Authorization Risk Report\n\n## Denied Actions\n\n| Time | Actor | Action | Reason | Risk |\n|---|---|---|---|---|\n${deniedRows}\n`,
      source: 'mock',
      createdAt: now,
      sizeBytes: 2200,
    },
    {
      id: `artifact-${runId}-authorization-events`,
      runId,
      type: 'json',
      name: 'authorization-events.json',
      contentSummary: 'Machine-readable authorization audit event ledger.',
      contentJson: input.events,
      language: 'json',
      source: 'mock',
      createdAt: now,
      sizeBytes: JSON.stringify(input.events).length,
    },
    {
      id: `artifact-${runId}-denied-actions-report`,
      runId,
      type: 'markdown',
      name: 'denied-actions-report.md',
      contentSummary: 'Denied authorization action report with review items.',
      contentText: `# Denied Actions Report\n\nOpen review items: ${input.reviewItems.length}\n\n| Time | Actor | Action | Reason | Risk |\n|---|---|---|---|---|\n${deniedRows}\n`,
      source: 'mock',
      createdAt: now,
      sizeBytes: JSON.stringify(input.deniedActions).length,
    },
  ];
}
