import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import {
  getLicenseEntitlements,
  selectProductionBillingDashboard,
} from './production-billing-store';
import type {
  AccessAuditEvent,
  AccessCheckInput,
  AccessCheckResult,
  ModuleAccessRow,
  ProductionAccessControlDashboard,
  ProductionAccessControlState,
  ProductionAccessModule,
  ProductionAccessUser,
  ProductionPermission,
  ProductionUserRole,
  RolePermissionRow,
  UserQuotaResult,
} from './production-access-control';

const PRODUCTION_ACCESS_KEY = 'uikigai-production-access-control-v1';
const DEFAULT_TENANT_ID = 'tenant-uikigai-demo';

export const PRODUCTION_ROLES: RolePermissionRow[] = [
  { role: 'owner', description: 'Tenant owner with full production control.', permissions: ['view', 'create', 'edit', 'approve', 'reject', 'export', 'configure', 'activate', 'suspend', 'rollback', 'delete'] },
  { role: 'admin', description: 'Admin with production configuration and approval rights.', permissions: ['view', 'create', 'edit', 'approve', 'reject', 'export', 'configure', 'activate', 'suspend', 'rollback'] },
  { role: 'manager', description: 'Manager with operational edit and export rights.', permissions: ['view', 'create', 'edit', 'export'] },
  { role: 'operator', description: 'Operator for live production actions and rollback.', permissions: ['view', 'create', 'edit', 'export', 'activate', 'rollback'] },
  { role: 'reviewer', description: 'Reviewer for approval and rejection gates.', permissions: ['view', 'approve', 'reject', 'export'] },
  { role: 'finance', description: 'Finance owner for billing and subscription controls.', permissions: ['view', 'edit', 'export', 'configure', 'activate', 'suspend'] },
  { role: 'support', description: 'Support operator for customer impact workflows.', permissions: ['view', 'create', 'edit', 'export'] },
  { role: 'viewer', description: 'Read-only production observer.', permissions: ['view'] },
];

export const PRODUCTION_PERMISSIONS: ProductionPermission[] = ['view', 'create', 'edit', 'approve', 'reject', 'export', 'configure', 'activate', 'suspend', 'rollback', 'delete'];

const MODULES: Array<Omit<ModuleAccessRow, 'locked' | 'lockReason'>> = [
  { moduleId: 'production-billing', label: 'Production Billing', requiredPlanModule: 'support', allowedRoles: ['owner', 'admin', 'finance'], allowedPermissions: ['view', 'edit', 'export', 'configure', 'activate', 'suspend'] },
  { moduleId: 'tenant-production-binding', label: 'Tenant Production Binding', requiredPlanModule: 'governance', allowedRoles: ['owner', 'admin', 'operator', 'reviewer'], allowedPermissions: ['view', 'create', 'edit', 'approve', 'reject', 'activate', 'export'] },
  { moduleId: 'production-readiness', label: 'Production Readiness', requiredPlanModule: 'governance', allowedRoles: ['owner', 'admin', 'reviewer', 'operator'], allowedPermissions: ['view', 'approve', 'reject', 'export'] },
  { moduleId: 'go-live-control', label: 'Go-Live Control', requiredPlanModule: 'governance', allowedRoles: ['owner', 'admin', 'reviewer'], allowedPermissions: ['view', 'approve', 'reject', 'export', 'rollback'] },
  { moduleId: 'production-operations', label: 'Production Operations', requiredPlanModule: 'operations', allowedRoles: ['owner', 'admin', 'operator', 'support'], allowedPermissions: ['view', 'create', 'edit', 'export', 'rollback'] },
  { moduleId: 'production-support', label: 'Production Support', requiredPlanModule: 'support', allowedRoles: ['owner', 'admin', 'support', 'operator'], allowedPermissions: ['view', 'create', 'edit', 'export'] },
  { moduleId: 'production-compliance', label: 'Production Compliance', requiredPlanModule: 'compliance', enterpriseOnly: true, allowedRoles: ['owner', 'admin', 'reviewer'], allowedPermissions: ['view', 'approve', 'reject', 'export'] },
  { moduleId: 'production-incidents', label: 'Production Incidents', requiredPlanModule: 'operations', allowedRoles: ['owner', 'admin', 'operator', 'support'], allowedPermissions: ['view', 'create', 'edit', 'export', 'rollback'] },
  { moduleId: 'production-runbook', label: 'Production Runbook', requiredPlanModule: 'operations', allowedRoles: ['owner', 'admin', 'operator', 'reviewer'], allowedPermissions: ['view', 'create', 'edit', 'approve', 'export'] },
  { moduleId: 'backend-readiness', label: 'Backend Readiness', requiredPlanModule: 'governance', allowedRoles: ['owner', 'admin', 'operator'], allowedPermissions: ['view', 'configure', 'export'] },
  { moduleId: 'database-readiness', label: 'Database Readiness', requiredPlanModule: 'governance', allowedRoles: ['owner', 'admin', 'operator'], allowedPermissions: ['view', 'configure', 'export'] },
  { moduleId: 'auth-readiness', label: 'Auth Readiness', requiredPlanModule: 'governance', allowedRoles: ['owner', 'admin', 'operator'], allowedPermissions: ['view', 'configure', 'export'] },
  { moduleId: 'environment-readiness', label: 'Environment Readiness', requiredPlanModule: 'governance', allowedRoles: ['owner', 'admin', 'operator'], allowedPermissions: ['view', 'configure', 'export'] },
];

const DEFAULT_USERS: Array<Pick<ProductionAccessUser, 'name' | 'email' | 'role'>> = [
  { name: 'Tenant Owner', email: 'owner@growthos.example', role: 'owner' },
  { name: 'VP Engineering', email: 'vp-engineering@growthos.example', role: 'owner' },
  { name: 'VP Operations', email: 'vp-operations@growthos.example', role: 'admin' },
  { name: 'Release Captain', email: 'release-captain@growthos.example', role: 'reviewer' },
  { name: 'Compliance Reviewer', email: 'compliance-reviewer@growthos.example', role: 'reviewer' },
  { name: 'Security Reviewer', email: 'security-reviewer@growthos.example', role: 'reviewer' },
  { name: 'Finance Reviewer', email: 'finance@growthos.example', role: 'finance' },
  { name: 'Billing Operator', email: 'billing@growthos.example', role: 'finance' },
  { name: 'Incident Operator', email: 'incident-operator@growthos.example', role: 'operator' },
  { name: 'Incident Commander', email: 'incident-commander@growthos.example', role: 'operator' },
  { name: 'Release Operator', email: 'release-operator@growthos.example', role: 'operator' },
  { name: 'Support Agent', email: 'support@growthos.example', role: 'support' },
  { name: 'Audit Reviewer', email: 'audit-reviewer@growthos.example', role: 'reviewer' },
];

function nowIso(): string {
  return new Date().toISOString();
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): ProductionAccessControlState {
  return { users: [], auditLog: [], artifacts: [], updatedAt: nowIso() };
}

function readState(): ProductionAccessControlState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(PRODUCTION_ACCESS_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ProductionAccessControlState>;
    return {
      users: parsed.users ?? [],
      auditLog: parsed.auditLog ?? [],
      artifacts: parsed.artifacts ?? [],
      activeTenantId: parsed.activeTenantId,
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ProductionAccessControlState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PRODUCTION_ACCESS_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function rolePermissions(role: ProductionUserRole): ProductionPermission[] {
  return PRODUCTION_ROLES.find((entry) => entry.role === role)?.permissions ?? ['view'];
}

function modulesForTenant(tenantId = DEFAULT_TENANT_ID): ModuleAccessRow[] {
  const billing = selectProductionBillingDashboard(tenantId);
  const entitlements = getLicenseEntitlements(billing.summary.planId);
  return MODULES.map((module) => {
    const included = entitlements.allowedModules.includes(module.requiredPlanModule) || module.requiredPlanModule === 'production' && entitlements.allowedModules.includes('production');
    const enterpriseLocked = Boolean(module.enterpriseOnly && billing.summary.planId !== 'enterprise');
    const locked = !included || enterpriseLocked;
    return {
      ...module,
      locked,
      lockReason: locked
        ? enterpriseLocked
          ? `${module.label} enterprise controls require Enterprise plan.`
          : `${module.label} is not included in the current plan entitlement.`
        : undefined,
    };
  });
}

function persistAudit(event: Omit<AccessAuditEvent, 'eventId' | 'timestamp'>): AccessAuditEvent {
  const state = readState();
  const next: AccessAuditEvent = { ...event, eventId: unique('access-audit'), timestamp: nowIso() };
  writeState({ ...state, auditLog: [next, ...state.auditLog].slice(0, 250), activeTenantId: event.tenantId });
  return clone(next);
}

function resolveActorRole(actor: string, tenantId = DEFAULT_TENANT_ID): ProductionUserRole {
  const normalized = actor.trim().toLowerCase();
  const users = readState().users;
  const user = users.find((entry) => entry.tenantId === tenantId && (entry.name.toLowerCase() === normalized || entry.email.toLowerCase() === normalized));
  if (user) return user.role;
  const fallback = DEFAULT_USERS.find((entry) => entry.name.toLowerCase() === normalized || entry.email.toLowerCase() === normalized);
  return fallback?.role ?? 'viewer';
}

export function clearProductionAccessControlStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PRODUCTION_ACCESS_KEY);
}

export function seedDefaultAccessUsers(tenantId = DEFAULT_TENANT_ID): ProductionAccessUser[] {
  const state = readState();
  const existing = state.users.filter((entry) => entry.tenantId !== tenantId);
  const timestamp = nowIso();
  const users = DEFAULT_USERS.map((user) => ({
    userId: `access-user-${tenantId}-${user.role}-${user.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    tenantId,
    name: user.name,
    email: user.email,
    role: user.role,
    status: 'active' as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    blockers: [],
  }));
  writeState({ ...state, users: [...users, ...existing], activeTenantId: tenantId });
  persistAudit({ tenantId, actor: 'System', actorRole: 'admin', action: 'seed', allowed: true, reason: 'Default production access users seeded.' });
  return clone(users);
}

export function evaluateUserQuota(tenantId = DEFAULT_TENANT_ID): UserQuotaResult {
  const billing = selectProductionBillingDashboard(tenantId);
  const used = readState().users.filter((entry) => entry.tenantId === tenantId && entry.status !== 'blocked').length;
  const limit = billing.entitlements.userLimit;
  const percent = limit > 0 ? Math.round((used / limit) * 100) : 100;
  const warnings = percent >= 80 && used <= limit ? [`User seats are at ${percent}% of licensed quota.`] : [];
  const blockers = used >= limit ? [`User quota is exhausted: ${used}/${limit} seats used.`] : [];
  return { tenantId, status: blockers.length ? 'blocked' : warnings.length ? 'warning' : 'ok', used, limit, percent, warnings, blockers };
}

export function inviteProductionUser(input: {
  tenantId?: string;
  name: string;
  email: string;
  role: ProductionUserRole;
}): ProductionAccessUser {
  const tenantId = input.tenantId ?? readState().activeTenantId ?? DEFAULT_TENANT_ID;
  const quota = evaluateUserQuota(tenantId);
  const timestamp = nowIso();
  const blocked = quota.status === 'blocked';
  const user: ProductionAccessUser = {
    userId: unique('access-user'),
    tenantId,
    name: input.name,
    email: input.email,
    role: input.role,
    status: blocked ? 'blocked' : 'invited',
    createdAt: timestamp,
    updatedAt: timestamp,
    blockers: blocked ? quota.blockers : [],
  };
  const state = readState();
  writeState({ ...state, users: [user, ...state.users], activeTenantId: tenantId });
  persistAudit({ tenantId, actor: 'Access Admin', actorRole: 'admin', action: 'invite', allowed: !blocked, reason: blocked ? quota.blockers.join(' ') : `Invited ${input.role} user ${input.email}.` });
  return clone(user);
}

export function suspendProductionUser(userId?: string, actor = 'Access Admin'): ProductionAccessUser | undefined {
  const state = readState();
  const user = userId ? state.users.find((entry) => entry.userId === userId) : state.users[0];
  if (!user) return undefined;
  const updated = { ...user, status: 'suspended' as const, updatedAt: nowIso() };
  writeState({ ...state, users: [updated, ...state.users.filter((entry) => entry.userId !== updated.userId)], activeTenantId: updated.tenantId });
  persistAudit({ tenantId: updated.tenantId, actor, actorRole: resolveActorRole(actor, updated.tenantId), action: 'suspend', moduleId: 'production-operations', objectId: updated.userId, allowed: true, reason: 'Production user suspended.' });
  return clone(updated);
}

export function evaluateActionAccess(input: AccessCheckInput): AccessCheckResult {
  const tenantId = input.tenantId ?? readState().activeTenantId ?? DEFAULT_TENANT_ID;
  const actorRole = resolveActorRole(input.actor, tenantId);
  const module = modulesForTenant(tenantId).find((entry) => entry.moduleId === input.moduleId);
  const permissions = rolePermissions(actorRole);
  const reasons: string[] = [];
  if (!module) reasons.push(`Module ${input.moduleId} is unknown.`);
  if (module?.locked) reasons.push(module.lockReason ?? `${module.label} is locked by license entitlement.`);
  if (!permissions.includes(input.action)) reasons.push(`Role ${actorRole} does not include ${input.action} permission.`);
  if (module && !module.allowedRoles.includes(actorRole)) reasons.push(`Role ${actorRole} is not allowed to operate ${module.label}.`);
  if (module && !module.allowedPermissions.includes(input.action)) reasons.push(`${input.action} is not allowed on ${module.label}.`);
  const result: AccessCheckResult = {
    id: unique('access-check'),
    tenantId,
    actor: input.actor,
    actorRole,
    action: input.action,
    moduleId: input.moduleId,
    allowed: reasons.length === 0,
    reasons,
    checkedAt: nowIso(),
  };
  persistAudit({
    tenantId,
    actor: input.actor,
    actorRole,
    action: input.action,
    moduleId: input.moduleId,
    objectId: input.objectId,
    allowed: result.allowed,
    reason: result.allowed ? `${actorRole} allowed to ${input.action} ${input.moduleId}.` : reasons.join(' '),
  });
  return clone(result);
}

function createArtifact(name: string, summary: string, type: ArtifactRecord['type'] = 'AUDIT'): ArtifactRecord {
  const timestamp = nowIso();
  return {
    id: `access-control-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    type,
    lifecycle: 'AVAILABLE',
    workspaceId: demoWorkspace.id,
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      source: 'mock',
      sourceType: 'production-access-control',
      contentSummary: summary,
      tags: ['production-access-control', 'rbac', 'license-aware-access'],
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function exportAccessAuditReport(tenantId?: string): ArtifactRecord[] {
  const dashboard = selectProductionAccessControlDashboard(tenantId);
  const artifacts = [
    createArtifact('access-control-matrix.json', `${dashboard.modules.length} module access row(s).`),
    createArtifact('role-permission-report.md', `${dashboard.roles.length} role permission row(s).`, 'REPORT'),
    createArtifact('blocked-actions.json', `${dashboard.blockedActions.length} blocked action(s).`),
    createArtifact('user-quota-report.md', `User quota ${dashboard.userQuota.used}/${dashboard.userQuota.limit}.`, 'REPORT'),
    createArtifact('access-audit-log.json', `${dashboard.auditLog.length} access audit event(s).`),
  ].map((artifact) => registerArtifact(artifact, { createdBy: 'production-access-control' }));
  const state = readState();
  writeState({ ...state, artifacts: artifacts.concat(state.artifacts.filter((entry) => !artifacts.some((artifact) => artifact.id === entry.id))) });
  persistAudit({ tenantId: dashboard.tenantId, actor: 'Access Admin', actorRole: 'admin', action: 'export', allowed: true, reason: 'Access audit artifacts exported.' });
  return clone(artifacts);
}

export function selectAccessAuditLog(): AccessAuditEvent[] {
  return clone(readState().auditLog);
}

export function selectProductionAccessControlDashboard(tenantId?: string): ProductionAccessControlDashboard {
  const state = readState();
  const resolvedTenantId = tenantId ?? state.activeTenantId ?? DEFAULT_TENANT_ID;
  const users = state.users.filter((entry) => entry.tenantId === resolvedTenantId);
  const modules = modulesForTenant(resolvedTenantId);
  const blockedActions = state.auditLog
    .filter((event) => event.tenantId === resolvedTenantId && !event.allowed && event.moduleId)
    .map((event) => ({
      id: event.eventId,
      tenantId: event.tenantId,
      actor: event.actor,
      actorRole: event.actorRole,
      action: event.action as ProductionPermission,
      moduleId: event.moduleId as ProductionAccessModule,
      allowed: false,
      reasons: [event.reason],
      checkedAt: event.timestamp,
    }));
  return {
    tenantId: resolvedTenantId,
    users: clone(users),
    roles: clone(PRODUCTION_ROLES),
    permissions: clone(PRODUCTION_PERMISSIONS),
    modules: clone(modules),
    userQuota: evaluateUserQuota(resolvedTenantId),
    blockedActions: clone(blockedActions),
    auditLog: clone(state.auditLog.filter((event) => event.tenantId === resolvedTenantId)),
    artifacts: clone(state.artifacts),
    summary: {
      users: users.length,
      roles: PRODUCTION_ROLES.length,
      modules: modules.length,
      lockedModules: modules.filter((entry) => entry.locked).length,
      blockedActions: blockedActions.length,
      quotaStatus: evaluateUserQuota(resolvedTenantId).status,
    },
  };
}

export function selectProductionAccessControlArtifacts(): ArtifactRecord[] {
  return clone(readState().artifacts);
}
