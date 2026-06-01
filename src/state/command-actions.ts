import { demoCurrentUser } from '../data/demo-fixtures';
import type { ApprovalStatus, Ticket } from '../domain/types';
import {
  approveApprovalExecutionRequest as approveRuntimeApprovalExecutionRequest,
  approveRunPlan as approveRuntimeRunPlan,
  cancelAgentRun as createCancelAgentRunPlan,
  cancelRejectedApprovalExecution as cancelRuntimeRejectedApprovalExecution,
  createPlanForTicket as createRuntimePlanForTicket,
  escalateApprovalExecutionRequest as escalateRuntimeApprovalExecutionRequest,
  pauseAgentRun as createPauseAgentRunPlan,
  refreshHermesDiscovery as refreshRuntimeHermesDiscovery,
  rejectApprovalExecutionRequest as rejectRuntimeApprovalExecutionRequest,
  requestApprovalExecutionChanges as requestRuntimeApprovalExecutionChanges,
  resumeAgentRun as createResumeAgentRunPlan,
  resumeApprovedApprovalExecution as resumeRuntimeApprovedApprovalExecution,
  retryAgentRun as createRetryAgentRunPlan,
  startAgentRun as createStartAgentRunPlan,
  startRunFromPlan as startRuntimeRunFromPlan,
  completeStreamingRun as completeRuntimeStreamingRun,
  nextStreamTick as advanceRuntimeStreamTick,
  startStreamingRun as startRuntimeStreamingRun,
} from '../integrations/growthos-runtime/runtime-orchestrator';
import { canApprovePlan, canCancelRun, canStartRun } from '../runtime/rbac-store';
import { sendApprovalDecision, sendRunCommand, sendStartAgentRun, sendTicketAssignment, sendTicketCommand } from './async-actions';
import { runWorkflowCommand } from './workflow-engine';
import type { WorkflowData } from './workflow-engine';

function withApprovalDecision(data: WorkflowData, approvalId: string, status: ApprovalStatus): WorkflowData {
  const decidedAt = new Date().toISOString();
  const approvals = data.approvals.map((approval) => {
    if (approval.id !== approvalId) return approval;
    const outcome: Exclude<ApprovalStatus, 'pending'> = status === 'approved'
      ? 'approved'
      : status === 'rejected'
        ? 'rejected'
        : 'changes_requested';
    const nextApproval = {
      ...approval,
      status,
      decision: {
        decidedAt,
        decidedBy: demoCurrentUser.id,
        outcome,
        note: 'Optimistic demo workflow decision.',
      },
      auditTrail: [
        ...approval.auditTrail,
        {
          id: `audit-${approval.id}-${status}`,
          actorId: demoCurrentUser.id,
          action: status === 'approved' ? 'approved once' : 'rejected request',
          createdAt: decidedAt,
        },
      ],
    };
    return nextApproval;
  });
  return {
    ...data,
    approvals,
  };
}

function ticketWithStatus(ticket: Ticket, patch: Partial<Ticket>): Ticket {
  return { ...ticket, ...patch, updatedAt: new Date().toISOString() };
}

function assertAllowed(decision: { allowed: boolean; reason: string }) {
  if (!decision.allowed) throw new Error(`Authorization denied: ${decision.reason}`);
}

export async function approveApproval(approvalId: string) {
  return runWorkflowCommand({
    command: 'approveApproval',
    entityType: 'approval',
    entityId: approvalId,
    actorId: demoCurrentUser.id,
    title: 'Approval approved',
    optimistic: (data) => withApprovalDecision(data, approvalId, 'approved'),
    mutate: () => {
      assertAllowed(canApprovePlan(approvalId));
      return sendApprovalDecision(approvalId, 'approved');
    },
  });
}

export async function rejectApproval(approvalId: string) {
  return runWorkflowCommand({
    command: 'rejectApproval',
    entityType: 'approval',
    entityId: approvalId,
    actorId: demoCurrentUser.id,
    title: 'Approval rejected',
    optimistic: (data) => withApprovalDecision(data, approvalId, 'rejected'),
    mutate: () => {
      assertAllowed(canApprovePlan(approvalId));
      return sendApprovalDecision(approvalId, 'rejected');
    },
  });
}

export async function approveApprovalExecution(requestId: string) {
  return runWorkflowCommand({
    command: 'approval.approve',
    entityType: 'approval',
    entityId: requestId,
    actorId: demoCurrentUser.id,
    title: 'Approval execution approved',
    optimistic: (data) => data,
    mutate: async () => {
      approveRuntimeApprovalExecutionRequest(requestId);
      resumeRuntimeApprovedApprovalExecution(requestId);
    },
  });
}

export async function rejectApprovalExecution(requestId: string) {
  return runWorkflowCommand({
    command: 'approval.reject',
    entityType: 'approval',
    entityId: requestId,
    actorId: demoCurrentUser.id,
    title: 'Approval execution rejected',
    optimistic: (data) => data,
    mutate: async () => {
      rejectRuntimeApprovalExecutionRequest(requestId);
      cancelRuntimeRejectedApprovalExecution(requestId);
    },
  });
}

export async function requestApprovalExecutionChanges(requestId: string) {
  return runWorkflowCommand({
    command: 'approval.request_changes',
    entityType: 'approval',
    entityId: requestId,
    actorId: demoCurrentUser.id,
    title: 'Approval execution changes requested',
    optimistic: (data) => data,
    mutate: async () => {
      requestRuntimeApprovalExecutionChanges(requestId);
    },
  });
}

export async function escalateApprovalExecution(requestId: string) {
  return runWorkflowCommand({
    command: 'approval.escalate',
    entityType: 'approval',
    entityId: requestId,
    actorId: demoCurrentUser.id,
    title: 'Approval execution escalated',
    optimistic: (data) => data,
    mutate: async () => {
      escalateRuntimeApprovalExecutionRequest(requestId);
    },
  });
}

export async function retryRun(runId: string) {
  const plan = createRetryAgentRunPlan(runId);
  return runWorkflowCommand({
    command: 'retryRun',
    entityType: 'run',
    entityId: runId,
    actorId: demoCurrentUser.id,
    title: 'Run retry requested',
    optimistic: plan.applyOptimistic,
    mutate: () => sendRunCommand(runId, 'retryRun'),
  });
}

export async function pauseRun(runId: string) {
  const plan = createPauseAgentRunPlan(runId);
  return runWorkflowCommand({
    command: 'pauseRun',
    entityType: 'run',
    entityId: runId,
    actorId: demoCurrentUser.id,
    title: 'Run paused',
    optimistic: plan.applyOptimistic,
    mutate: () => sendRunCommand(runId, 'pauseRun'),
  });
}

export async function resumeRun(runId: string) {
  const plan = createResumeAgentRunPlan(runId);
  return runWorkflowCommand({
    command: 'resumeRun',
    entityType: 'run',
    entityId: runId,
    actorId: demoCurrentUser.id,
    title: 'Run resumed',
    optimistic: plan.applyOptimistic,
    mutate: () => sendRunCommand(runId, 'resumeRun'),
  });
}

export async function startAgentRun(ticketId: string) {
  const plan = createStartAgentRunPlan(ticketId);
  return runWorkflowCommand({
    command: 'startAgentRun',
    entityType: 'ticket',
    entityId: ticketId,
    actorId: demoCurrentUser.id,
    title: 'Hermes run started',
    optimistic: plan.applyOptimistic,
    mutate: () => {
      assertAllowed(canStartRun(ticketId));
      return sendStartAgentRun(ticketId);
    },
  });
}

export async function startStreamingRun(ticketId: string) {
  return runWorkflowCommand({
    command: 'startStreamingRun',
    entityType: 'ticket',
    entityId: ticketId,
    actorId: demoCurrentUser.id,
    title: 'Live Hermes stream started',
    optimistic: (data) => data,
    mutate: async () => {
      assertAllowed(canStartRun(ticketId));
      await startRuntimeStreamingRun(ticketId);
    },
  });
}

export async function createRunPlan(ticketId: string, workflowId = 'demo-run-execution') {
  return runWorkflowCommand({
    command: 'createRunPlan',
    entityType: 'ticket',
    entityId: ticketId,
    actorId: demoCurrentUser.id,
    title: `Run plan requested: ${workflowId}`,
    optimistic: (data) => data,
    mutate: async () => {
      createRuntimePlanForTicket(ticketId, workflowId);
    },
  });
}

export async function approveRunPlan(planId: string) {
  return runWorkflowCommand({
    command: 'approveRunPlan',
    entityType: 'run',
    entityId: planId,
    actorId: demoCurrentUser.id,
    title: 'Run plan approved',
    optimistic: (data) => data,
    mutate: async () => {
      approveRuntimeRunPlan(planId);
    },
  });
}

export async function startRunFromPlan(planId: string) {
  return runWorkflowCommand({
    command: 'startRunFromPlan',
    entityType: 'run',
    entityId: planId,
    actorId: demoCurrentUser.id,
    title: 'Run started from plan',
    optimistic: (data) => data,
    mutate: async () => {
      await startRuntimeRunFromPlan(planId);
    },
  });
}

export async function advanceStreamingRun(runId: string) {
  return runWorkflowCommand({
    command: 'tool.progress',
    entityType: 'run',
    entityId: runId,
    actorId: demoCurrentUser.id,
    title: 'Live Hermes stream advanced',
    optimistic: (data) => data,
    mutate: async () => {
      await advanceRuntimeStreamTick(runId);
    },
  });
}

export async function completeStreamingRun(runId: string) {
  return runWorkflowCommand({
    command: 'run.completed',
    entityType: 'run',
    entityId: runId,
    actorId: demoCurrentUser.id,
    title: 'Live Hermes stream completed',
    optimistic: (data) => data,
    mutate: async () => {
      await completeRuntimeStreamingRun(runId);
    },
  });
}

export async function refreshRuntimeDiscovery() {
  return runWorkflowCommand({
    command: 'refreshHermesDiscovery',
    entityType: 'run',
    entityId: 'runtime-discovery',
    actorId: demoCurrentUser.id,
    title: 'Hermes discovery refreshed',
    optimistic: (data) => data,
    mutate: async () => {
      await refreshRuntimeHermesDiscovery();
    },
  });
}

export async function cancelAgentRun(runId: string) {
  const plan = createCancelAgentRunPlan(runId);
  return runWorkflowCommand({
    command: 'cancelAgentRun',
    entityType: 'run',
    entityId: runId,
    actorId: demoCurrentUser.id,
    title: 'Run cancelled',
    optimistic: plan.applyOptimistic,
    mutate: () => {
      assertAllowed(canCancelRun(runId));
      return sendRunCommand(runId, 'cancelAgentRun');
    },
  });
}

export async function assignTicket(ticketId: string, agentId = 'agent-research') {
  return runWorkflowCommand({
    command: 'assignTicket',
    entityType: 'ticket',
    entityId: ticketId,
    actorId: demoCurrentUser.id,
    title: 'Ticket assigned',
    optimistic: (data) => ({
      ...data,
      agents: data.agents.map((agent) => {
        if (agent.currentTicketIds.includes(ticketId) && agent.id !== agentId) {
          return { ...agent, currentTicketIds: agent.currentTicketIds.filter((id) => id !== ticketId) };
        }
        if (agent.id === agentId && !agent.currentTicketIds.includes(ticketId)) {
          return { ...agent, currentTicketIds: [...agent.currentTicketIds, ticketId] };
        }
        return agent;
      }),
      tickets: data.tickets.map((ticket) => ticket.id !== ticketId ? ticket : ticketWithStatus(ticket, { ownerAgentId: agentId })),
    }),
    mutate: () => sendTicketAssignment(ticketId, agentId),
  });
}

export async function escalateTicket(ticketId: string) {
  return runWorkflowCommand({
    command: 'escalateTicket',
    entityType: 'ticket',
    entityId: ticketId,
    actorId: demoCurrentUser.id,
    title: 'Ticket escalated',
    optimistic: (data) => ({
      ...data,
      tickets: data.tickets.map((ticket) => ticket.id !== ticketId ? ticket : ticketWithStatus(ticket, { priority: 'critical', riskLevel: 'high' })),
    }),
    mutate: () => sendTicketCommand(ticketId, 'escalateTicket'),
  });
}

export async function resolveTicket(ticketId: string) {
  return runWorkflowCommand({
    command: 'resolveTicket',
    entityType: 'ticket',
    entityId: ticketId,
    actorId: demoCurrentUser.id,
    title: 'Ticket resolved',
    optimistic: (data) => ({
      ...data,
      tickets: data.tickets.map((ticket) => ticket.id !== ticketId ? ticket : ticketWithStatus(ticket, { status: 'done' })),
      runs: data.runs.map((run) => run.ticketId !== ticketId ? run : { ...run, status: 'success', currentStep: 'Completed', finishedAt: new Date().toISOString() }),
    }),
    mutate: () => sendTicketCommand(ticketId, 'resolveTicket'),
  });
}

export async function approveRunAction(approvalId: string) {
  return approveApproval(approvalId);
}

export async function rejectRunAction(approvalId: string) {
  return rejectApproval(approvalId);
}
