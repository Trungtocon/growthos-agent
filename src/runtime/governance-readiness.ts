import type { Artifact } from '../domain/types';

export type GovernanceReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED';

export type GovernanceReadinessCheckId =
  | 'policyInheritanceReady'
  | 'decisionEngineReady'
  | 'enforcementReady'
  | 'approvalExecutionReady'
  | 'rbacReady'
  | 'authorizationAuditReady'
  | 'budgetReady'
  | 'usageLedgerReady'
  | 'costReconciliationReady'
  | 'workspaceGovernanceReady'
  | 'organizationGovernanceReady'
  | 'runtimeIntegrationReady'
  | 'artifactExportReady';

export interface GovernanceReadinessCheck {
  id: GovernanceReadinessCheckId;
  label: string;
  status: GovernanceReadinessStatus;
  message: string;
  evidenceCount: number;
  updatedAt: string;
  nextAction?: string;
}

export interface GovernanceReadinessReport {
  id: string;
  status: GovernanceReadinessStatus;
  checks: GovernanceReadinessCheck[];
  blockedReasons: string[];
  warnings: string[];
  readyModules: string[];
  generatedAt: string;
  recommendedNextAction: string;
}

export interface GovernanceExitGateResult {
  report: GovernanceReadinessReport;
  artifacts: Artifact[];
}

export function createGovernanceReadinessReport(checks: GovernanceReadinessCheck[]): GovernanceReadinessReport {
  const generatedAt = new Date().toISOString();
  const blockedReasons = checks
    .filter((check) => check.status === 'BLOCKED')
    .map((check) => `${check.label}: ${check.message}`);
  const warnings = checks
    .filter((check) => check.status === 'WARNING')
    .map((check) => `${check.label}: ${check.message}`);
  const readyModules = checks
    .filter((check) => check.status === 'READY')
    .map((check) => check.label);
  const status: GovernanceReadinessStatus = blockedReasons.length ? 'BLOCKED' : warnings.length ? 'WARNING' : 'READY';

  return {
    id: `governance-readiness-${Date.now()}`,
    status,
    checks,
    blockedReasons,
    warnings,
    readyModules,
    generatedAt,
    recommendedNextAction: status === 'BLOCKED'
      ? 'Resolve blocked governance modules before enabling real Hermes execution.'
      : status === 'WARNING'
        ? 'Proceed to sandbox runtime integration with warnings monitored in governance readiness.'
        : 'Proceed to Sprint 8A real Hermes sandbox runtime integration.',
  };
}

export function governanceReadinessArtifacts(report: GovernanceReadinessReport, runId: string): Artifact[] {
  const createdAt = new Date().toISOString();
  const blockers = report.blockedReasons.map((reason) => `- ${reason}`).join('\n') || '- None';
  const warnings = report.warnings.map((warning) => `- ${warning}`).join('\n') || '- None';
  const checklist = report.checks
    .map((check) => `| ${check.label} | ${check.status} | ${check.evidenceCount} | ${check.message} |`)
    .join('\n');

  return [
    {
      id: `artifact-enterprise-governance-exit-report-${report.id}`,
      runId,
      type: 'markdown',
      name: 'enterprise-governance-exit-report.md',
      source: 'mock',
      contentSummary: `Enterprise governance exit gate ${report.status}.`,
      contentText: [
        '# Enterprise Governance Exit Report',
        '',
        `Status: ${report.status}`,
        `Generated: ${report.generatedAt}`,
        '',
        '## Checks',
        '| Module | Status | Evidence | Message |',
        '|---|---|---:|---|',
        checklist,
        '',
        '## Blockers',
        blockers,
        '',
        '## Warnings',
        warnings,
        '',
        '## Next Action',
        report.recommendedNextAction,
      ].join('\n'),
      createdAt,
    },
    {
      id: `artifact-governance-readiness-${report.id}`,
      runId,
      type: 'json',
      name: 'governance-readiness.json',
      source: 'mock',
      contentSummary: 'Normalized governance readiness report.',
      contentJson: report,
      createdAt,
    },
    {
      id: `artifact-governance-blockers-${report.id}`,
      runId,
      type: 'json',
      name: 'governance-blockers.json',
      source: 'mock',
      contentSummary: `${report.blockedReasons.length} blocker(s), ${report.warnings.length} warning(s).`,
      contentJson: {
        status: report.status,
        blockedReasons: report.blockedReasons,
        warnings: report.warnings,
      },
      createdAt,
    },
    {
      id: `artifact-governance-next-actions-${report.id}`,
      runId,
      type: 'markdown',
      name: 'governance-next-actions.md',
      source: 'mock',
      contentSummary: report.recommendedNextAction,
      contentText: [
        '# Governance Next Actions',
        '',
        `Exit gate status: ${report.status}`,
        '',
        '## Recommended Next Action',
        report.recommendedNextAction,
        '',
        '## Warning Follow-up',
        warnings,
      ].join('\n'),
      createdAt,
    },
  ];
}
