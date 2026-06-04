import type { RuntimeEnvironmentId } from './environment-registry';

export type AuditEventStatus = 'success' | 'warning' | 'blocked' | 'failed';
export type AuditTargetType =
  | 'runtime'
  | 'approval'
  | 'governance'
  | 'backend'
  | 'database'
  | 'auth'
  | 'production-readiness'
  | 'artifact'
  | 'worker';

export interface AuditEventInput {
  actor: string;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  environment: RuntimeEnvironmentId;
  status: AuditEventStatus;
  metadata?: Record<string, unknown>;
}

export interface AuditEvent extends AuditEventInput {
  id: string;
  timestamp: string;
}

export interface AuditLogSummary {
  total: number;
  writable: boolean;
  byStatus: Record<AuditEventStatus, number>;
  lastEvent?: AuditEvent;
}

const AUDIT_LOG_KEY = 'uikigai-production-audit-log-v1';

function nowIso(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readEvents(): AuditEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(AUDIT_LOG_KEY);
    return raw ? JSON.parse(raw) as AuditEvent[] : [];
  } catch {
    return [];
  }
}

function writeEvents(events: AuditEvent[]) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(events));
}

export function appendAuditEvent(input: AuditEventInput): AuditEvent {
  const event: AuditEvent = {
    ...input,
    id: `audit-${input.action.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${Date.now()}`,
    timestamp: nowIso(),
  };
  writeEvents([event, ...readEvents()].slice(0, 300));
  return clone(event);
}

export function getAuditEvents(): AuditEvent[] {
  return clone(readEvents());
}

export function clearAuditLog() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(AUDIT_LOG_KEY);
}

export function selectAuditLogSummary(): AuditLogSummary {
  const events = readEvents();
  const byStatus: Record<AuditEventStatus, number> = {
    success: 0,
    warning: 0,
    blocked: 0,
    failed: 0,
  };
  for (const event of events) byStatus[event.status] += 1;
  return {
    total: events.length,
    writable: typeof window !== 'undefined',
    byStatus,
    lastEvent: events[0] ? clone(events[0]) : undefined,
  };
}
