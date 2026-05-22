import {
  mutateApprovalDecision,
  mutateRunCommand,
  mutateTicketAssignment,
  mutateTicketCommand,
} from '../services/demo-api';

export async function sendApprovalDecision(approvalId: string, outcome: 'approved' | 'rejected') {
  await mutateApprovalDecision(approvalId, outcome);
}

export async function sendRunCommand(runId: string, command: 'retryRun' | 'pauseRun' | 'resumeRun') {
  await mutateRunCommand(runId, command);
}

export async function sendTicketAssignment(ticketId: string, agentId: string) {
  await mutateTicketAssignment(ticketId, agentId);
}

export async function sendTicketCommand(ticketId: string, command: 'escalateTicket' | 'resolveTicket') {
  await mutateTicketCommand(ticketId, command);
}
