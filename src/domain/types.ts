export type WorkspacePlan = 'demo' | 'growth' | 'enterprise';
export type UserRole = 'owner' | 'operator' | 'reviewer';
export type AgentStatus = 'active' | 'running' | 'busy' | 'waiting' | 'idle' | 'failed' | 'paused';
export type TicketStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked' | 'failed';
export type RunStatus = 'queued' | 'running' | 'success' | 'warning' | 'failed' | 'paused';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type ActivityStatus = 'success' | 'running' | 'warning' | 'failed';
export type ActivityType = 'agent' | 'ticket' | 'run' | 'approval' | 'goal' | 'cost';
export type MetricTone = 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'slate';
export type TrendDirection = 'up' | 'down' | 'flat';
export type ArtifactType = 'document' | 'log' | 'screenshot' | 'archive' | 'report';
export type ToolCallStatus = 'success' | 'running' | 'warning' | 'failed';

export interface Workspace {
  id: string;
  name: string;
  plan: WorkspacePlan;
  aiBudgetMonthly: number;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  healthScore: number;
  trustScore: number;
  outputQuality: number;
  costEfficiency: number;
  policyCompliance: number;
  skills: string[];
  tools: string[];
  memorySummary: string;
  currentTicketIds: string[];
  currentRunIds: string[];
  costMonthToDate: number;
  successRate: number;
  riskLevel: RiskLevel;
}

export interface Ticket {
  id: string;
  code: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  riskLevel: RiskLevel;
  ownerAgentId: string;
  requesterId: string;
  relatedGoalId?: string;
  runId?: string;
  approvalId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
  acceptanceCriteria: string[];
}

export interface RunStep {
  id: string;
  name: string;
  status: RunStatus;
  startedAt: string;
  durationSeconds: number;
  cost: number;
}

export interface RunLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface Run {
  id: string;
  ticketId: string;
  agentId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  elapsedSeconds: number;
  currentStep: string;
  steps: RunStep[];
  toolCalls: ToolCall[];
  logs: RunLog[];
  artifacts: Artifact[];
  cost: number;
  riskLevel: RiskLevel;
}

export interface ApprovalDecision {
  decidedAt: string;
  decidedBy: string;
  outcome: Exclude<ApprovalStatus, 'pending'>;
  note: string;
}

export interface ApprovalAuditEntry {
  id: string;
  actorId: string;
  action: string;
  createdAt: string;
}

export interface Approval {
  id: string;
  ticketId: string;
  runId?: string;
  agentId: string;
  title: string;
  description: string;
  status: ApprovalStatus;
  severity: Severity;
  requestedAt: string;
  requestedBy: string;
  policy: string;
  decision?: ApprovalDecision;
  auditTrail: ApprovalAuditEntry[];
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  progress: number;
  ownerId: string;
  dueAt: string;
  linkedTicketIds: string[];
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  actorAgentId?: string;
  relatedTicketId?: string;
  relatedRunId?: string;
  createdAt: string;
  status: ActivityStatus;
}

export interface MetricTrend {
  direction: TrendDirection;
  value: string;
}

export interface Metric {
  id: string;
  label: string;
  value: string;
  unit?: string;
  trend: MetricTrend;
  tone: MetricTone;
}

export interface CostBreakdownItem {
  id: string;
  label: string;
  value: number;
  percent: number;
}

export interface CostBreakdown {
  total: number;
  byAgent: CostBreakdownItem[];
  byTool: CostBreakdownItem[];
  period: string;
}

export interface Artifact {
  id: string;
  runId: string;
  type: ArtifactType;
  name: string;
  url?: string;
  contentSummary?: string;
  source?: 'paperclip' | 'hermes' | 'mock';
  createdAt: string;
}

export interface ToolCall {
  id: string;
  toolName: string;
  status: ToolCallStatus;
  inputSummary: string;
  outputSummary: string;
  durationMs: number;
  cost: number;
  startedAt?: string;
  finishedAt?: string;
}
