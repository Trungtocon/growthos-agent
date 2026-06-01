import { DEMO_RUN_ID, demoWorkspace } from '../data/demo-fixtures';
import type { Artifact } from '../domain/types';
import { getWorkflowData } from '../state/workflow-engine';
import { getApprovals } from '../runtime-store/approval-store';
import { getRunById, getRuns } from '../runtime-store/run-store';
import { getCurrentPlanForTicket } from '../runtime-store/run-plan-store';
import { getToolCallsByRun } from '../runtime-store/tool-call-store';
import { getBillingLedger, getUsageByRun } from '../runtime-store/usage-ledger-store';
import { getGovernanceDecisionHistory } from './governance-decision-store';
import { getBlockedRuns, getTerminatedRuns } from './governance-enforcement-store';
import {
  registerArtifact,
  searchArtifacts,
  updateMetadata,
} from './artifact-registry-store';
import type { ArtifactRecord } from './artifact-registry';
import {
  executionEdgeId,
  executionNodeId,
  type AgentExecutionGraph,
  type ExecutionGraphEdge,
  type ExecutionGraphEdgeType,
  type ExecutionGraphNode,
  type ExecutionGraphNodeType,
  type ExecutionGraphSummary,
  type ExecutionGraphTrace,
} from './agent-execution-graph';

const GRAPH_STORAGE_KEY = 'uikigai-agent-execution-graphs-v1';

interface GraphState {
  graphs: Record<string, AgentExecutionGraph>;
  updatedAt: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): GraphState {
  return { graphs: {}, updatedAt: new Date().toISOString() };
}

function readState(): GraphState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(GRAPH_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<GraphState>;
    return {
      graphs: parsed.graphs ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: GraphState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(state));
}

function persistGraph(graph: AgentExecutionGraph): AgentExecutionGraph {
  const state = readState();
  writeState({
    graphs: { ...state.graphs, [graph.id]: graph },
    updatedAt: new Date().toISOString(),
  });
  return clone(graph);
}

function addNode(nodes: Map<string, ExecutionGraphNode>, node: ExecutionGraphNode) {
  const existing = nodes.get(node.id);
  nodes.set(node.id, existing ? { ...existing, ...node, metadata: { ...existing.metadata, ...node.metadata } } : node);
}

function addEdge(edges: Map<string, ExecutionGraphEdge>, source: string | undefined, target: string | undefined, type: ExecutionGraphEdgeType, label?: string, metadata?: Record<string, unknown>) {
  if (!source || !target || source === target) return;
  const id = executionEdgeId(source, target, type);
  if (!edges.has(id)) edges.set(id, { id, source, target, type, label, metadata });
}

function node(type: ExecutionGraphNodeType, entityId: string, label: string, status?: string, metadata?: Record<string, unknown>): ExecutionGraphNode {
  return {
    id: executionNodeId(type, entityId),
    type,
    entityId,
    label,
    status,
    metadata,
  };
}

function graphSummary(workspaceId: string, graphs: AgentExecutionGraph[]): ExecutionGraphSummary {
  const nodes = graphs.flatMap((graph) => graph.nodes);
  const edges = graphs.flatMap((graph) => graph.edges);
  const actualCost = graphs.reduce((sum, graph) => sum + Number(graph.summary.actualCost || 0), 0);
  return {
    workspaceId,
    graphCount: graphs.length,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    runCount: nodes.filter((item) => item.type === 'RUN').length,
    artifactCount: nodes.filter((item) => item.type === 'ARTIFACT').length,
    approvalCount: nodes.filter((item) => item.type === 'APPROVAL').length,
    blockedNodeCount: nodes.filter((item) => item.status?.toLowerCase().includes('blocked')).length,
    failedNodeCount: nodes.filter((item) => item.status?.toLowerCase().includes('failed')).length,
    usageRecordCount: nodes.filter((item) => item.type === 'USAGE').length,
    actualCost: Number(actualCost.toFixed(4)),
    generatedAt: new Date().toISOString(),
  };
}

function currentRun(runId: string) {
  const runtimeRun = getRunById(runId);
  if (runtimeRun) return runtimeRun;
  return getWorkflowData().runs.find((run) => run.id === runId);
}

function relevantGovernanceReports(ids: Set<string>) {
  return getGovernanceDecisionHistory().filter((report) => ids.has(report.targetId) || ids.has(report.id));
}

function enrichArtifactLineage(record: ArtifactRecord, input: { agentId?: string; ticketId?: string; planId?: string; stepId?: string; approvalId?: string }) {
  updateMetadata(record.id, {
    runId: record.runId,
    agentId: record.metadata.agentId ?? input.agentId,
    ticketId: record.metadata.ticketId ?? input.ticketId,
    planId: record.metadata.planId ?? input.planId,
    stepId: record.metadata.stepId ?? input.stepId,
    toolId: record.metadata.toolId,
    approvalId: record.metadata.approvalId ?? input.approvalId,
  });
}

export function buildExecutionGraphForRun(runId = DEMO_RUN_ID): AgentExecutionGraph {
  const data = getWorkflowData();
  const run = currentRun(runId);
  if (!run) throw new Error(`Cannot build execution graph for missing run: ${runId}`);
  const workspaceId = data.workspace.id ?? demoWorkspace.id;
  const agent = data.agents.find((item) => item.id === run.agentId);
  const ticket = data.tickets.find((item) => item.id === run.ticketId);
  const plan = ticket ? getCurrentPlanForTicket(ticket.id) : undefined;
  const steps = plan?.steps ?? [];
  const toolCalls = getToolCallsByRun(run.id);
  const artifacts = searchArtifacts({ runId: run.id });
  const approvals = getApprovals().filter((approval) => approval.runId === run.id || approval.ticketId === run.ticketId || approval.agentId === run.agentId);
  const usage = getUsageByRun(run.id);
  const ledger = getBillingLedger(run.id);
  const blockedRuns = [...getBlockedRuns(), ...getTerminatedRuns()].filter((block) => block.targetId === run.id || block.targetId === plan?.id);
  const relevantIds = new Set([run.id, run.ticketId, run.agentId, plan?.id, ...steps.map((step) => step.id)].filter(Boolean) as string[]);
  const governanceReports = relevantGovernanceReports(relevantIds);
  const nodes = new Map<string, ExecutionGraphNode>();
  const edges = new Map<string, ExecutionGraphEdge>();
  const runLifecycle = (run as { lifecycle?: string }).lifecycle;
  const runNode = node('RUN', run.id, `Run ${run.id}`, runLifecycle ?? run.status, { ticketId: run.ticketId, agentId: run.agentId });

  addNode(nodes, runNode);
  if (agent) {
    const agentNode = node('AGENT', agent.id, agent.name, agent.status, { role: agent.role });
    addNode(nodes, agentNode);
    addEdge(edges, agentNode.id, runNode.id, 'EXECUTES', 'executes run');
  }

  if (plan) {
    const planNode = node('PLAN', plan.id, `Plan ${plan.workflowId}`, plan.status, { ticketId: plan.ticketId, estimatedCost: plan.estimatedCost });
    addNode(nodes, planNode);
    addEdge(edges, planNode.id, runNode.id, 'CREATED', 'created run');
    steps.forEach((step) => {
      const stepNode = node('STEP', step.id, step.name, step.status, { capabilityId: step.capabilityId, modelId: step.modelId });
      addNode(nodes, stepNode);
      addEdge(edges, planNode.id, stepNode.id, 'EXECUTES', `step ${step.order}`);
      addEdge(edges, stepNode.id, runNode.id, 'EXECUTES', 'run step');
    });
  }

  toolCalls.forEach((toolCall, index) => {
    const toolNode = node('TOOL_CALL', toolCall.id, toolCall.toolName, toolCall.status, { input: toolCall.input, output: toolCall.output });
    addNode(nodes, toolNode);
    const matchingStep = steps.find((step) => step.toolId === toolCall.metadata?.toolId || step.toolId === toolCall.id) ?? steps[index];
    if (matchingStep) addEdge(edges, executionNodeId('STEP', matchingStep.id), toolNode.id, 'USES_TOOL', matchingStep.name);
    addEdge(edges, runNode.id, toolNode.id, 'USES_TOOL', 'runtime tool call');
  });

  const firstStep = steps.find((step) => step.expectedOutputType === 'artifact') ?? steps[0];
  const firstTool = toolCalls.find((toolCall) => toolCall.status === 'completed') ?? toolCalls[0];
  const firstApproval = approvals[0];
  artifacts.forEach((artifact) => {
    enrichArtifactLineage(artifact, {
      agentId: run.agentId,
      ticketId: run.ticketId,
      planId: plan?.id,
      stepId: artifact.metadata.stepId ?? firstStep?.id,
      approvalId: artifact.metadata.approvalId ?? firstApproval?.id,
    });
    const artifactNode = node('ARTIFACT', artifact.id, artifact.name, artifact.lifecycle, {
      type: artifact.type,
      source: artifact.metadata.source,
      toolId: artifact.metadata.toolId ?? firstTool?.id,
    });
    addNode(nodes, artifactNode);
    addEdge(edges, runNode.id, artifactNode.id, 'PRODUCES', 'produces artifact');
    const sourceToolId = artifact.metadata.toolId ?? firstTool?.id;
    if (sourceToolId) addEdge(edges, executionNodeId('TOOL_CALL', sourceToolId), artifactNode.id, 'PRODUCES', 'generated by tool');
  });

  approvals.forEach((approval) => {
    const approvalNode = node('APPROVAL', approval.id, approval.title, approval.status, { severity: approval.severity, policy: approval.policy });
    addNode(nodes, approvalNode);
    addEdge(edges, runNode.id, approvalNode.id, 'REQUIRES_APPROVAL', approval.policy);
    if (approval.toolId) addEdge(edges, executionNodeId('TOOL_CALL', approval.toolId), approvalNode.id, 'REQUIRES_APPROVAL', 'originating tool');
    if (approval.status === 'approved') addEdge(edges, approvalNode.id, runNode.id, 'APPROVED_BY', 'approved runtime');
  });

  usage.forEach((record) => {
    const usageNode = node('USAGE', record.id, `${record.type}: ${record.quantity} ${record.unit}`, record.currency, { actualCost: record.actualCost, estimatedCost: record.estimatedCost });
    addNode(nodes, usageNode);
    addEdge(edges, record.toolId ? executionNodeId('TOOL_CALL', record.toolId) : runNode.id, usageNode.id, 'BILLED_AS', record.type);
  });

  const costNode = node('COST', `${run.id}-ledger`, `Cost $${ledger.actualTotal.toFixed(3)}`, ledger.status, { estimatedTotal: ledger.estimatedTotal, variance: ledger.variance });
  addNode(nodes, costNode);
  addEdge(edges, runNode.id, costNode.id, 'BILLED_AS', 'billing ledger');

  governanceReports.forEach((report) => {
    const governanceNode = node('GOVERNANCE_DECISION', report.id, report.finalDecision, report.finalDecision, { targetId: report.targetId, action: report.action });
    addNode(nodes, governanceNode);
    addEdge(edges, executionNodeId(report.targetType === 'plan' ? 'PLAN' : 'RUN', report.targetId), governanceNode.id, report.finalDecision === 'ALLOW' ? 'APPROVED_BY' : 'BLOCKED_BY', report.action);
  });

  blockedRuns.forEach((block) => {
    const errorNode = node('ERROR', block.id, block.reasons[0] ?? block.runtimeAction, 'blocked', { decision: block.decision, runtimeAction: block.runtimeAction });
    addNode(nodes, errorNode);
    addEdge(edges, runNode.id, errorNode.id, 'BLOCKED_BY', block.runtimeAction);
  });

  if (run.status === 'failed' || runLifecycle === 'FAILED') {
    const errorNode = node('ERROR', `${run.id}-failed`, 'Run failed', 'failed', { currentStep: run.currentStep });
    addNode(nodes, errorNode);
    addEdge(edges, runNode.id, errorNode.id, 'FAILED_AT', run.currentStep);
  }

  const graphNodes = [...nodes.values()];
  const graphEdges = [...edges.values()];
  const graph: AgentExecutionGraph = {
    id: `execution-graph-run-${run.id}`,
    workspaceId,
    runId: run.id,
    agentId: run.agentId,
    ticketId: run.ticketId,
    nodes: graphNodes,
    edges: graphEdges,
    summary: graphSummary(workspaceId, [{ id: '', workspaceId, nodes: graphNodes, edges: graphEdges, summary: { actualCost: ledger.actualTotal } as ExecutionGraphSummary, generatedAt: new Date().toISOString() } as AgentExecutionGraph]),
    generatedAt: new Date().toISOString(),
  };
  return persistGraph(graph);
}

export function buildExecutionGraphForAgent(agentId: string): AgentExecutionGraph {
  const data = getWorkflowData();
  const runs = [...data.runs, ...getRuns()].filter((run) => run.agentId === agentId);
  const graphs = runs.map((run) => buildExecutionGraphForRun(run.id));
  const nodes = new Map<string, ExecutionGraphNode>();
  const edges = new Map<string, ExecutionGraphEdge>();
  graphs.flatMap((graph) => graph.nodes).forEach((item) => addNode(nodes, item));
  graphs.flatMap((graph) => graph.edges).forEach((item) => edges.set(item.id, item));
  return persistGraph({
    id: `execution-graph-agent-${agentId}`,
    workspaceId: data.workspace.id,
    agentId,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    summary: graphSummary(data.workspace.id, graphs),
    generatedAt: new Date().toISOString(),
  });
}

export function buildExecutionGraphForTicket(ticketId: string): AgentExecutionGraph {
  const data = getWorkflowData();
  const runs = [...data.runs, ...getRuns()].filter((run) => run.ticketId === ticketId);
  const graphs = runs.map((run) => buildExecutionGraphForRun(run.id));
  const nodes = new Map<string, ExecutionGraphNode>();
  const edges = new Map<string, ExecutionGraphEdge>();
  graphs.flatMap((graph) => graph.nodes).forEach((item) => addNode(nodes, item));
  graphs.flatMap((graph) => graph.edges).forEach((item) => edges.set(item.id, item));
  return persistGraph({
    id: `execution-graph-ticket-${ticketId}`,
    workspaceId: data.workspace.id,
    ticketId,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    summary: graphSummary(data.workspace.id, graphs),
    generatedAt: new Date().toISOString(),
  });
}

export function getExecutionGraph(graphId: string): AgentExecutionGraph | undefined {
  const graph = readState().graphs[graphId];
  return graph ? clone(graph) : undefined;
}

export function getExecutionTrace(runId = DEMO_RUN_ID): ExecutionGraphTrace {
  const graph = getExecutionGraph(`execution-graph-run-${runId}`) ?? buildExecutionGraphForRun(runId);
  const rank: Record<ExecutionGraphNodeType, number> = {
    AGENT: 1,
    PLAN: 2,
    STEP: 3,
    RUN: 4,
    TOOL_CALL: 5,
    ARTIFACT: 6,
    APPROVAL: 7,
    GOVERNANCE_DECISION: 8,
    USAGE: 9,
    COST: 10,
    ERROR: 11,
  };
  const orderedNodes = [...graph.nodes].sort((a, b) => (rank[a.type] - rank[b.type]) || a.label.localeCompare(b.label));
  return {
    id: `execution-trace-${runId}`,
    runId,
    graphId: graph.id,
    orderedNodes,
    artifactLineage: orderedNodes.filter((item) => item.type === 'ARTIFACT' || graph.edges.some((edge) => edge.target === item.id && edge.type === 'PRODUCES')),
    approvalLineage: orderedNodes.filter((item) => item.type === 'APPROVAL' || graph.edges.some((edge) => edge.target === item.id && edge.type === 'REQUIRES_APPROVAL')),
    blockedNodes: orderedNodes.filter((item) => item.type === 'ERROR' || item.status?.toLowerCase().includes('blocked')),
    generatedAt: new Date().toISOString(),
  };
}

export function getGraphSummary(workspaceId = demoWorkspace.id): ExecutionGraphSummary {
  const graphs = Object.values(readState().graphs).filter((graph) => graph.workspaceId === workspaceId);
  return graphSummary(workspaceId, graphs);
}

export function getBlockedGraphNodes(runId = DEMO_RUN_ID): ExecutionGraphNode[] {
  const graph = getExecutionGraph(`execution-graph-run-${runId}`) ?? buildExecutionGraphForRun(runId);
  return graph.nodes.filter((item) => (
    item.type === 'ERROR'
    || item.status?.toLowerCase().includes('blocked')
    || (item.type === 'GOVERNANCE_DECISION' && item.status !== 'ALLOW')
  ));
}

export function getArtifactLineage(runId = DEMO_RUN_ID): ExecutionGraphNode[] {
  return getExecutionTrace(runId).artifactLineage;
}

export function getApprovalLineage(runId = DEMO_RUN_ID): ExecutionGraphNode[] {
  return getExecutionTrace(runId).approvalLineage;
}

export function exportExecutionGraphJson(runId = DEMO_RUN_ID): string {
  return JSON.stringify(buildExecutionGraphForRun(runId), null, 2);
}

export function exportExecutionTraceMarkdown(runId = DEMO_RUN_ID): string {
  const trace = getExecutionTrace(runId);
  const rows = trace.orderedNodes.map((item) => `| ${item.type} | ${item.label} | ${item.status ?? '-'} |`);
  return ['# Execution Trace', '', `Run: ${runId}`, '', '| Type | Node | Status |', '|---|---|---|', ...rows, ''].join('\n');
}

export function exportArtifactLineageMarkdown(runId = DEMO_RUN_ID): string {
  const rows = getArtifactLineage(runId).map((item) => `| ${item.type} | ${item.label} | ${item.entityId} |`);
  return ['# Artifact Lineage', '', `Run: ${runId}`, '', '| Type | Node | Entity |', '|---|---|---|', ...rows, ''].join('\n');
}

export function exportApprovalLineageMarkdown(runId = DEMO_RUN_ID): string {
  const rows = getApprovalLineage(runId).map((item) => `| ${item.type} | ${item.label} | ${item.status ?? '-'} |`);
  return ['# Approval Lineage', '', `Run: ${runId}`, '', '| Type | Node | Status |', '|---|---|---|', ...rows, ''].join('\n');
}

function exportArtifact(id: string, runId: string, name: string, contentText: string, type: Artifact['type'] = 'report'): Artifact {
  return {
    id,
    runId,
    type,
    name,
    source: 'mock',
    contentSummary: `Execution graph export for ${runId}`,
    contentText,
    createdAt: new Date().toISOString(),
  };
}

export function registerExecutionGraphExports(runId = DEMO_RUN_ID): ArtifactRecord[] {
  buildExecutionGraphForRun(runId);
  const exports = [
    exportArtifact(`artifact-${runId}-execution-graph-json`, runId, 'execution-graph.json', exportExecutionGraphJson(runId), 'json'),
    exportArtifact(`artifact-${runId}-execution-trace-md`, runId, 'execution-trace.md', exportExecutionTraceMarkdown(runId), 'markdown'),
    exportArtifact(`artifact-${runId}-artifact-lineage-md`, runId, 'artifact-lineage.md', exportArtifactLineageMarkdown(runId), 'markdown'),
    exportArtifact(`artifact-${runId}-approval-lineage-md`, runId, 'approval-lineage.md', exportApprovalLineageMarkdown(runId), 'markdown'),
  ];
  return exports.map((artifact) => registerArtifact(artifact, { type: 'EXPORT', metadata: { runId, tags: ['execution-graph', 'export'] } }));
}

export function clearExecutionGraphStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(GRAPH_STORAGE_KEY);
}
