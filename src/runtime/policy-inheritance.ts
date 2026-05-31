import type { Artifact } from '../domain/types';

export type PolicyScope = 'ORGANIZATION' | 'TENANT' | 'WORKSPACE' | 'RUNTIME';
export type PolicyCategory = 'execution' | 'budget' | 'quota' | 'approval' | 'rbac' | 'artifact' | 'deployment' | 'cost';
export type PolicyValue = string | number | boolean | string[];

export interface PolicyRule {
  id: string;
  scope: PolicyScope;
  scopeId: string;
  category: PolicyCategory;
  key: string;
  value: PolicyValue;
  priority: number;
  locked: boolean;
  runtimeOverride?: boolean;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface InheritedPolicy extends PolicyRule {
  inheritedFrom?: string;
  blockedByPolicyId?: string;
}

export interface PolicyOverride {
  id: string;
  parentPolicyId: string;
  childPolicyId: string;
  allowed: boolean;
  reason: string;
  createdAt: string;
}

export interface PolicyConflict {
  id: string;
  category: PolicyCategory;
  key: string;
  parentPolicyId: string;
  childPolicyId: string;
  scope: PolicyScope;
  severity: 'warning' | 'blocking';
  reason: string;
  createdAt: string;
}

export interface EffectivePolicy {
  id: string;
  category: PolicyCategory;
  key: string;
  value: PolicyValue;
  scope: PolicyScope;
  scopeId: string;
  priority: number;
  locked: boolean;
  runtimeOverride: boolean;
  source: string;
  sourceTrace: {
    organizationPolicyId?: string;
    tenantPolicyId?: string;
    workspacePolicyId?: string;
    runtimePolicyId?: string;
  };
  policyChain: InheritedPolicy[];
  updatedAt: string;
}

export interface PolicyInheritanceReport {
  id: string;
  generatedAt: string;
  effectivePolicies: EffectivePolicy[];
  policyConflicts: PolicyConflict[];
  overrides: PolicyOverride[];
  lockedPolicies: PolicyRule[];
  warnings: string[];
  summary: {
    organizationPolicies: number;
    tenantPolicies: number;
    workspacePolicies: number;
    runtimePolicies: number;
    effectivePolicies: number;
    conflicts: number;
    locked: number;
    overrides: number;
  };
}

const scopeOrder: Record<PolicyScope, number> = {
  ORGANIZATION: 1,
  TENANT: 2,
  WORKSPACE: 3,
  RUNTIME: 4,
};

function policyKey(policy: Pick<PolicyRule, 'category' | 'key'>): string {
  return `${policy.category}:${policy.key}`;
}

function traceFor(chain: InheritedPolicy[]): EffectivePolicy['sourceTrace'] {
  return {
    organizationPolicyId: chain.find((policy) => policy.scope === 'ORGANIZATION')?.id,
    tenantPolicyId: chain.find((policy) => policy.scope === 'TENANT')?.id,
    workspacePolicyId: chain.find((policy) => policy.scope === 'WORKSPACE')?.id,
    runtimePolicyId: chain.find((policy) => policy.scope === 'RUNTIME')?.id,
  };
}

function sameValue(a: PolicyValue, b: PolicyValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function conflictFor(parent: PolicyRule, child: PolicyRule, reason: string): PolicyConflict {
  return {
    id: `policy-conflict-${parent.id}-${child.id}`,
    category: child.category,
    key: child.key,
    parentPolicyId: parent.id,
    childPolicyId: child.id,
    scope: child.scope,
    severity: 'blocking',
    reason,
    createdAt: new Date().toISOString(),
  };
}

function overrideFor(parent: PolicyRule, child: PolicyRule, allowed: boolean, reason: string): PolicyOverride {
  return {
    id: `policy-override-${parent.id}-${child.id}`,
    parentPolicyId: parent.id,
    childPolicyId: child.id,
    allowed,
    reason,
    createdAt: new Date().toISOString(),
  };
}

export function isPolicyLocked(policy?: Pick<PolicyRule, 'locked'>): boolean {
  return Boolean(policy?.locked);
}

export function detectPolicyConflicts(policies: PolicyRule[]): PolicyConflict[] {
  const conflicts: PolicyConflict[] = [];
  const grouped = new Map<string, PolicyRule[]>();
  for (const policy of policies) grouped.set(policyKey(policy), [...(grouped.get(policyKey(policy)) ?? []), policy]);

  for (const group of grouped.values()) {
    const ordered = [...group].sort((a, b) => scopeOrder[a.scope] - scopeOrder[b.scope] || a.priority - b.priority);
    let active: PolicyRule | undefined;
    for (const policy of ordered) {
      if (!active) {
        active = policy;
        continue;
      }
      if (active.locked && !sameValue(active.value, policy.value)) {
        conflicts.push(conflictFor(active, policy, `${policy.scope} override blocked by locked ${active.scope} policy.`));
        continue;
      }
      if (policy.scope === 'RUNTIME' && active.scope === 'WORKSPACE' && active.runtimeOverride !== true && !sameValue(active.value, policy.value)) {
        conflicts.push(conflictFor(active, policy, 'Runtime override blocked because workspace policy does not allow runtimeOverride.'));
        continue;
      }
      active = policy;
    }

    const sameScope = new Map<string, PolicyRule[]>();
    for (const policy of group) sameScope.set(policy.scope, [...(sameScope.get(policy.scope) ?? []), policy]);
    for (const rows of sameScope.values()) {
      const [first, ...rest] = rows;
      for (const item of rest) {
        if (first && first.priority === item.priority && !sameValue(first.value, item.value)) {
          conflicts.push(conflictFor(first, item, `Conflicting ${item.scope} policies with the same priority.`));
        }
      }
    }
  }

  return conflicts;
}

export function resolveEffectivePolicies(policies: PolicyRule[]): {
  effectivePolicies: EffectivePolicy[];
  overrides: PolicyOverride[];
  conflicts: PolicyConflict[];
} {
  const conflicts = detectPolicyConflicts(policies);
  const conflictIds = new Set(conflicts.map((conflict) => conflict.childPolicyId));
  const overrides: PolicyOverride[] = [];
  const effectivePolicies: EffectivePolicy[] = [];
  const grouped = new Map<string, PolicyRule[]>();
  for (const policy of policies) grouped.set(policyKey(policy), [...(grouped.get(policyKey(policy)) ?? []), policy]);

  for (const [key, group] of grouped.entries()) {
    const ordered = [...group].sort((a, b) => scopeOrder[a.scope] - scopeOrder[b.scope] || a.priority - b.priority);
    let active = ordered[0];
    const chain: InheritedPolicy[] = active ? [{ ...active }] : [];
    for (const policy of ordered.slice(1)) {
      if (!active) {
        active = policy;
        chain.push({ ...policy });
        continue;
      }
      if (conflictIds.has(policy.id)) {
        overrides.push(overrideFor(active, policy, false, 'Override rejected by inheritance conflict.'));
        chain.push({ ...policy, inheritedFrom: active.id, blockedByPolicyId: active.id });
        continue;
      }
      const allowed = !active.locked && !(policy.scope === 'RUNTIME' && active.scope === 'WORKSPACE' && active.runtimeOverride !== true);
      overrides.push(overrideFor(active, policy, allowed, allowed ? `${policy.scope} overrides ${active.scope}.` : `${policy.scope} override blocked by parent policy.`));
      chain.push({ ...policy, inheritedFrom: active.id });
      if (allowed) active = policy;
    }
    if (!active) continue;
    effectivePolicies.push({
      id: `effective-${key}`,
      category: active.category,
      key: active.key,
      value: active.value,
      scope: active.scope,
      scopeId: active.scopeId,
      priority: active.priority,
      locked: active.locked,
      runtimeOverride: active.runtimeOverride === true,
      source: active.source,
      sourceTrace: traceFor(chain),
      policyChain: chain,
      updatedAt: active.updatedAt,
    });
  }

  return { effectivePolicies, overrides, conflicts };
}

export function resolvePolicyForScope(policies: PolicyRule[], category: PolicyCategory, key: string, scope?: PolicyScope): EffectivePolicy | undefined {
  const result = resolveEffectivePolicies(policies.filter((policy) => policy.category === category && policy.key === key));
  const candidates = scope ? result.effectivePolicies.filter((policy) => scopeOrder[policy.scope] <= scopeOrder[scope]) : result.effectivePolicies;
  return candidates[0];
}

export function applyPolicyOverride(policies: PolicyRule[], override: PolicyRule): {
  policies: PolicyRule[];
  effectivePolicies: EffectivePolicy[];
  conflicts: PolicyConflict[];
  overrides: PolicyOverride[];
} {
  const nextPolicies = [...policies.filter((policy) => policy.id !== override.id), override];
  return { policies: nextPolicies, ...resolveEffectivePolicies(nextPolicies) };
}

export function generatePolicyInheritanceReport(input: {
  organizationPolicies: PolicyRule[];
  tenantPolicies: PolicyRule[];
  workspacePolicies: PolicyRule[];
  runtimePolicies: PolicyRule[];
}): PolicyInheritanceReport {
  const allPolicies = [
    ...input.organizationPolicies,
    ...input.tenantPolicies,
    ...input.workspacePolicies,
    ...input.runtimePolicies,
  ];
  const resolved = resolveEffectivePolicies(allPolicies);
  const warnings = [
    ...resolved.conflicts.map((conflict) => conflict.reason),
    ...resolved.effectivePolicies.filter((policy) => policy.locked).map((policy) => `Locked policy active: ${policy.category}.${policy.key}`),
  ];
  return {
    id: 'policy-inheritance-report',
    generatedAt: new Date().toISOString(),
    effectivePolicies: resolved.effectivePolicies,
    policyConflicts: resolved.conflicts,
    overrides: resolved.overrides,
    lockedPolicies: allPolicies.filter((policy) => policy.locked),
    warnings,
    summary: {
      organizationPolicies: input.organizationPolicies.length,
      tenantPolicies: input.tenantPolicies.length,
      workspacePolicies: input.workspacePolicies.length,
      runtimePolicies: input.runtimePolicies.length,
      effectivePolicies: resolved.effectivePolicies.length,
      conflicts: resolved.conflicts.length,
      locked: allPolicies.filter((policy) => policy.locked).length,
      overrides: resolved.overrides.filter((override) => override.allowed).length,
    },
  };
}

export function policyInheritanceArtifacts(report: PolicyInheritanceReport, runId: string): Artifact[] {
  const now = new Date().toISOString();
  const effectiveRows = report.effectivePolicies.map((policy) =>
    `| ${policy.category}.${policy.key} | ${policy.scope} | ${String(policy.value)} | ${policy.locked ? 'yes' : 'no'} |`
  ).join('\n');
  const conflictRows = report.policyConflicts.map((conflict) =>
    `| ${conflict.category}.${conflict.key} | ${conflict.scope} | ${conflict.reason} | ${conflict.severity} |`
  ).join('\n');
  return [
    {
      id: `artifact-${runId}-policy-inheritance-summary`,
      runId,
      type: 'markdown',
      name: 'policy-inheritance-summary.md',
      contentSummary: 'Policy inheritance hierarchy, override counts, conflicts, and locked policy status.',
      contentText: `# Policy Inheritance Summary\n\nEffective policies: ${report.summary.effectivePolicies}\n\nConflicts: ${report.summary.conflicts}\n\nLocked: ${report.summary.locked}\n\n## Effective Policies\n\n| Policy | Source | Value | Locked |\n|---|---|---|---|\n${effectiveRows}\n`,
      source: 'mock',
      createdAt: now,
      sizeBytes: 2600,
    },
    {
      id: `artifact-${runId}-effective-policy-report`,
      runId,
      type: 'markdown',
      name: 'effective-policy-report.md',
      contentSummary: 'Resolved effective policy report across organization, tenant, workspace, and runtime scopes.',
      contentText: `# Effective Policy Report\n\n| Policy | Source | Value | Locked |\n|---|---|---|---|\n${effectiveRows}\n`,
      source: 'mock',
      createdAt: now,
      sizeBytes: 2400,
    },
    {
      id: `artifact-${runId}-policy-conflicts`,
      runId,
      type: 'json',
      name: 'policy-conflicts.json',
      contentSummary: 'Machine-readable policy conflict report.',
      contentJson: report.policyConflicts,
      language: 'json',
      source: 'mock',
      createdAt: now,
      sizeBytes: JSON.stringify(report.policyConflicts).length,
    },
    {
      id: `artifact-${runId}-policy-trace-report`,
      runId,
      type: 'markdown',
      name: 'policy-trace-report.md',
      contentSummary: 'Policy trace report showing source chain for each effective policy.',
      contentText: `# Policy Trace Report\n\n## Conflicts\n\n| Policy | Scope | Reason | Severity |\n|---|---|---|---|\n${conflictRows || '| none | none | none | none |'}\n`,
      source: 'mock',
      createdAt: now,
      sizeBytes: 2200,
    },
  ];
}
