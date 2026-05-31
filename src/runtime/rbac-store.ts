import { demoCurrentUser } from '../data/demo-fixtures';
import {
  authorizeRole,
  denialFromDecision,
  permissionsForRole,
  RBAC_ACCESS_POLICIES,
  RBAC_PERMISSIONS,
  RBAC_ROLES,
  RBAC_ROLE_PERMISSIONS,
  rbacArtifacts,
  type AuthorizationDecision,
  type DeniedAction,
  type Permission,
  type PermissionId,
  type RbacSummary,
  type Role,
  type RoleId,
  type RolePermission,
} from './rbac';

const RBAC_STORAGE_KEY = 'uikigai-runtime-rbac-v1';

interface RbacState {
  roles: Role[];
  permissions: Permission[];
  roleMappings: Record<string, RoleId>;
  rolePermissions: RolePermission[];
  authorizationHistory: AuthorizationDecision[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): RbacState {
  return {
    roles: RBAC_ROLES,
    permissions: RBAC_PERMISSIONS,
    roleMappings: {
      [demoCurrentUser.id]: 'WorkspaceAdmin',
      'member-admin': 'WorkspaceAdmin',
      'member-manager': 'Operator',
      'member-operator': 'Operator',
      'member-growth': 'Reviewer',
      'member-viewer': 'Viewer',
    },
    rolePermissions: RBAC_ROLE_PERMISSIONS,
    authorizationHistory: [],
  };
}

function readState(): RbacState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(RBAC_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<RbacState> : {};
    return {
      ...emptyState(),
      ...parsed,
      roles: parsed.roles ?? RBAC_ROLES,
      permissions: parsed.permissions ?? RBAC_PERMISSIONS,
      rolePermissions: parsed.rolePermissions ?? RBAC_ROLE_PERMISSIONS,
      roleMappings: { ...emptyState().roleMappings, ...(parsed.roleMappings ?? {}) },
      authorizationHistory: parsed.authorizationHistory ?? [],
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: RbacState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(RBAC_STORAGE_KEY, JSON.stringify(state));
}

function updateState(updater: (state: RbacState) => RbacState): RbacState {
  const next = updater(readState());
  writeState(next);
  return next;
}

export function getCurrentRole(actorId = demoCurrentUser.id): Role {
  const state = readState();
  const roleId = state.roleMappings[actorId] ?? 'Viewer';
  return state.roles.find((role) => role.id === roleId) ?? state.roles[state.roles.length - 1];
}

export function setCurrentRole(roleId: RoleId, actorId = demoCurrentUser.id): Role {
  updateState((state) => ({
    ...state,
    roleMappings: { ...state.roleMappings, [actorId]: roleId },
  }));
  return getCurrentRole(actorId);
}

export function getRoles(): Role[] {
  return clone(readState().roles);
}

export function getPermissions(): Permission[] {
  return clone(readState().permissions);
}

export function getRolePermissions(): RolePermission[] {
  return clone(readState().rolePermissions);
}

export function getEffectivePermissions(actorId = demoCurrentUser.id): Permission[] {
  return permissionsForRole(getCurrentRole(actorId).id);
}

export function getPermissionMatrix() {
  const permissions = getPermissions();
  return getRoles().map((role) => {
    const effective = new Set(permissionsForRole(role.id).map((permission) => permission.id));
    return {
      role,
      permissions: permissions.map((permission) => ({
        permission,
        allowed: effective.has(permission.id),
      })),
    };
  });
}

export function getRoleMatrix() {
  return getRoles().map((role) => ({
    ...role,
    permissionCount: permissionsForRole(role.id).length,
    permissions: permissionsForRole(role.id).map((permission) => permission.id),
  }));
}

export function getAuthorizationHistory(): AuthorizationDecision[] {
  return clone(readState().authorizationHistory);
}

export function getDeniedActions(): DeniedAction[] {
  return getAuthorizationHistory()
    .map(denialFromDecision)
    .filter((item): item is DeniedAction => Boolean(item));
}

function persistDecision(decision: AuthorizationDecision): AuthorizationDecision {
  updateState((state) => ({
    ...state,
    authorizationHistory: [decision, ...state.authorizationHistory].slice(0, 100),
  }));
  return decision;
}

export function authorizeAction(input: {
  action: string;
  resourceId?: string;
  actorId?: string;
  requiredPermissions: PermissionId[];
}): AuthorizationDecision {
  const actorId = input.actorId ?? demoCurrentUser.id;
  const decision = authorizeRole({
    actorId,
    roleId: getCurrentRole(actorId).id,
    action: input.action,
    resourceId: input.resourceId,
    requiredPermissions: input.requiredPermissions,
  });
  return persistDecision(decision);
}

function action(requiredPermissions: PermissionId[], actionName: string, resourceId?: string, actorId?: string) {
  return authorizeAction({ action: actionName, resourceId, actorId, requiredPermissions });
}

export function canView(resourceId?: string, actorId?: string) {
  return action(['workspace.view'], 'view', resourceId, actorId);
}

export function canEdit(resourceId?: string, actorId?: string) {
  return action(['workspace.edit'], 'edit', resourceId, actorId);
}

export function canStartRun(resourceId?: string, actorId?: string) {
  return action(['run.create', 'run.start'], 'start_run', resourceId, actorId);
}

export function canCancelRun(resourceId?: string, actorId?: string) {
  return action(['run.cancel'], 'cancel_run', resourceId, actorId);
}

export function canApprovePlan(resourceId?: string, actorId?: string) {
  return action(['run.approve'], 'approve_plan', resourceId, actorId);
}

export function canApproveDeployment(resourceId?: string, actorId?: string) {
  return action(['deployment.approve'], 'approve_deployment', resourceId, actorId);
}

export function canExportArtifact(resourceId?: string, actorId?: string) {
  return action(['artifact.view', 'artifact.export'], 'export_artifact', resourceId, actorId);
}

export function canOverrideBudget(resourceId?: string, actorId?: string) {
  return action(['budget.edit'], 'override_budget', resourceId, actorId);
}

export function canModifyPolicy(resourceId?: string, actorId?: string) {
  return action(['policy.edit'], 'modify_policy', resourceId, actorId);
}

export function getRbacSummary(): RbacSummary {
  const state = readState();
  const currentRole = getCurrentRole();
  return {
    currentRole,
    roles: clone(state.roles),
    permissions: clone(state.permissions),
    rolePermissions: clone(state.rolePermissions),
    accessPolicies: clone(RBAC_ACCESS_POLICIES),
    effectivePermissions: getEffectivePermissions(),
    authorizationHistory: getAuthorizationHistory(),
    deniedActions: getDeniedActions(),
  };
}

export function generateRbacArtifacts(runId: string) {
  return rbacArtifacts(getRbacSummary(), runId);
}

export function clearRbac() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(RBAC_STORAGE_KEY);
}
