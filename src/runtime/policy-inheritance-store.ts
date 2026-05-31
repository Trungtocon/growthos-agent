import { demoWorkspace } from '../data/demo-fixtures';
import {
  applyPolicyOverride as applyPolicyOverrideToRules,
  generatePolicyInheritanceReport,
  policyInheritanceArtifacts,
  type EffectivePolicy,
  type PolicyCategory,
  type PolicyConflict,
  type PolicyInheritanceReport,
  type PolicyOverride,
  type PolicyRule,
  type PolicyScope,
} from './policy-inheritance';

const POLICY_INHERITANCE_KEY = 'uikigai-policy-inheritance-v1';
const ORGANIZATION_ID = 'org-growthos-enterprise';
const TENANT_ID = 'tenant-operations';

interface PolicyInheritanceState {
  organizationPolicies: PolicyRule[];
  tenantPolicies: PolicyRule[];
  workspacePolicies: PolicyRule[];
  runtimePolicies: PolicyRule[];
  effectivePolicies: EffectivePolicy[];
  policyConflicts: PolicyConflict[];
  policyOverrides: PolicyOverride[];
  inheritanceReports: PolicyInheritanceReport[];
}

function now() {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function rule(input: Omit<PolicyRule, 'createdAt' | 'updatedAt' | 'source'> & { source?: string }): PolicyRule {
  const timestamp = now();
  return {
    ...input,
    source: input.source ?? `${input.scope.toLowerCase()}-default`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function defaultOrganizationPolicies(): PolicyRule[] {
  return [
    rule({ id: 'org-execution-max-runs', scope: 'ORGANIZATION', scopeId: ORGANIZATION_ID, category: 'execution', key: 'maxConcurrentRuns', value: 8, priority: 10, locked: false, runtimeOverride: true }),
    rule({ id: 'org-budget-max-cost', scope: 'ORGANIZATION', scopeId: ORGANIZATION_ID, category: 'budget', key: 'maxCost', value: 0.12, priority: 10, locked: false, runtimeOverride: false }),
    rule({ id: 'org-quota-tool-calls', scope: 'ORGANIZATION', scopeId: ORGANIZATION_ID, category: 'quota', key: 'maxToolCalls', value: 8, priority: 10, locked: false, runtimeOverride: true }),
    rule({ id: 'org-approval-artifact', scope: 'ORGANIZATION', scopeId: ORGANIZATION_ID, category: 'approval', key: 'artifactRequiresApproval', value: true, priority: 10, locked: true, runtimeOverride: false }),
    rule({ id: 'org-rbac-audit', scope: 'ORGANIZATION', scopeId: ORGANIZATION_ID, category: 'rbac', key: 'auditRequired', value: true, priority: 10, locked: true, runtimeOverride: false }),
    rule({ id: 'org-artifact-export-audit', scope: 'ORGANIZATION', scopeId: ORGANIZATION_ID, category: 'artifact', key: 'exportRequiresAudit', value: true, priority: 10, locked: false, runtimeOverride: false }),
    rule({ id: 'org-deployment-approval', scope: 'ORGANIZATION', scopeId: ORGANIZATION_ID, category: 'deployment', key: 'requiresApproval', value: true, priority: 10, locked: true, runtimeOverride: false }),
    rule({ id: 'org-cost-tolerance', scope: 'ORGANIZATION', scopeId: ORGANIZATION_ID, category: 'cost', key: 'reconciliationTolerancePercent', value: 15, priority: 10, locked: false, runtimeOverride: false }),
  ];
}

function defaultTenantPolicies(): PolicyRule[] {
  return [
    rule({ id: 'tenant-budget-max-cost', scope: 'TENANT', scopeId: TENANT_ID, category: 'budget', key: 'maxCost', value: 0.1, priority: 20, locked: false, runtimeOverride: false }),
    rule({ id: 'tenant-quota-tool-calls', scope: 'TENANT', scopeId: TENANT_ID, category: 'quota', key: 'maxToolCalls', value: 7, priority: 20, locked: false, runtimeOverride: true }),
    rule({ id: 'tenant-approval-artifact-conflict', scope: 'TENANT', scopeId: TENANT_ID, category: 'approval', key: 'artifactRequiresApproval', value: false, priority: 20, locked: false, runtimeOverride: false }),
  ];
}

function defaultWorkspacePolicies(): PolicyRule[] {
  return [
    rule({ id: 'workspace-budget-max-cost', scope: 'WORKSPACE', scopeId: demoWorkspace.id, category: 'budget', key: 'maxCost', value: 0.08, priority: 30, locked: false, runtimeOverride: false }),
    rule({ id: 'workspace-quota-tool-calls', scope: 'WORKSPACE', scopeId: demoWorkspace.id, category: 'quota', key: 'maxToolCalls', value: 6, priority: 30, locked: false, runtimeOverride: true }),
    rule({ id: 'workspace-execution-max-runs', scope: 'WORKSPACE', scopeId: demoWorkspace.id, category: 'execution', key: 'maxConcurrentRuns', value: 5, priority: 30, locked: false, runtimeOverride: true }),
  ];
}

function defaultRuntimePolicies(): PolicyRule[] {
  return [
    rule({ id: 'runtime-quota-tool-calls', scope: 'RUNTIME', scopeId: 'run-demo-module-3', category: 'quota', key: 'maxToolCalls', value: 5, priority: 40, locked: false, runtimeOverride: true }),
    rule({ id: 'runtime-budget-max-cost-conflict', scope: 'RUNTIME', scopeId: 'run-demo-module-3', category: 'budget', key: 'maxCost', value: 0.05, priority: 40, locked: false, runtimeOverride: true }),
  ];
}

function buildState(input: Pick<PolicyInheritanceState, 'organizationPolicies' | 'tenantPolicies' | 'workspacePolicies' | 'runtimePolicies'>): PolicyInheritanceState {
  const report = generatePolicyInheritanceReport(input);
  return {
    ...input,
    effectivePolicies: report.effectivePolicies,
    policyConflicts: report.policyConflicts,
    policyOverrides: report.overrides,
    inheritanceReports: [report],
  };
}

function emptyState(): PolicyInheritanceState {
  return buildState({
    organizationPolicies: defaultOrganizationPolicies(),
    tenantPolicies: defaultTenantPolicies(),
    workspacePolicies: defaultWorkspacePolicies(),
    runtimePolicies: defaultRuntimePolicies(),
  });
}

function readState(): PolicyInheritanceState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(POLICY_INHERITANCE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<PolicyInheritanceState>;
    return buildState({
      organizationPolicies: parsed.organizationPolicies ?? defaultOrganizationPolicies(),
      tenantPolicies: parsed.tenantPolicies ?? defaultTenantPolicies(),
      workspacePolicies: parsed.workspacePolicies ?? defaultWorkspacePolicies(),
      runtimePolicies: parsed.runtimePolicies ?? defaultRuntimePolicies(),
    });
  } catch {
    return emptyState();
  }
}

function writeState(state: PolicyInheritanceState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(POLICY_INHERITANCE_KEY, JSON.stringify(state));
}

function policiesForScope(state: PolicyInheritanceState, scope: PolicyScope): PolicyRule[] {
  if (scope === 'ORGANIZATION') return state.organizationPolicies;
  if (scope === 'TENANT') return state.tenantPolicies;
  if (scope === 'WORKSPACE') return state.workspacePolicies;
  return state.runtimePolicies;
}

function withScopePolicies(state: PolicyInheritanceState, scope: PolicyScope, policies: PolicyRule[]): PolicyInheritanceState {
  const next = {
    organizationPolicies: scope === 'ORGANIZATION' ? policies : state.organizationPolicies,
    tenantPolicies: scope === 'TENANT' ? policies : state.tenantPolicies,
    workspacePolicies: scope === 'WORKSPACE' ? policies : state.workspacePolicies,
    runtimePolicies: scope === 'RUNTIME' ? policies : state.runtimePolicies,
  };
  const rebuilt = buildState(next);
  return { ...rebuilt, inheritanceReports: [rebuilt.inheritanceReports[0], ...state.inheritanceReports].slice(0, 20) };
}

export function resolveEffectivePolicies(): EffectivePolicy[] {
  return clone(readState().effectivePolicies);
}

export function getPolicyInheritanceReport(): PolicyInheritanceReport {
  return clone(readState().inheritanceReports[0]);
}

export function getPolicyInheritanceReports(): PolicyInheritanceReport[] {
  return clone(readState().inheritanceReports);
}

export function getPolicyInheritanceTree() {
  const state = readState();
  return {
    organization: clone(state.organizationPolicies),
    tenants: clone(state.tenantPolicies),
    workspaces: clone(state.workspacePolicies),
    runtime: clone(state.runtimePolicies),
  };
}

export function getEffectivePolicies(): EffectivePolicy[] {
  return resolveEffectivePolicies();
}

export function getEffectivePolicyByCategory(category: PolicyCategory): EffectivePolicy[] {
  return resolveEffectivePolicies().filter((policy) => policy.category === category);
}

export function getPolicyConflicts(): PolicyConflict[] {
  return clone(readState().policyConflicts);
}

export function getLockedPolicies(): PolicyRule[] {
  const state = readState();
  return clone([...state.organizationPolicies, ...state.tenantPolicies, ...state.workspacePolicies, ...state.runtimePolicies].filter((policy) => policy.locked));
}

export function getPolicyOverrides(): PolicyOverride[] {
  return clone(readState().policyOverrides);
}

export function getPolicyTraceForRuntime(runId = 'run-demo-module-3'): EffectivePolicy[] {
  return resolveEffectivePolicies().filter((policy) => policy.scope === 'RUNTIME' || policy.sourceTrace.runtimePolicyId || policy.scopeId === runId);
}

export function getPolicyWarnings(): string[] {
  return clone(readState().inheritanceReports[0]?.warnings ?? []);
}

export function getPolicyValue<T extends string | number | boolean | string[]>(category: PolicyCategory, key: string, fallback: T): T {
  const policy = resolveEffectivePolicies().find((item) => item.category === category && item.key === key);
  return (policy?.value ?? fallback) as T;
}

export function applyPolicyOverride(policy: PolicyRule): PolicyInheritanceState {
  const state = readState();
  const currentScopePolicies = policiesForScope(state, policy.scope);
  const result = applyPolicyOverrideToRules([
    ...state.organizationPolicies,
    ...state.tenantPolicies,
    ...state.workspacePolicies,
    ...state.runtimePolicies,
  ], policy);
  const next = withScopePolicies(state, policy.scope, [...currentScopePolicies.filter((item) => item.id !== policy.id), policy]);
  const merged = {
    ...next,
    effectivePolicies: result.effectivePolicies,
    policyConflicts: result.conflicts,
    policyOverrides: result.overrides,
  };
  writeState(merged);
  return clone(merged);
}

export function generatePolicyInheritanceArtifacts(runId: string) {
  return policyInheritanceArtifacts(getPolicyInheritanceReport(), runId);
}

export function clearPolicyInheritance() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(POLICY_INHERITANCE_KEY);
}
