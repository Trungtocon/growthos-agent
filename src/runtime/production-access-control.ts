import type { ArtifactRecord } from './artifact-registry';

export type ProductionUserRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'operator'
  | 'reviewer'
  | 'finance'
  | 'support'
  | 'viewer';

export type ProductionPermission =
  | 'view'
  | 'create'
  | 'edit'
  | 'approve'
  | 'reject'
  | 'export'
  | 'configure'
  | 'activate'
  | 'suspend'
  | 'rollback'
  | 'delete';

export type ProductionAccessModule =
  | 'production-billing'
  | 'tenant-production-binding'
  | 'production-readiness'
  | 'go-live-control'
  | 'production-operations'
  | 'production-support'
  | 'production-compliance'
  | 'production-incidents'
  | 'production-runbook'
  | 'backend-readiness'
  | 'database-readiness'
  | 'auth-readiness'
  | 'environment-readiness';

export interface ProductionAccessUser {
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  role: ProductionUserRole;
  status: 'invited' | 'active' | 'suspended' | 'blocked';
  createdAt: string;
  updatedAt: string;
  blockers: string[];
}

export interface RolePermissionRow {
  role: ProductionUserRole;
  permissions: ProductionPermission[];
  description: string;
}

export interface ModuleAccessRow {
  moduleId: ProductionAccessModule;
  label: string;
  requiredPlanModule: string;
  enterpriseOnly?: boolean;
  locked: boolean;
  lockReason?: string;
  allowedRoles: ProductionUserRole[];
  allowedPermissions: ProductionPermission[];
}

export interface AccessCheckInput {
  actor: string;
  action: ProductionPermission;
  moduleId: ProductionAccessModule;
  tenantId?: string;
  objectId?: string;
}

export interface AccessCheckResult {
  id: string;
  tenantId: string;
  actor: string;
  actorRole: ProductionUserRole;
  action: ProductionPermission;
  moduleId: ProductionAccessModule;
  allowed: boolean;
  reasons: string[];
  checkedAt: string;
}

export interface UserQuotaResult {
  tenantId: string;
  status: 'ok' | 'warning' | 'blocked';
  used: number;
  limit: number;
  percent: number;
  warnings: string[];
  blockers: string[];
}

export interface AccessAuditEvent {
  eventId: string;
  tenantId: string;
  actor: string;
  actorRole: ProductionUserRole;
  action: ProductionPermission | 'invite' | 'seed' | 'export';
  moduleId?: ProductionAccessModule;
  objectId?: string;
  allowed: boolean;
  reason: string;
  timestamp: string;
}

export interface ProductionAccessControlDashboard {
  tenantId: string;
  users: ProductionAccessUser[];
  roles: RolePermissionRow[];
  permissions: ProductionPermission[];
  modules: ModuleAccessRow[];
  userQuota: UserQuotaResult;
  blockedActions: AccessCheckResult[];
  auditLog: AccessAuditEvent[];
  artifacts: ArtifactRecord[];
  summary: {
    users: number;
    roles: number;
    modules: number;
    lockedModules: number;
    blockedActions: number;
    quotaStatus: UserQuotaResult['status'];
  };
}

export interface ProductionAccessControlState {
  users: ProductionAccessUser[];
  auditLog: AccessAuditEvent[];
  artifacts: ArtifactRecord[];
  activeTenantId?: string;
  updatedAt: string;
}
