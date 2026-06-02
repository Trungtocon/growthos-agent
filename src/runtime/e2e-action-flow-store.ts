import { demoWorkspace } from '../data/demo-fixtures';
import { registerArtifact } from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import type { ApiContractId, ProductionApiError } from './api-contract';
import { getApiContractById } from './api-contract-store';
import type { BackendAdapterMode } from './backend-adapter';
import {
  type E2EActionAuditEvent,
  type E2EActionFlow,
  type E2EActionFlowId,
  type E2EActionFlowState,
  type E2EActionFlowStatus,
  type E2EActionFlowStep,
  type E2EActionFlowValidation,
  type E2EActionRequestLog,
  type E2EActionResponseLog,
} from './e2e-action-flow';
import { executeApiContract } from './production-api-client';

const E2E_ACTION_FLOW_KEY = 'uikigai-e2e-action-flow-v1';

interface FlowDefinition {
  flowId: E2EActionFlowId;
  name: string;
  description: string;
  sequence: ApiContractId[];
  readinessGates: string[];
}

const FLOW_DEFINITIONS: FlowDefinition[] = [
  {
    flowId: 'start-run-flow',
    name: 'Start Run Flow',
    description: 'UI start run action through contract, backend adapter, runtime state, and audit output.',
    sequence: ['runtime.run.start'],
    readinessGates: ['api_contract', 'backend_adapter', 'runtime_store'],
  },
  {
    flowId: 'approval-required-flow',
    name: 'Approval Required Flow',
    description: 'Run start with approval submission checkpoint.',
    sequence: ['runtime.run.start', 'approval.submit'],
    readinessGates: ['approval_execution', 'governance'],
  },
  {
    flowId: 'approve-and-resume-flow',
    name: 'Approve And Resume Flow',
    description: 'Approval submit then runtime approval contract to resume execution.',
    sequence: ['approval.submit', 'runtime.run.approve', 'runtime.run.start'],
    readinessGates: ['approval_execution', 'runtime_store'],
  },
  {
    flowId: 'reject-and-cancel-flow',
    name: 'Reject And Cancel Flow',
    description: 'Approval rejection followed by runtime cancellation.',
    sequence: ['approval.submit', 'runtime.run.reject', 'runtime.run.cancel'],
    readinessGates: ['approval_execution', 'runtime_store'],
  },
  {
    flowId: 'worker-lifecycle-flow',
    name: 'Worker Start/Pause/Resume/Stop Flow',
    description: 'Worker control lifecycle through API contracts.',
    sequence: ['worker.start', 'worker.pause', 'worker.resume', 'worker.stop'],
    readinessGates: ['worker_observability', 'governance'],
  },
  {
    flowId: 'artifact-export-flow',
    name: 'Artifact Export Flow',
    description: 'Artifact export action through contract and artifact registry output.',
    sequence: ['artifact.export'],
    readinessGates: ['artifact_registry'],
  },
  {
    flowId: 'governance-blocked-flow',
    name: 'Governance Blocked Flow',
    description: 'Production action expected to stop when readiness or governance gate blocks execution.',
    sequence: ['governance.evaluate', 'runtime.run.start'],
    readinessGates: ['governance', 'production_readiness'],
  },
  {
    flowId: 'production-readiness-check-flow',
    name: 'Production Readiness Check Flow',
    description: 'Production readiness contract execution and blocker visibility.',
    sequence: ['productionReadiness.check'],
    readinessGates: ['deployment_config', 'production_readiness'],
  },
  {
    flowId: 'certified-sandbox-run-flow',
    name: 'Certified Sandbox Run Flow',
    description: 'Certified sandbox run contract with sandbox fallback when env is missing.',
    sequence: ['certifiedSandbox.run'],
    readinessGates: ['runtime_certification', 'certified_sandbox'],
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stepsFor(definition: FlowDefinition): E2EActionFlowStep[] {
  return definition.sequence.map((contractId, index) => ({
    id: `${definition.flowId}-step-${index + 1}`,
    order: index + 1,
    name: contractId,
    contractId,
    status: 'pending',
  }));
}

function flowFromDefinition(definition: FlowDefinition): E2EActionFlow {
  return {
    flowId: definition.flowId,
    name: definition.name,
    description: definition.description,
    contractSequence: definition.sequence,
    steps: stepsFor(definition),
    currentStep: 0,
    status: 'idle',
    requestLog: [],
    responseLog: [],
    normalizedErrors: [],
    artifactOutputs: [],
    auditTimeline: [],
    backendMode: 'mock',
    readinessGates: definition.readinessGates,
    warnings: [],
    finalVerdict: 'Not run.',
    updatedAt: nowIso(),
  };
}

function emptyState(): E2EActionFlowState {
  return {
    flows: FLOW_DEFINITIONS.map(flowFromDefinition),
    artifacts: [],
    updatedAt: nowIso(),
  };
}

function readState(): E2EActionFlowState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(E2E_ACTION_FLOW_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<E2EActionFlowState>;
    return {
      flows: parsed.flows?.length ? parsed.flows : FLOW_DEFINITIONS.map(flowFromDefinition),
      artifacts: parsed.artifacts ?? [],
      lastRunFlowId: parsed.lastRunFlowId,
      validation: parsed.validation,
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: E2EActionFlowState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(E2E_ACTION_FLOW_KEY, JSON.stringify({ ...state, updatedAt: nowIso() }));
}

function payloadFor(contractId: ApiContractId): Record<string, unknown> {
  if (contractId === 'runtime.run.start') return { ticketId: 'ticket-audit-module-3' };
  if (contractId === 'runtime.run.cancel') return { runId: 'run-demo-001' };
  if (contractId === 'runtime.run.approve') return { approvalId: 'approval-crm-write', runId: 'run-demo-001' };
  if (contractId === 'runtime.run.reject') return { approvalId: 'approval-crm-write', runId: 'run-demo-001', reason: 'Rejected by E2E flow.' };
  if (contractId === 'artifact.export') return { artifactId: 'artifact-runtime-report', format: 'markdown' };
  if (contractId === 'approval.submit') return { approvalId: 'approval-crm-write', decision: 'approved', note: 'E2E action flow approval.' };
  if (contractId === 'governance.evaluate') return { action: 'runtime.run.start', actorId: 'user-demo-admin', scope: 'workspace' };
  if (contractId.startsWith('worker.')) return { workerId: 'worker-autonomous-loop-1', reason: 'E2E flow worker control.' };
  if (contractId === 'certifiedSandbox.run') return { certificationRunId: 'runtime-certification-run-demo', runtimeMode: 'sandbox' };
  return { workspaceId: demoWorkspace.id };
}

function audit(type: E2EActionAuditEvent['type'], message: string): E2EActionAuditEvent {
  return { id: unique('e2e-audit'), type, message, createdAt: nowIso() };
}

function flowArtifact(flow: E2EActionFlow): ArtifactRecord {
  const createdAt = nowIso();
  return registerArtifact({
    id: `artifact-e2e-flow-${flow.flowId}-${Date.now()}`,
    name: `${flow.name} Result`,
    type: 'AUDIT',
    lifecycle: 'AVAILABLE',
    workspaceId: demoWorkspace.id,
    runId: flow.flowId,
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      runId: flow.flowId,
      source: 'mock',
      sourceType: 'e2e-action-flow',
      contentSummary: flow.finalVerdict,
      tags: ['e2e-action-flow', flow.backendMode, flow.status],
      sizeBytes: JSON.stringify(flow.responseLog).length,
    },
    createdAt,
    updatedAt: createdAt,
  });
}

function verdictFor(status: E2EActionFlowStatus, mode: BackendAdapterMode, warnings: string[]): string {
  if (status === 'blocked') return `BLOCKED: ${warnings[0] ?? 'Readiness or governance gate stopped execution.'}`;
  if (status === 'failed') return 'FAILED: one or more contract calls failed.';
  if (mode === 'mock') return 'COMPLETED WITH MOCK RESPONSES';
  if (mode === 'sandbox') return warnings.length ? 'COMPLETED WITH SANDBOX FALLBACK WARNING' : 'COMPLETED AGAINST SANDBOX CONTRACTS';
  return 'COMPLETED AGAINST PRODUCTION CONTRACTS';
}

export function getE2EActionFlows(): E2EActionFlow[] {
  return clone(readState().flows);
}

export function getE2EActionFlow(flowId: E2EActionFlowId): E2EActionFlow | undefined {
  return clone(readState().flows.find((flow) => flow.flowId === flowId));
}

export function validateE2EFlowContracts(): E2EActionFlowValidation {
  const flows = getE2EActionFlows();
  const missingContracts: string[] = [];
  for (const flow of flows) {
    for (const contractId of flow.contractSequence) {
      if (!getApiContractById(contractId)) missingContracts.push(`${flow.flowId}:${contractId}`);
    }
  }
  const invalidIds = Array.from(new Set(missingContracts.map((item) => item.split(':')[0] as E2EActionFlowId)));
  const validation: E2EActionFlowValidation = {
    valid: flows.filter((flow) => !invalidIds.includes(flow.flowId)).map((flow) => flow.flowId),
    invalid: invalidIds,
    missingContracts,
    generatedAt: nowIso(),
  };
  writeState({ ...readState(), validation });
  return clone(validation);
}

export async function runE2EActionFlow(flowId: E2EActionFlowId, mode: BackendAdapterMode = 'mock'): Promise<E2EActionFlow> {
  const state = readState();
  const base = state.flows.find((flow) => flow.flowId === flowId) ?? flowFromDefinition(FLOW_DEFINITIONS.find((definition) => definition.flowId === flowId)!);
  let flow: E2EActionFlow = {
    ...base,
    steps: base.steps.map((step) => ({ ...step, status: 'pending', startedAt: undefined, completedAt: undefined, message: undefined })),
    currentStep: 0,
    status: 'running',
    requestLog: [],
    responseLog: [],
    normalizedErrors: [],
    artifactOutputs: [],
    auditTimeline: [audit('flow.started', `${base.name} started in ${mode} mode.`)],
    backendMode: mode,
    warnings: mode === 'mock' ? ['mock response path active'] : [],
    finalVerdict: 'Running.',
    updatedAt: nowIso(),
  };

  for (const step of flow.steps) {
    flow.currentStep = step.order;
    step.status = 'running';
    step.startedAt = nowIso();
    flow.auditTimeline.push(audit('step.started', `${step.contractId} request started.`));
    const request: E2EActionRequestLog = {
      id: unique('e2e-request'),
      stepId: step.id,
      contractId: step.contractId,
      mode,
      payloadSummary: JSON.stringify(payloadFor(step.contractId)),
      createdAt: nowIso(),
    };
    flow.requestLog.push(request);

    const result = await executeApiContract(step.contractId, { mode, body: payloadFor(step.contractId) });
    const response: E2EActionResponseLog = {
      id: unique('e2e-response'),
      requestId: request.id,
      contractId: step.contractId,
      status: result.status,
      ok: result.ok,
      fallbackUsed: result.fallbackUsed,
      message: result.error?.message ?? `${step.contractId} completed with ${result.status}.`,
      createdAt: nowIso(),
    };
    flow.responseLog.push(response);
    if (result.fallbackUsed) flow.warnings.push(`${step.contractId} used fallback.`);
    if (result.error) flow.normalizedErrors.push(result.error as ProductionApiError);

    if (!result.ok) {
      step.status = 'blocked';
      step.completedAt = nowIso();
      step.message = result.error?.message ?? 'Contract call blocked.';
      flow.status = mode === 'production' ? 'blocked' : 'failed';
      flow.auditTimeline.push(audit('step.blocked', step.message));
      break;
    }

    step.status = 'completed';
    step.completedAt = nowIso();
    step.message = response.message;
    flow.auditTimeline.push(audit('step.completed', response.message));
  }

  if (flow.status === 'running') {
    flow.status = flow.flowId === 'approval-required-flow' ? 'waiting_approval' : 'completed';
  }
  if (flow.status === 'waiting_approval') {
    flow.finalVerdict = mode === 'mock' ? 'WAITING_APPROVAL WITH MOCK RESPONSES' : 'WAITING_APPROVAL';
  } else {
    flow.finalVerdict = verdictFor(flow.status, mode, flow.warnings);
  }
  if (flow.flowId === 'artifact-export-flow' || flow.status === 'completed') {
    const output = flowArtifact(flow);
    flow.artifactOutputs = [output];
    flow.auditTimeline.push(audit('artifact.created', `${output.name} registered.`));
  }
  flow.auditTimeline.push(audit(flow.status === 'failed' ? 'flow.failed' : flow.status === 'blocked' ? 'step.blocked' : 'flow.completed', flow.finalVerdict));
  flow.updatedAt = nowIso();

  const flows = state.flows.map((item) => item.flowId === flow.flowId ? flow : item);
  writeState({ ...state, flows, lastRunFlowId: flow.flowId });
  return clone(flow);
}

export async function runAllE2EActionFlows(mode: BackendAdapterMode = 'mock'): Promise<E2EActionFlow[]> {
  const results: E2EActionFlow[] = [];
  for (const definition of FLOW_DEFINITIONS) {
    results.push(await runE2EActionFlow(definition.flowId, mode));
  }
  return results;
}

function exportArtifact(name: string, type: ArtifactRecord['type'], summary: string, content: unknown): ArtifactRecord {
  const createdAt = nowIso();
  return registerArtifact({
    id: `artifact-e2e-export-${name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}`,
    name,
    type,
    lifecycle: 'AVAILABLE',
    workspaceId: demoWorkspace.id,
    runId: 'e2e-action-flow',
    version: 1,
    metadata: {
      workspaceId: demoWorkspace.id,
      runId: 'e2e-action-flow',
      source: 'mock',
      sourceType: 'e2e-action-flow-export',
      contentSummary: summary,
      tags: ['e2e-action-flow', 'export'],
      sizeBytes: JSON.stringify(content).length,
    },
    createdAt,
    updatedAt: createdAt,
  });
}

export function exportE2EActionFlowArtifacts(): ArtifactRecord[] {
  const state = readState();
  const flowRows = state.flows.map((flow) => `| ${flow.name} | ${flow.status} | ${flow.backendMode} | ${flow.finalVerdict} |`).join('\n');
  const trace = state.flows.flatMap((flow) => flow.responseLog.map((response) => ({ flowId: flow.flowId, ...response })));
  const artifacts = [
    exportArtifact('e2e-action-flow-report.md', 'REPORT', `${state.flows.length} E2E flows reported.`, ['# E2E Action Flow Report', '', '| Flow | Status | Mode | Verdict |', '|---|---|---|---|', flowRows].join('\n')),
    exportArtifact('e2e-action-flow-results.json', 'AUDIT', 'E2E action flow results exported.', state.flows),
    exportArtifact('production-action-audit.md', 'AUDIT', 'Production action audit exported.', state.flows.flatMap((flow) => flow.auditTimeline)),
    exportArtifact('contract-execution-trace.json', 'AUDIT', `${trace.length} contract response trace entries.`, trace),
    exportArtifact('go-live-action-readiness.md', 'REPORT', 'Go-live action readiness report exported.', `# Go-Live Action Readiness\n\nCompleted flows: ${state.flows.filter((flow) => flow.status === 'completed').length}\nBlocked flows: ${state.flows.filter((flow) => flow.status === 'blocked').length}`),
  ];
  writeState({ ...state, artifacts });
  return clone(artifacts);
}

export function selectE2EActionFlowSummary() {
  const flows = getE2EActionFlows();
  return {
    total: flows.length,
    completed: flows.filter((flow) => flow.status === 'completed').length,
    blocked: flows.filter((flow) => flow.status === 'blocked').length,
    waitingApproval: flows.filter((flow) => flow.status === 'waiting_approval').length,
    failed: flows.filter((flow) => flow.status === 'failed').length,
  };
}

export function selectE2EActionFlowArtifacts() {
  return clone(readState().artifacts);
}

export function clearE2EActionFlowStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(E2E_ACTION_FLOW_KEY);
}
