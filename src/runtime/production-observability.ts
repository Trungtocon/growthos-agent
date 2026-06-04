import type { RuntimeEnvironmentId } from './environment-registry';

export type ProductionObservabilityStatus = 'missing' | 'configured' | 'verified' | 'warning' | 'blocked' | 'failed';
export type ProductionObservabilitySeverity = 'info' | 'warning' | 'blocker' | 'critical';
export type ProductionObservabilityVerdict = 'READY' | 'WARNING' | 'BLOCKED';
export type ProductionObservabilityCheckType =
  | 'health_monitor'
  | 'logging'
  | 'audit_logging'
  | 'alert_channel'
  | 'incident_owner'
  | 'escalation_policy'
  | 'runbook'
  | 'slo_sla'
  | 'rto_rpo'
  | 'dashboard';

export interface ProductionObservabilityCheck {
  id: string;
  type: ProductionObservabilityCheckType;
  name: string;
  environment: RuntimeEnvironmentId;
  status: ProductionObservabilityStatus;
  severity: ProductionObservabilitySeverity;
  description: string;
  source: string;
  configuredAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  evidence: string[];
  warnings: string[];
  metadata?: Record<string, unknown>;
}

export interface HealthMonitorInput {
  name: string;
  endpoint: string;
  uptimePercent: number;
  latencyMs: number;
  errorRatePercent: number;
}

export interface AlertChannelInput {
  name: string;
  channelType: 'pagerduty' | 'slack' | 'email' | 'webhook';
  target: string;
}

export interface IncidentOwnerInput {
  name: string;
  team: string;
  escalationPolicy: string;
}

export interface ProductionObservabilityDashboard {
  checks: ProductionObservabilityCheck[];
  healthMatrix: ProductionObservabilityCheck[];
  alertChannels: ProductionObservabilityCheck[];
  incidentOwners: ProductionObservabilityCheck[];
  runbooks: ProductionObservabilityCheck[];
  sloSlaChecks: ProductionObservabilityCheck[];
  rtoRpoChecks: ProductionObservabilityCheck[];
  blockers: string[];
  warnings: string[];
  readinessScore: number;
  verdict: ProductionObservabilityVerdict;
  alertChannelStatus: ProductionObservabilityStatus;
  incidentOwnerStatus: ProductionObservabilityStatus;
  runbookStatus: ProductionObservabilityStatus;
  sloSlaStatus: ProductionObservabilityStatus;
  rtoRpoStatus: ProductionObservabilityStatus;
}

const requiredTypes: Array<{ type: ProductionObservabilityCheckType; blocker: string; severity: ProductionObservabilitySeverity }> = [
  { type: 'health_monitor', blocker: 'Production health monitor evidence is missing.', severity: 'critical' },
  { type: 'logging', blocker: 'Production logging readiness evidence is missing.', severity: 'blocker' },
  { type: 'audit_logging', blocker: 'Production audit logging evidence is missing.', severity: 'blocker' },
  { type: 'alert_channel', blocker: 'Production alert channel evidence is missing.', severity: 'critical' },
  { type: 'incident_owner', blocker: 'Production incident owner evidence is missing.', severity: 'critical' },
  { type: 'escalation_policy', blocker: 'Production escalation policy evidence is missing.', severity: 'blocker' },
  { type: 'runbook', blocker: 'Production rollback/runbook evidence is missing.', severity: 'critical' },
  { type: 'slo_sla', blocker: 'Production SLO/SLA threshold evidence is missing.', severity: 'critical' },
  { type: 'rto_rpo', blocker: 'Production RTO/RPO evidence is missing.', severity: 'critical' },
  { type: 'dashboard', blocker: 'Production dashboard availability evidence is missing.', severity: 'blocker' },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function hasVerified(checks: ProductionObservabilityCheck[], type: ProductionObservabilityCheckType): boolean {
  return checks.some((check) => check.type === type && check.status === 'verified');
}

function statusFor(checks: ProductionObservabilityCheck[], type: ProductionObservabilityCheckType): ProductionObservabilityStatus {
  if (hasVerified(checks, type)) return 'verified';
  if (checks.some((check) => check.type === type && check.status === 'configured')) return 'configured';
  if (checks.some((check) => check.type === type && check.status === 'failed')) return 'failed';
  return 'missing';
}

export function getRequiredProductionObservabilityChecks() {
  return clone(requiredTypes);
}

export function isUnsafeEndpoint(endpoint: string): boolean {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|mock|demo/i.test(endpoint);
}

export function validateHealthMonitor(input: HealthMonitorInput): string[] {
  const warnings: string[] = [];
  if (!input.name.trim()) warnings.push('Health monitor name is required.');
  if (!input.endpoint.trim() || isUnsafeEndpoint(input.endpoint)) warnings.push('Production health monitor endpoint must not be localhost, mock, or demo.');
  if (input.uptimePercent < 99.5) warnings.push('Uptime monitor threshold is below 99.5%.');
  if (input.latencyMs > 500) warnings.push('Latency threshold exceeds 500ms.');
  if (input.errorRatePercent > 1) warnings.push('Error rate threshold exceeds 1%.');
  return warnings;
}

export function buildProductionObservabilityDashboard(checks: ProductionObservabilityCheck[]): ProductionObservabilityDashboard {
  const blockers = requiredTypes
    .filter((requirement) => !hasVerified(checks, requirement.type))
    .map((requirement) => requirement.blocker);
  const failed = checks.filter((check) => check.status === 'failed');
  const warnings = [
    ...checks.flatMap((check) => check.warnings.map((warning) => `${check.name}: ${warning}`)),
    ...failed.map((check) => `${check.name} failed verification.`),
  ];
  const verifiedCount = requiredTypes.filter((requirement) => hasVerified(checks, requirement.type)).length;
  const readinessScore = Math.round((verifiedCount / requiredTypes.length) * 100);
  const verdict: ProductionObservabilityVerdict = blockers.length || failed.some((check) => check.severity === 'critical') ? 'BLOCKED' : warnings.length ? 'WARNING' : 'READY';

  return {
    checks: clone(checks),
    healthMatrix: clone(checks.filter((check) => check.type === 'health_monitor')),
    alertChannels: clone(checks.filter((check) => check.type === 'alert_channel')),
    incidentOwners: clone(checks.filter((check) => check.type === 'incident_owner')),
    runbooks: clone(checks.filter((check) => check.type === 'runbook')),
    sloSlaChecks: clone(checks.filter((check) => check.type === 'slo_sla')),
    rtoRpoChecks: clone(checks.filter((check) => check.type === 'rto_rpo')),
    blockers,
    warnings,
    readinessScore,
    verdict,
    alertChannelStatus: statusFor(checks, 'alert_channel'),
    incidentOwnerStatus: statusFor(checks, 'incident_owner'),
    runbookStatus: statusFor(checks, 'runbook'),
    sloSlaStatus: statusFor(checks, 'slo_sla'),
    rtoRpoStatus: statusFor(checks, 'rto_rpo'),
  };
}
