import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import { selectApiContractStatus } from './api-contract-store';
import { getBackendAdapterState } from './backend-adapter-store';
import { getCertifiedSandboxRunDashboard } from './certified-sandbox-run-store';
import { getDeploymentConfigDashboard } from './deployment-config-store';
import { selectE2EActionFlowSummary } from './e2e-action-flow-store';
import { getGovernanceReadinessReport } from './governance-readiness-store';
import { getProductionReadinessDashboard } from './production-readiness-store';
import { getRuntimeCertificationDashboard } from './runtime-certification-store';
import { getBackendReadinessReport } from './backend-health';
import { getDatabaseReadinessReport } from './database-readiness';
import { getAuthReadinessReport } from './auth-readiness-store';
import { getEnvironmentReadinessReport } from './environment-readiness-store';
import {
  filterReadinessBlockersForEvidence,
  selectProductionConfigEvidenceDashboard,
} from './production-config-evidence-store';
import type {
  PreGoLiveGateStatus,
  PreGoLiveValidationGate,
  PreGoLiveValidationRun,
  PreGoLiveValidationState,
  PreGoLiveVerdict,
} from './pre-golive-validation';

const PRE_GOLIVE_KEY = 'uikigai-pre-golive-validation-v1';

interface GateDefinition {
  gateId: string;
  name: string;
  category: string;
  relatedRoutes: string[];
  relatedSmokeCommand: string;
  evaluate: () => Pick<PreGoLiveValidationGate, 'status' | 'score' | 'blockers' | 'warnings' | 'evidence'>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyState(): PreGoLiveValidationState {
  return { runs: [], artifacts: [], updatedAt: nowIso() };
}

function readState(): PreGoLiveValidationState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(PRE_GOLIVE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<PreGoLiveValidationState>;
    return {
      runs: parsed.runs ?? [],
      activeRunId: parsed.activeRunId,
      artifacts: parsed.artifacts ?? [],
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: PreGoLiveValidationState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PRE_GOLIVE_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function cliGate(gateId: string, name: string, category: string, relatedSmokeCommand: string, evidence: string[]): GateDefinition {
  return {
    gateId,
    name,
    category,
    relatedRoutes: [],
    relatedSmokeCommand,
    evaluate: () => ({
      status: 'warning',
      score: 85,
      blockers: [],
      warnings: [`${name} requires CLI evidence from ${relatedSmokeCommand}.`],
      evidence,
    }),
  };
}

function gateDefinitions(): GateDefinition[] {
  return [
    {
      gateId: 'production-config-evidence',
      name: 'Production Config Evidence',
      category: 'production',
      relatedRoutes: ['/production-config-evidence'],
      relatedSmokeCommand: 'npm run smoke:production-config-evidence',
      evaluate: () => {
        const dashboard = selectProductionConfigEvidenceDashboard();
        return {
          status: dashboard.verdict === 'READY' ? 'pass' : 'blocked',
          score: dashboard.readinessScore,
          blockers: dashboard.remainingBlockers,
          warnings: dashboard.expiryWarnings.concat(dashboard.rejected.map((entry) => `${entry.category} evidence was rejected.`)),
          evidence: [
            `verified=${dashboard.verified.length}`,
            `missing=${dashboard.missing.length}`,
            `expired=${dashboard.expired.length}`,
            `verdict=${dashboard.verdict}`,
          ],
        };
      },
    },
    {
      gateId: 'deployment-config',
      name: 'Deployment Config',
      category: 'production',
      relatedRoutes: ['/deployment-config'],
      relatedSmokeCommand: 'npm run smoke:deployment-config',
      evaluate: () => {
        const dashboard = getDeploymentConfigDashboard();
        const ready = dashboard.readiness.productionReady;
        return {
          status: ready ? 'pass' : 'blocked',
          score: ready ? 100 : 25,
          blockers: ready ? [] : dashboard.blockers.map((entry) => entry.reason).concat('Production deployment config is not READY.'),
          warnings: dashboard.warnings.map((entry) => entry.reason),
          evidence: [`mode=${dashboard.activeConfig?.runtimeMode ?? 'not_checked'}`, `status=${dashboard.status}`, `missingEnv=${dashboard.missingEnv.length}`],
        };
      },
    },
    {
      gateId: 'production-readiness',
      name: 'Production Readiness',
      category: 'production',
      relatedRoutes: ['/production-readiness'],
      relatedSmokeCommand: 'npm run smoke:production-readiness',
      evaluate: () => {
        const dashboard = getProductionReadinessDashboard();
        const ready = dashboard.status === 'READY';
        return {
          status: ready ? 'pass' : dashboard.status === 'BLOCKED' ? 'blocked' : 'warning',
          score: ready ? 100 : dashboard.status === 'BLOCKED' ? 25 : 70,
          blockers: dashboard.blockers.map((entry) => entry.reason),
          warnings: dashboard.warnings.map((entry) => entry.reason),
          evidence: [`status=${dashboard.status}`, `checklist=${dashboard.checklist.length}`, `blockers=${dashboard.blockers.length}`],
        };
      },
    },
    {
      gateId: 'runtime-certification',
      name: 'Runtime Certification',
      category: 'runtime',
      relatedRoutes: ['/runtime-certification'],
      relatedSmokeCommand: 'npm run smoke:runtime-certification',
      evaluate: () => {
        const dashboard = getRuntimeCertificationDashboard();
        const certified = dashboard.status === 'certified';
        return {
          status: certified ? 'pass' : 'blocked',
          score: certified ? 100 : 35,
          blockers: certified ? [] : ['Runtime certification has not passed for a production candidate.'],
          warnings: dashboard.findings.map((entry) => entry.message),
          evidence: [`status=${dashboard.status}`, `runs=${dashboard.runs.length}`, `findings=${dashboard.findings.length}`],
        };
      },
    },
    {
      gateId: 'certified-sandbox-run',
      name: 'Certified Sandbox Run',
      category: 'runtime',
      relatedRoutes: ['/certified-sandbox-run'],
      relatedSmokeCommand: 'npm run smoke:certified-sandbox-run',
      evaluate: () => {
        const dashboard = getCertifiedSandboxRunDashboard();
        return {
          status: dashboard.completedRuns > 0 ? 'pass' : 'blocked',
          score: dashboard.completedRuns > 0 ? 100 : 30,
          blockers: dashboard.completedRuns > 0 ? [] : ['No completed certified sandbox run is available.'],
          warnings: dashboard.status === 'not_started' ? ['Certified sandbox run has not started in this browser session.'] : [],
          evidence: [`runs=${dashboard.runs.length}`, `completed=${dashboard.completedRuns}`, `status=${dashboard.status}`],
        };
      },
    },
    {
      gateId: 'backend-adapter',
      name: 'Backend Adapter',
      category: 'backend',
      relatedRoutes: ['/backend-adapter'],
      relatedSmokeCommand: 'npm run smoke:backend-adapter',
      evaluate: () => {
        const state = getBackendAdapterState();
        const mock = state.mode === 'mock';
        return {
          status: state.blockers.length ? 'blocked' : mock ? 'warning' : 'pass',
          score: state.blockers.length ? 35 : mock ? 75 : 100,
          blockers: state.blockers.map((entry) => entry.reason),
          warnings: state.warnings.map((entry) => entry.reason).concat(mock ? ['Backend adapter remains in mock mode.'] : []),
          evidence: [`mode=${state.mode}`, `health=${state.health.status}`, `blockers=${state.blockers.length}`],
        };
      },
    },
    {
      gateId: 'backend-readiness',
      name: 'Backend Readiness',
      category: 'backend',
      relatedRoutes: ['/backend-readiness'],
      relatedSmokeCommand: 'npm run smoke:backend-readiness',
      evaluate: () => {
        const report = getBackendReadinessReport('PRODUCTION');
        const blockers = filterReadinessBlockersForEvidence('backend-readiness', report.blockers.map((entry) => `production backend: ${entry}`));
        return {
          status: blockers.length ? 'blocked' : report.warnings.length ? 'warning' : 'pass',
          score: blockers.length ? report.readinessScore : Math.max(report.readinessScore, 78),
          blockers,
          warnings: report.warnings,
          evidence: [`environment=${report.environment.id}`, `health=${report.status}`, `auth=${report.auth.status}`, `endpoints=${report.endpointReachability.length}`],
        };
      },
    },
    {
      gateId: 'database-readiness',
      name: 'Database Readiness',
      category: 'backend',
      relatedRoutes: ['/database-readiness'],
      relatedSmokeCommand: 'npm run smoke:database-readiness',
      evaluate: () => {
        const report = getDatabaseReadinessReport('PRODUCTION');
        const blockers = filterReadinessBlockersForEvidence('database-readiness', report.blockers.map((entry) => `production database: ${entry}`));
        return {
          status: blockers.length ? 'blocked' : report.warnings.length || report.status === 'WARNING' ? 'warning' : 'pass',
          score: blockers.length ? report.readinessScore : Math.max(report.readinessScore, 78),
          blockers,
          warnings: report.warnings,
          evidence: [`mode=${report.config.mode}`, `health=${report.connectionHealth}`, `schema=${report.schemaVersion}`, `domains=${report.persistenceDomains.length}`],
        };
      },
    },
    {
      gateId: 'auth-readiness',
      name: 'Auth & Session Readiness',
      category: 'backend',
      relatedRoutes: ['/auth-readiness'],
      relatedSmokeCommand: 'npm run smoke:auth-readiness',
      evaluate: () => {
        const report = getAuthReadinessReport('PRODUCTION');
        const blockers = filterReadinessBlockersForEvidence('auth-readiness', report.blockers.map((entry) => `production auth: ${entry}`));
        return {
          status: blockers.length ? 'blocked' : report.warnings.length || report.status === 'WARNING' ? 'warning' : 'pass',
          score: blockers.length ? report.readinessScore : Math.max(report.readinessScore, 78),
          blockers,
          warnings: report.warnings,
          evidence: [
            `provider=${report.provider.status}`,
            `session=${report.sessionLifecycle.status}`,
            `token=${report.tokenValidation.status}`,
            `rbac=${report.rbacBinding.status}`,
            `tenantWorkspace=${report.tenantWorkspaceBinding.status}`,
          ],
        };
      },
    },
    {
      gateId: 'environment-readiness',
      name: 'Environment & Secrets Readiness',
      category: 'backend',
      relatedRoutes: ['/environment-readiness'],
      relatedSmokeCommand: 'npm run smoke:environment-readiness',
      evaluate: () => {
        const report = getEnvironmentReadinessReport('PRODUCTION');
        const blockers = filterReadinessBlockersForEvidence('environment-readiness', report.blockers.map((entry) => `production environment: ${entry}`));
        return {
          status: blockers.length ? 'blocked' : report.warnings.length || report.status === 'WARNING' ? 'warning' : 'pass',
          score: blockers.length ? report.readinessScore : Math.max(report.readinessScore, 78),
          blockers,
          warnings: report.warnings,
          evidence: [
            `required=${report.variables.filter((entry) => entry.required).length}`,
            `missing=${report.missingRequired.length}`,
            `secrets=${report.secretStatus}`,
            `rotation=${report.rotationStatus.status}`,
          ],
        };
      },
    },
    {
      gateId: 'api-contracts',
      name: 'API Contracts',
      category: 'backend',
      relatedRoutes: ['/api-contracts'],
      relatedSmokeCommand: 'npm run smoke:api-contracts',
      evaluate: () => {
        const status = selectApiContractStatus();
        return {
          status: status.invalidSchema || status.blocked ? 'fail' : status.missingEnv || status.warning ? 'warning' : 'pass',
          score: status.invalidSchema || status.blocked ? 20 : status.missingEnv || status.warning ? 82 : 100,
          blockers: status.invalidSchema ? [`${status.invalidSchema} API contracts have invalid schemas.`] : [],
          warnings: status.missingEnv ? [`${status.missingEnv} API contracts are missing environment config.`] : [],
          evidence: [`total=${status.total}`, `ready=${status.ready}`, `warning=${status.warning}`, `missingEnv=${status.missingEnv}`],
        };
      },
    },
    {
      gateId: 'e2e-action-flow',
      name: 'E2E Action Flow',
      category: 'backend',
      relatedRoutes: ['/e2e-action-flow'],
      relatedSmokeCommand: 'npm run smoke:e2e-action-flow',
      evaluate: () => {
        const summary = selectE2EActionFlowSummary();
        return {
          status: summary.failed ? 'fail' : summary.completed ? 'warning' : 'warning',
          score: summary.failed ? 30 : summary.completed ? 88 : 70,
          blockers: summary.failed ? [`${summary.failed} E2E action flows failed.`] : [],
          warnings: summary.completed < summary.total ? [`${summary.total - summary.completed} E2E flows need a fresh browser-session run.`] : [],
          evidence: [`total=${summary.total}`, `completed=${summary.completed}`, `blocked=${summary.blocked}`, `failed=${summary.failed}`],
        };
      },
    },
    cliGate('ui-action-wiring', 'UI Action Wiring', 'ui', 'npm run smoke:ui-action-wiring', ['silentButtons=0 required']),
    cliGate('real-ui-flow', 'Real UI Flow', 'ui', 'npm run smoke:real-ui-flow', ['48/48 routes required']),
    cliGate('interactions', 'Interactions', 'ui', 'npm run smoke:interactions', ['7/7 interactions required']),
    cliGate('workflow-actions', 'Workflow Actions', 'ui', 'npm run smoke:workflow-actions', ['5/5 workflow actions required']),
    cliGate('artifact-registry', 'Artifact Registry', 'runtime', 'npm run smoke:artifact-registry', ['artifact exports must register']),
    {
      gateId: 'governance-rbac-approval',
      name: 'Governance / RBAC / Approval',
      category: 'governance',
      relatedRoutes: ['/approvals', '/governance/policies', '/roles-permissions'],
      relatedSmokeCommand: 'npm run smoke:enterprise-governance-exit',
      evaluate: () => {
        const report = getGovernanceReadinessReport();
        return {
          status: report.blockedReasons.length ? 'blocked' : report.warnings.length ? 'warning' : 'pass',
          score: report.blockedReasons.length ? 35 : report.warnings.length ? 85 : 100,
          blockers: report.blockedReasons,
          warnings: report.warnings,
          evidence: [`status=${report.status}`, `readyModules=${report.readyModules.length}`],
        };
      },
    },
    cliGate('worker-control-recovery', 'Worker Control / Recovery', 'runtime', 'npm run smoke:worker-recovery', ['worker control and recovery smoke required']),
    cliGate('evaluation-feedback-improvement-loop', 'Evaluation / Feedback / Improvement Loop', 'quality', 'npm run smoke:run-evaluation', ['evaluation and improvement loop smoke required']),
    cliGate('static-assets', 'Static Assets', 'quality', 'npm run audit:static-assets', ['no production parity slices']),
    cliGate('bbox-35', 'BBox Screen 35', 'quality', 'npm run audit:bbox:35', ['Screen 35 requires 8/8']),
    cliGate('core-bbox', 'Core BBox', 'quality', 'npm run audit:bbox:08 ... audit:bbox:37', ['Core bbox screens 08/20/21/23/30/32/34/37']),
    cliGate('onboarding-parity', 'Onboarding Parity', 'quality', 'STRICT_MAX_DIFF_PERCENT=1.0 npm run parity:check -- --ids=1,2,3,4,5,6,7', ['Onboarding screens 01-07 require <=1%']),
  ];
}

function evaluateDefinition(definition: GateDefinition): PreGoLiveValidationGate {
  const evaluated = definition.evaluate();
  return {
    ...definition,
    ...evaluated,
    lastRunTimestamp: nowIso(),
    finalVerdict: evaluated.blockers[0] ?? evaluated.warnings[0] ?? 'Gate passed.',
  };
}

function calculateVerdict(gates: PreGoLiveValidationGate[]): PreGoLiveVerdict {
  if (gates.some((gate) => gate.status === 'fail')) return 'FAILED';
  if (gates.some((gate) => gate.status === 'blocked' || gate.blockers.length)) return 'BLOCKED';
  if (gates.some((gate) => gate.status === 'warning' || gate.warnings.length)) return 'READY_WITH_WARNINGS';
  return 'READY';
}

function calculateScore(gates: PreGoLiveValidationGate[]): number {
  if (!gates.length) return 0;
  return Math.round(gates.reduce((sum, gate) => sum + gate.score, 0) / gates.length);
}

function defaultGates(): PreGoLiveValidationGate[] {
  return gateDefinitions().map((definition) => ({
    gateId: definition.gateId,
    name: definition.name,
    category: definition.category,
    status: 'pending',
    score: 0,
    blockers: [],
    warnings: [],
    evidence: [],
    relatedRoutes: definition.relatedRoutes,
    relatedSmokeCommand: definition.relatedSmokeCommand,
    finalVerdict: 'Not checked.',
  }));
}

export function getPreGoLiveValidationGates(): PreGoLiveValidationGate[] {
  const active = getActivePreGoLiveValidation();
  return clone(active?.gates ?? defaultGates());
}

export function getActivePreGoLiveValidation(): PreGoLiveValidationRun | undefined {
  const state = readState();
  const run = state.runs.find((entry) => entry.id === state.activeRunId) ?? state.runs[0];
  return run ? clone(run) : undefined;
}

export function runFullPreGoLiveValidation(): PreGoLiveValidationRun {
  const gates = gateDefinitions().map(evaluateDefinition);
  const blockers = gates.flatMap((gate) => gate.blockers.map((message) => `${gate.name}: ${message}`));
  const warnings = gates.flatMap((gate) => gate.warnings.map((message) => `${gate.name}: ${message}`));
  const run: PreGoLiveValidationRun = {
    id: unique('pre-golive-validation'),
    status: 'completed',
    gates,
    readinessScore: calculateScore(gates),
    blockers,
    warnings,
    remainingChecklist: blockers.length
      ? blockers.map((message) => `Resolve: ${message}`)
      : warnings.map((message) => `Review: ${message}`),
    finalVerdict: calculateVerdict(gates),
    createdAt: nowIso(),
    completedAt: nowIso(),
  };
  const state = readState();
  writeState({ ...state, runs: [run, ...state.runs].slice(0, 12), activeRunId: run.id });
  return clone(run);
}

function exportedArtifact(name: string, type: ArtifactRecord['type'], summary: string, content: unknown): ArtifactRecord {
  const createdAt = nowIso();
  return registerArtifact({
    id: `artifact-pre-golive-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    type,
    lifecycle: 'AVAILABLE',
    workspaceId: demoWorkspace.id,
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      source: 'mock',
      sourceType: 'pre-golive-validation',
      contentSummary: summary,
      tags: ['pre-golive', 'go-live-pack', type.toLowerCase()],
      sizeBytes: JSON.stringify(content).length,
    },
    createdAt,
    updatedAt: createdAt,
  });
}

export function exportPreGoLiveValidationArtifacts(): ArtifactRecord[] {
  const run = getActivePreGoLiveValidation() ?? runFullPreGoLiveValidation();
  const artifacts = [
    exportedArtifact('pre-golive-validation-report.md', 'REPORT', `${run.finalVerdict} validation report.`, run),
    exportedArtifact('pre-golive-validation.json', 'AUDIT', `${run.gates.length} pre go-live gates exported.`, run),
    exportedArtifact('production-blockers.json', 'AUDIT', `${run.blockers.length} production blockers exported.`, run.blockers),
    exportedArtifact('go-live-checklist.md', 'REPORT', `${run.remainingChecklist.length} go-live checklist items exported.`, run.remainingChecklist),
    exportedArtifact('go-live-final-verdict.md', 'REPORT', `${run.finalVerdict} go-live verdict exported.`, run.finalVerdict),
  ];
  const state = readState();
  writeState({ ...state, artifacts });
  return clone(artifacts);
}

export function selectPreGoLiveValidationSummary() {
  const run = getActivePreGoLiveValidation();
  const gates = run?.gates ?? defaultGates();
  return {
    run,
    gates,
    total: gates.length,
    passed: gates.filter((gate) => gate.status === 'pass').length,
    warning: gates.filter((gate) => gate.status === 'warning').length,
    blocked: gates.filter((gate) => gate.status === 'blocked').length,
    failed: gates.filter((gate) => gate.status === 'fail').length,
    blockers: run?.blockers ?? [],
    warnings: run?.warnings ?? [],
    readinessScore: run?.readinessScore ?? 0,
    finalVerdict: run?.finalVerdict ?? 'BLOCKED',
  };
}

export function selectPreGoLiveValidationArtifacts(): ArtifactRecord[] {
  return clone(readState().artifacts);
}

export function clearPreGoLiveValidationStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PRE_GOLIVE_KEY);
}
