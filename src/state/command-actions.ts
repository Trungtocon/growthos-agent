import { demoCurrentUser } from '../data/demo-fixtures';
import type { ApprovalStatus, Ticket } from '../domain/types';
import { sendApprovalDecision, sendRunCommand, sendTicketAssignment, sendTicketCommand } from './async-actions';
import { runWorkflowCommand } from './workflow-engine';
import type { WorkflowData } from './workflow-engine';

function withApprovalDecision(data: WorkflowData, approvalId: string, status: ApprovalStatus): WorkflowData {
  const decidedAt = new Date().toISOString();
  return {
    ...data,
    approvals: data.approvals.map((approval) => approval.id !== approvalId ? approval : {
      ...approval,
      status,
      decision: {
        decidedAt,
        decidedBy: demoCurrentUser.id,
        outcome: status === 'approved' ? 'approved' : 'rejected',
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
    }),
  };
}

function ticketWithStatus(ticket: Ticket, patch: Partial<Ticket>): Ticket {
  return { ...ticket, ...patch, updatedAt: new Date().toISOString() };
}

export async function approveApproval(approvalId: string) {
  return runWorkflowCommand({
    command: 'approveApproval',
    entityType: 'approval',
    entityId: approvalId,
    actorId: demoCurrentUser.id,
    title: 'Approval approved',
    optimistic: (data) => withApprovalDecision(data, approvalId, 'approved'),
    mutate: () => sendApprovalDecision(approvalId, 'approved'),
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
    mutate: () => sendApprovalDecision(approvalId, 'rejected'),
  });
}

export async function retryRun(runId: string) {
  return runWorkflowCommand({
    command: 'retryRun',
    entityType: 'run',
    entityId: runId,
    actorId: demoCurrentUser.id,
    title: 'Run retry requested',
    optimistic: (data) => ({
      ...data,
      runs: data.runs.map((run) => run.id !== runId ? run : { ...run, status: 'running', currentStep: 'Retrying last checkpoint' }),
    }),
    mutate: () => sendRunCommand(runId, 'retryRun'),
  });
}

export async function pauseRun(runId: string) {
  return runWorkflowCommand({
    command: 'pauseRun',
    entityType: 'run',
    entityId: runId,
    actorId: demoCurrentUser.id,
    title: 'Run paused',
    optimistic: (data) => ({
      ...data,
      runs: data.runs.map((run) => run.id !== runId ? run : { ...run, status: 'paused', currentStep: 'Paused at checkpoint' }),
    }),
    mutate: () => sendRunCommand(runId, 'pauseRun'),
  });
}

export async function resumeRun(runId: string) {
  return runWorkflowCommand({
    command: 'resumeRun',
    entityType: 'run',
    entityId: runId,
    actorId: demoCurrentUser.id,
    title: 'Run resumed',
    optimistic: (data) => ({
      ...data,
      runs: data.runs.map((run) => run.id !== runId ? run : { ...run, status: 'running', currentStep: 'Continuing from checkpoint' }),
    }),
    mutate: () => sendRunCommand(runId, 'resumeRun'),
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
