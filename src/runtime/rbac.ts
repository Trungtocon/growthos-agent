import type { Artifact } from '../domain/types';

export type RoleId =
  | 'OrganizationOwner'
  | 'OrganizationAdmin'
  | 'TenantAdmin'
  | 'WorkspaceAdmin'
  | 'Operator'
  | 'Reviewer'
  | 'Viewer';

export type PermissionId =
  | 'organization.view'
  | 'organization.edit'
  | 'tenant.view'
  | 'tenant.edit'
  | 'workspace.view'
  | 'workspace.edit'
  | 'budget.view'
  | 'budget.edit'
  | 'policy.view'
  | 'policy.edit'
  | 'run.create'
  | 'run.start'
  | 'run.cancel'
  | 'run.approve'
  | 'artifact.view'
  | 'artifact.export'
  | 'cost.view'
  | 'analytics.view'
  | 'governance.view'
  | 'deployment.approve';

export interface Role {
  id: RoleId;
  name: string;
  description: string;
  rank: number;
}

export interface Permission {
  id: PermissionId;
  name: string;
  description: string;
  category: 'organization' | 'tenant' | 'workspace' | 'budget' | 'policy' | 'runtime' | 'artifact' | 'analytics' | 'governance';
}

export interface RolePermission {
  roleId: RoleId;
  permissionId: PermissionId;
}

export interface AccessPolicy {
  id: string;
  name: string;
  action: string;
  requiredPermissions: PermissionId[];
  severity: 'info' | 'warning' | 'blocking';
}

export interface AuthorizationDecision {
  id: string;
  actorId: string;
  roleId: RoleId;
  action: string;
  resourceId?: string;
  allowed: boolean;
  reason: string;
  missingPermissions: PermissionId[];
  createdAt: string;
}

export interface DeniedAction extends AuthorizationDecision {
  allowed: false;
  suggestedRole: RoleId;
}

export interface RbacSummary {
  currentRole: Role;
  permissions: Permission[];
  roles: Role[];
  rolePermissions: RolePermission[];
  accessPolicies: AccessPolicy[];
  effectivePermissions: Permission[];
  authorizationHistory: AuthorizationDecision[];
  deniedActions: DeniedAction[];
}

export const RBAC_ROLES: Role[] = [
  { id: 'OrganizationOwner', name: 'Organization Owner', description: 'Full ownership across organization, tenants, workspaces, runtime, budget, and policy.', rank: 100 },
  { id: 'OrganizationAdmin', name: 'Organization Admin', description: 'Administers organization governance and cross-tenant settings.', rank: 90 },
  { id: 'TenantAdmin', name: 'Tenant Admin', description: 'Manages tenant-level operations, budget review, and workspace governance.', rank: 75 },
  { id: 'WorkspaceAdmin', name: 'Workspace Admin', description: 'Manages workspace settings, runtime operations, and policy review.', rank: 60 },
  { id: 'Operator', name: 'Operator', description: 'Runs approved plans and manages day-to-day execution.', rank: 45 },
  { id: 'Reviewer', name: 'Reviewer', description: 'Reviews approvals, artifacts, and governance exceptions.', rank: 35 },
  { id: 'Viewer', name: 'Viewer', description: 'Read-only access to operational dashboards.', rank: 10 },
];

export const RBAC_PERMISSIONS: Permission[] = [
  { id: 'organization.view', name: 'View organization', description: 'Read organization hierarchy and health.', category: 'organization' },
  { id: 'organization.edit', name: 'Edit organization', description: 'Modify organization configuration.', category: 'organization' },
  { id: 'tenant.view', name: 'View tenants', description: 'Read tenant hierarchy and health.', category: 'tenant' },
  { id: 'tenant.edit', name: 'Edit tenants', description: 'Modify tenant configuration.', category: 'tenant' },
  { id: 'workspace.view', name: 'View workspace', description: 'Read workspace governance and members.', category: 'workspace' },
  { id: 'workspace.edit', name: 'Edit workspace', description: 'Modify workspace settings.', category: 'workspace' },
  { id: 'budget.view', name: 'View budget', description: 'Read budget, usage, and cost governance.', category: 'budget' },
  { id: 'budget.edit', name: 'Edit budget', description: 'Override budget and quota constraints.', category: 'budget' },
  { id: 'policy.view', name: 'View policies', description: 'Read policy reports and guardrails.', category: 'policy' },
  { id: 'policy.edit', name: 'Edit policies', description: 'Modify policy enforcement rules.', category: 'policy' },
  { id: 'run.create', name: 'Create run', description: 'Create runtime plans and queued runs.', category: 'runtime' },
  { id: 'run.start', name: 'Start run', description: 'Start an approved runtime execution.', category: 'runtime' },
  { id: 'run.cancel', name: 'Cancel run', description: 'Cancel an active runtime execution.', category: 'runtime' },
  { id: 'run.approve', name: 'Approve run', description: 'Approve run plans and runtime approvals.', category: 'runtime' },
  { id: 'artifact.view', name: 'View artifacts', description: 'Read generated artifacts.', category: 'artifact' },
  { id: 'artifact.export', name: 'Export artifacts', description: 'Export generated artifacts and reports.', category: 'artifact' },
  { id: 'cost.view', name: 'View cost', description: 'Read cost reconciliation and billing ledger.', category: 'analytics' },
  { id: 'analytics.view', name: 'View analytics', description: 'Read analytics and performance reports.', category: 'analytics' },
  { id: 'governance.view', name: 'View governance', description: 'Read governance health and audit events.', category: 'governance' },
  { id: 'deployment.approve', name: 'Approve deployment', description: 'Approve deployment-level or external production actions.', category: 'runtime' },
];

const rolePermissions: Record<RoleId, PermissionId[]> = {
  OrganizationOwner: RBAC_PERMISSIONS.map((permission) => permission.id),
  OrganizationAdmin: RBAC_PERMISSIONS.map((permission) => permission.id).filter((permission) => permission !== 'organization.edit'),
  TenantAdmin: [
    'organization.view',
    'tenant.view',
    'tenant.edit',
    'workspace.view',
    'workspace.edit',
    'budget.view',
    'budget.edit',
    'policy.view',
    'run.create',
    'run.start',
    'run.cancel',
    'run.approve',
    'artifact.view',
    'artifact.export',
    'cost.view',
    'analytics.view',
    'governance.view',
  ],
  WorkspaceAdmin: [
    'organization.view',
    'tenant.view',
    'workspace.view',
    'workspace.edit',
    'budget.view',
    'policy.view',
    'run.create',
    'run.start',
    'run.cancel',
    'run.approve',
    'artifact.view',
    'artifact.export',
    'cost.view',
    'analytics.view',
    'governance.view',
  ],
  Operator: [
    'organization.view',
    'tenant.view',
    'workspace.view',
    'budget.view',
    'policy.view',
    'run.create',
    'run.start',
    'run.cancel',
    'artifact.view',
    'cost.view',
    'analytics.view',
    'governance.view',
  ],
  Reviewer: [
    'organization.view',
    'tenant.view',
    'workspace.view',
    'budget.view',
    'policy.view',
    'run.approve',
    'artifact.view',
    'artifact.export',
    'cost.view',
    'analytics.view',
    'governance.view',
  ],
  Viewer: [
    'organization.view',
    'tenant.view',
    'workspace.view',
    'budget.view',
    'policy.view',
    'artifact.view',
    'cost.view',
    'analytics.view',
    'governance.view',
  ],
};

export const RBAC_ROLE_PERMISSIONS: RolePermission[] = Object.entries(rolePermissions).flatMap(([roleId, permissionIds]) =>
  permissionIds.map((permissionId) => ({ roleId: roleId as RoleId, permissionId })),
);

export const RBAC_ACCESS_POLICIES: AccessPolicy[] = [
  { id: 'view_access', name: 'Read access', action: 'view', requiredPermissions: ['workspace.view'], severity: 'info' },
  { id: 'edit_access', name: 'Edit access', action: 'edit', requiredPermissions: ['workspace.edit'], severity: 'blocking' },
  { id: 'start_run_access', name: 'Start run access', action: 'start_run', requiredPermissions: ['run.create', 'run.start'], severity: 'blocking' },
  { id: 'approve_plan_access', name: 'Approve plan access', action: 'approve_plan', requiredPermissions: ['run.approve'], severity: 'blocking' },
  { id: 'deployment_approval_access', name: 'Deployment approval access', action: 'approve_deployment', requiredPermissions: ['deployment.approve'], severity: 'blocking' },
  { id: 'artifact_export_access', name: 'Artifact export access', action: 'export_artifact', requiredPermissions: ['artifact.view', 'artifact.export'], severity: 'blocking' },
  { id: 'budget_override_access', name: 'Budget override access', action: 'override_budget', requiredPermissions: ['budget.edit'], severity: 'blocking' },
  { id: 'policy_modify_access', name: 'Policy modification access', action: 'modify_policy', requiredPermissions: ['policy.edit'], severity: 'blocking' },
];

function roleById(roleId: RoleId): Role {
  return RBAC_ROLES.find((role) => role.id === roleId) ?? RBAC_ROLES[RBAC_ROLES.length - 1];
}

export function permissionsForRole(roleId: RoleId): Permission[] {
  const permissionIds = new Set(rolePermissions[roleId] ?? []);
  return RBAC_PERMISSIONS.filter((permission) => permissionIds.has(permission.id));
}

function suggestedRoleFor(requiredPermissions: PermissionId[]): RoleId {
  const ordered = [...RBAC_ROLES].sort((a, b) => a.rank - b.rank);
  return ordered.find((role) => requiredPermissions.every((permission) => rolePermissions[role.id]?.includes(permission)))?.id ?? 'OrganizationOwner';
}

export function authorizeRole(input: {
  actorId: string;
  roleId: RoleId;
  action: string;
  resourceId?: string;
  requiredPermissions: PermissionId[];
}): AuthorizationDecision {
  const effective = new Set(permissionsForRole(input.roleId).map((permission) => permission.id));
  const missingPermissions = input.requiredPermissions.filter((permission) => !effective.has(permission));
  const allowed = missingPermissions.length === 0;
  return {
    id: `auth-${input.action}-${input.actorId}-${Date.now()}`,
    actorId: input.actorId,
    roleId: input.roleId,
    action: input.action,
    resourceId: input.resourceId,
    allowed,
    missingPermissions,
    reason: allowed
      ? `${roleById(input.roleId).name} can ${input.action}.`
      : `${roleById(input.roleId).name} is missing ${missingPermissions.join(', ')}.`,
    createdAt: new Date().toISOString(),
  };
}

export function denialFromDecision(decision: AuthorizationDecision): DeniedAction | undefined {
  if (decision.allowed) return undefined;
  return {
    ...decision,
    allowed: false,
    suggestedRole: suggestedRoleFor(decision.missingPermissions),
  };
}

export function rbacArtifacts(summary: RbacSummary, runId: string): Artifact[] {
  const now = new Date().toISOString();
  const roleRows = summary.roles.map((role) => {
    const count = summary.rolePermissions.filter((item) => item.roleId === role.id).length;
    return `| ${role.name} | ${count} | ${role.description} |`;
  }).join('\n');
  const permissionRows = summary.permissions.map((permission) => `| ${permission.id} | ${permission.category} | ${permission.description} |`).join('\n');
  return [
    {
      id: `artifact-${runId}-rbac-summary`,
      runId,
      type: 'markdown',
      name: 'rbac-summary.md',
      contentSummary: 'RBAC role hierarchy, current role, authorization status, and denied action count.',
      contentText: `# RBAC Summary\n\nCurrent role: ${summary.currentRole.name}\n\nDenied actions: ${summary.deniedActions.length}\n\n## Roles\n\n| Role | Permissions | Description |\n|---|---:|---|\n${roleRows}\n`,
      source: 'mock',
      createdAt: now,
      sizeBytes: 2200,
    },
    {
      id: `artifact-${runId}-permission-matrix`,
      runId,
      type: 'markdown',
      name: 'permission-matrix.md',
      contentSummary: 'Permission matrix for organization, tenant, workspace, runtime, artifact, budget, and governance actions.',
      contentText: `# Permission Matrix\n\n| Permission | Category | Description |\n|---|---|---|\n${permissionRows}\n`,
      source: 'mock',
      createdAt: now,
      sizeBytes: 2800,
    },
    {
      id: `artifact-${runId}-access-report`,
      runId,
      type: 'json',
      name: 'access-report.json',
      contentSummary: 'Machine-readable RBAC access report.',
      contentJson: summary,
      language: 'json',
      source: 'mock',
      createdAt: now,
      sizeBytes: JSON.stringify(summary).length,
    },
    {
      id: `artifact-${runId}-authorization-history`,
      runId,
      type: 'json',
      name: 'authorization-history.json',
      contentSummary: 'Authorization decision history and denied action ledger.',
      contentJson: {
        currentRole: summary.currentRole,
        history: summary.authorizationHistory,
        deniedActions: summary.deniedActions,
      },
      language: 'json',
      source: 'mock',
      createdAt: now,
      sizeBytes: JSON.stringify(summary.authorizationHistory).length,
    },
  ];
}
