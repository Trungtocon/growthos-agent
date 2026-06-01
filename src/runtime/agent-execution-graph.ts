export type ExecutionGraphNodeType =
  | 'AGENT'
  | 'RUN'
  | 'PLAN'
  | 'STEP'
  | 'TOOL_CALL'
  | 'ARTIFACT'
  | 'APPROVAL'
  | 'GOVERNANCE_DECISION'
  | 'USAGE'
  | 'COST'
  | 'ERROR';

export type ExecutionGraphEdgeType =
  | 'CREATED'
  | 'EXECUTES'
  | 'USES_TOOL'
  | 'PRODUCES'
  | 'REQUIRES_APPROVAL'
  | 'APPROVED_BY'
  | 'BLOCKED_BY'
  | 'BILLED_AS'
  | 'FAILED_AT';

export interface ExecutionGraphNode {
  id: string;
  type: ExecutionGraphNodeType;
  label: string;
  entityId: string;
  status?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionGraphEdge {
  id: string;
  source: string;
  target: string;
  type: ExecutionGraphEdgeType;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionGraphSummary {
  workspaceId: string;
  graphCount: number;
  nodeCount: number;
  edgeCount: number;
  runCount: number;
  artifactCount: number;
  approvalCount: number;
  blockedNodeCount: number;
  failedNodeCount: number;
  usageRecordCount: number;
  actualCost: number;
  generatedAt: string;
}

export interface AgentExecutionGraph {
  id: string;
  workspaceId: string;
  runId?: string;
  agentId?: string;
  ticketId?: string;
  nodes: ExecutionGraphNode[];
  edges: ExecutionGraphEdge[];
  summary: ExecutionGraphSummary;
  generatedAt: string;
}

export interface ExecutionGraphTrace {
  id: string;
  runId: string;
  graphId: string;
  orderedNodes: ExecutionGraphNode[];
  artifactLineage: ExecutionGraphNode[];
  approvalLineage: ExecutionGraphNode[];
  blockedNodes: ExecutionGraphNode[];
  generatedAt: string;
}

export function executionNodeId(type: ExecutionGraphNodeType, entityId: string): string {
  return `${type.toLowerCase()}:${entityId}`;
}

export function executionEdgeId(source: string, target: string, type: ExecutionGraphEdgeType): string {
  return `${source}->${type.toLowerCase()}->${target}`;
}
