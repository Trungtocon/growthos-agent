import type { RuntimeEnvironmentId } from './environment-registry';

export const PRODUCTION_EVIDENCE_CATEGORIES = [
  'backend_endpoint',
  'database_config',
  'auth_config',
  'secret_presence',
  'secret_owner',
  'secret_scope',
  'secret_rotation',
  'schema_version',
  'migration_status',
  'rbac_binding',
  'tenant_workspace_binding',
  'production_endpoint_reachability',
] as const;

export type ProductionEvidenceCategory = typeof PRODUCTION_EVIDENCE_CATEGORIES[number];
export type ProductionEvidenceStatus = 'missing' | 'provided' | 'verified' | 'expired' | 'rejected';
export type ProductionEvidenceSeverity = 'info' | 'warning' | 'blocker' | 'critical';
export type ProductionEvidenceVerdict = 'READY' | 'WARNING' | 'BLOCKED';

export interface ProductionConfigEvidence {
  id: string;
  category: ProductionEvidenceCategory;
  environment: RuntimeEnvironmentId;
  status: ProductionEvidenceStatus;
  severity: ProductionEvidenceSeverity;
  providedAt: string;
  providedBy: string;
  maskedValue: string;
  evidenceType: string;
  description: string;
  source: string;
  expiresAt?: string;
  verifiedAt?: string;
  verificationMethod?: string;
  relatedGate: string;
  blockerResolved: string;
  warnings: string[];
  metadata?: Record<string, unknown>;
}

export interface ProductionConfigEvidenceInput {
  category: ProductionEvidenceCategory;
  environment?: RuntimeEnvironmentId;
  evidenceType: string;
  description: string;
  source: string;
  providedBy: string;
  rawValue?: string;
  maskedValue?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ProductionEvidenceRequirement {
  category: ProductionEvidenceCategory;
  label: string;
  relatedGate: string;
  blockerResolved: string;
  severity: ProductionEvidenceSeverity;
  requiredMetadata?: string[];
}

export interface ProductionEvidenceDashboard {
  evidence: ProductionConfigEvidence[];
  requirements: ProductionEvidenceRequirement[];
  missing: ProductionEvidenceRequirement[];
  provided: ProductionConfigEvidence[];
  verified: ProductionConfigEvidence[];
  rejected: ProductionConfigEvidence[];
  expired: ProductionConfigEvidence[];
  resolvedBlockers: string[];
  remainingBlockers: string[];
  expiryWarnings: string[];
  readinessScore: number;
  verdict: ProductionEvidenceVerdict;
}

const REQUIREMENTS: ProductionEvidenceRequirement[] = [
  {
    category: 'backend_endpoint',
    label: 'Production backend endpoint',
    relatedGate: 'backend-readiness',
    blockerResolved: 'Production backend endpoint evidence verified.',
    severity: 'critical',
  },
  {
    category: 'database_config',
    label: 'Database config',
    relatedGate: 'database-readiness',
    blockerResolved: 'Production database config evidence verified.',
    severity: 'critical',
    requiredMetadata: ['provider'],
  },
  {
    category: 'auth_config',
    label: 'Auth config',
    relatedGate: 'auth-readiness',
    blockerResolved: 'Production auth config evidence verified.',
    severity: 'critical',
    requiredMetadata: ['provider', 'issuer', 'audience', 'tokenMode', 'sessionMode'],
  },
  {
    category: 'secret_presence',
    label: 'Secret presence',
    relatedGate: 'environment-readiness',
    blockerResolved: 'Production secret presence evidence verified.',
    severity: 'critical',
  },
  {
    category: 'secret_owner',
    label: 'Secret owner',
    relatedGate: 'environment-readiness',
    blockerResolved: 'Production secret owner evidence verified.',
    severity: 'blocker',
  },
  {
    category: 'secret_scope',
    label: 'Secret scope',
    relatedGate: 'environment-readiness',
    blockerResolved: 'Production secret scope evidence verified.',
    severity: 'blocker',
  },
  {
    category: 'secret_rotation',
    label: 'Secret rotation',
    relatedGate: 'environment-readiness',
    blockerResolved: 'Production secret rotation evidence verified.',
    severity: 'critical',
  },
  {
    category: 'schema_version',
    label: 'Schema version',
    relatedGate: 'database-readiness',
    blockerResolved: 'Production schema version evidence verified.',
    severity: 'blocker',
  },
  {
    category: 'migration_status',
    label: 'Migration status',
    relatedGate: 'database-readiness',
    blockerResolved: 'Production migration status evidence verified.',
    severity: 'blocker',
  },
  {
    category: 'rbac_binding',
    label: 'RBAC binding',
    relatedGate: 'auth-readiness',
    blockerResolved: 'Production RBAC binding evidence verified.',
    severity: 'blocker',
  },
  {
    category: 'tenant_workspace_binding',
    label: 'Tenant workspace binding',
    relatedGate: 'auth-readiness',
    blockerResolved: 'Production tenant/workspace binding evidence verified.',
    severity: 'blocker',
  },
  {
    category: 'production_endpoint_reachability',
    label: 'Production endpoint reachability',
    relatedGate: 'backend-readiness',
    blockerResolved: 'Production endpoint reachability evidence verified.',
    severity: 'critical',
  },
];

const CATEGORY_BLOCKER_KEYWORDS: Record<ProductionEvidenceCategory, RegExp[]> = {
  backend_endpoint: [/base url/i, /backend endpoint/i, /production backend/i, /production endpoint/i],
  database_config: [/database readiness/i, /database config/i, /database url/i, /production database/i],
  auth_config: [/auth/i, /issuer/i, /audience/i, /session/i, /token/i],
  secret_presence: [/secret/i, /production secret/i],
  secret_owner: [/secret owner/i],
  secret_scope: [/secret scope/i],
  secret_rotation: [/rotation/i],
  schema_version: [/schema/i],
  migration_status: [/migration/i],
  rbac_binding: [/rbac/i],
  tenant_workspace_binding: [/tenant/i, /workspace/i],
  production_endpoint_reachability: [/endpoint.*reachable/i, /not reachable/i, /reachability/i],
};

function hasUnsafeProductionEndpoint(value: string): boolean {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|mock|demo/i.test(value);
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function maskValue(value: string | undefined, explicitMaskedValue?: string): string {
  if (explicitMaskedValue?.trim()) return explicitMaskedValue.trim();
  if (!value?.trim()) return 'not provided';
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return `${url.protocol}//${url.hostname}${url.pathname === '/' ? '' : url.pathname.replace(/[^/]/g, '*')}`;
    } catch {
      return 'endpoint-***';
    }
  }
  const last = trimmed.slice(-4);
  return `${'*'.repeat(Math.min(12, Math.max(6, trimmed.length - 4)))}${last}`;
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  return Object.fromEntries(Object.entries(metadata).map(([key, value]) => {
    if (/secret|token|password|api[_-]?key|private/i.test(key)) return [key, '***redacted***'];
    return [key, value];
  }));
}

export function getProductionEvidenceRequirements(): ProductionEvidenceRequirement[] {
  return REQUIREMENTS.map((entry) => ({ ...entry, requiredMetadata: entry.requiredMetadata ? [...entry.requiredMetadata] : undefined }));
}

export function getProductionEvidenceRequirement(category: ProductionEvidenceCategory): ProductionEvidenceRequirement {
  return getProductionEvidenceRequirements().find((entry) => entry.category === category)!;
}

export function sanitizeProductionEvidenceInput(input: ProductionConfigEvidenceInput): Omit<ProductionConfigEvidence, 'id' | 'providedAt'> {
  const requirement = getProductionEvidenceRequirement(input.category);
  const warnings = validateProductionEvidenceInput(input);
  const status: ProductionEvidenceStatus = warnings.some((warning) => /invalid|unsafe|missing|required/i.test(warning))
    ? 'rejected'
    : 'provided';

  return {
    category: input.category,
    environment: input.environment ?? 'PRODUCTION',
    status,
    severity: status === 'rejected' ? 'critical' : requirement.severity,
    providedBy: input.providedBy,
    maskedValue: maskValue(input.rawValue, input.maskedValue),
    evidenceType: input.evidenceType,
    description: input.description,
    source: input.source,
    expiresAt: input.expiresAt,
    relatedGate: requirement.relatedGate,
    blockerResolved: requirement.blockerResolved,
    warnings,
    metadata: sanitizeMetadata(input.metadata),
  };
}

export function validateProductionEvidenceInput(input: ProductionConfigEvidenceInput): string[] {
  const warnings: string[] = [];
  const value = input.rawValue ?? input.maskedValue ?? '';
  if (!hasText(input.evidenceType)) warnings.push('Evidence type is required.');
  if (!hasText(input.description)) warnings.push('Evidence description is required.');
  if (!hasText(input.source)) warnings.push('Evidence source is required.');
  if (!hasText(input.providedBy)) warnings.push('Evidence provider is required.');

  if ((input.category === 'backend_endpoint' || input.category === 'production_endpoint_reachability') && (!hasText(value) || hasUnsafeProductionEndpoint(value))) {
    warnings.push('Invalid production endpoint evidence: localhost, mock, and demo endpoints are rejected.');
  }
  if (input.category === 'database_config' && (!hasText(input.metadata?.provider) || !hasText(value))) {
    warnings.push('Database config evidence requires provider and masked connection proof.');
  }
  if (input.category === 'auth_config') {
    for (const key of ['provider', 'issuer', 'audience', 'tokenMode', 'sessionMode']) {
      if (!hasText(input.metadata?.[key])) warnings.push(`Auth config evidence requires ${key}.`);
    }
  }
  if (input.category === 'secret_presence' && input.metadata?.presenceConfirmed !== true) {
    warnings.push('Secret evidence must prove presence without exposing the raw value.');
  }
  if ((input.category === 'secret_owner' || input.category === 'secret_scope' || input.category === 'secret_rotation' || input.category === 'schema_version' || input.category === 'migration_status' || input.category === 'rbac_binding' || input.category === 'tenant_workspace_binding') && !hasText(value)) {
    warnings.push(`${input.category} evidence is required.`);
  }

  return warnings;
}

export function isProductionEvidenceExpired(evidence: ProductionConfigEvidence, now = new Date()): boolean {
  return Boolean(evidence.expiresAt && new Date(evidence.expiresAt).getTime() <= now.getTime());
}

export function isProductionEvidenceValid(evidence: ProductionConfigEvidence, now = new Date()): boolean {
  return evidence.status === 'verified' && !isProductionEvidenceExpired(evidence, now);
}

export function buildProductionEvidenceDashboard(evidence: ProductionConfigEvidence[]): ProductionEvidenceDashboard {
  const now = new Date();
  const normalized = evidence.map((entry) => isProductionEvidenceExpired(entry, now) && entry.status === 'verified'
    ? { ...entry, status: 'expired' as const, warnings: [...entry.warnings, 'Evidence has expired and cannot unlock production gates.'] }
    : entry);
  const verified = normalized.filter((entry) => isProductionEvidenceValid(entry, now));
  const verifiedCategories = new Set(verified.map((entry) => entry.category));
  const missing = REQUIREMENTS.filter((requirement) => !verifiedCategories.has(requirement.category));
  const expired = normalized.filter((entry) => entry.status === 'expired' || isProductionEvidenceExpired(entry, now));
  const rejected = normalized.filter((entry) => entry.status === 'rejected');
  const provided = normalized.filter((entry) => entry.status === 'provided');
  const resolvedBlockers = REQUIREMENTS
    .filter((requirement) => verifiedCategories.has(requirement.category))
    .map((requirement) => requirement.blockerResolved);
  const remainingBlockers = missing.map((requirement) => `${requirement.label} evidence is missing or not verified.`);
  const expiryWarnings = expired.map((entry) => `${getProductionEvidenceRequirement(entry.category).label} evidence expired.`);
  const readinessScore = Math.round((verifiedCategories.size / REQUIREMENTS.length) * 100);
  const verdict: ProductionEvidenceVerdict = remainingBlockers.length ? 'BLOCKED' : expiryWarnings.length || rejected.length || provided.length ? 'WARNING' : 'READY';

  return {
    evidence: normalized,
    requirements: getProductionEvidenceRequirements(),
    missing,
    provided,
    verified,
    rejected,
    expired,
    resolvedBlockers,
    remainingBlockers,
    expiryWarnings,
    readinessScore,
    verdict,
  };
}

export function getVerifiedProductionEvidenceCategories(evidence: ProductionConfigEvidence[]): Set<ProductionEvidenceCategory> {
  return new Set(buildProductionEvidenceDashboard(evidence).verified.map((entry) => entry.category));
}

export function filterReadinessBlockersWithEvidence(
  gateId: string,
  blockers: string[],
  verifiedCategories: Set<ProductionEvidenceCategory>,
): string[] {
  return blockers.filter((blocker) => {
    for (const category of verifiedCategories) {
      const requirement = getProductionEvidenceRequirement(category);
      if (requirement.relatedGate !== gateId) continue;
      if (CATEGORY_BLOCKER_KEYWORDS[category].some((pattern) => pattern.test(blocker))) return false;
    }
    return true;
  });
}
