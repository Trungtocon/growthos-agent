import {
  approveRunAction,
  cancelAgentRun,
  pauseAgentRun,
  rejectRunAction,
  resumeAgentRun,
  retryAgentRun,
  startAgentRun,
} from '../integrations/growthos-runtime/runtime-orchestrator';
import {
  mutateTicketAssignment,
  mutateTicketCommand,
} from '../services/demo-api';

function consumeLegacyMockFailure(command: 'approveApproval' | 'rejectApproval') {
  if (typeof window === 'undefined') return false;
  const storageKey = 'uikigai-demo-fail-next-command';
  const failure = window.sessionStorage.getItem(storageKey);
  if (failure !== command) return false;
  window.sessionStorage.removeItem(storageKey);
  return true;
}

export async function sendApprovalDecision(approvalId: string, outcome: 'approved' | 'rejected') {
  const legacyCommand = outcome === 'approved' ? 'approveApproval' : 'rejectApproval';
  if (consumeLegacyMockFailure(legacyCommand)) {
    throw new Error(`Mock API rejected ${legacyCommand}`);
  }
  const plan = outcome === 'approved' ? approveRunAction(approvalId) : rejectRunAction(approvalId);
  await plan.commit();
}

export async function sendStartAgentRun(ticketId: string) {
  await startAgentRun(ticketId).commit();
}

export async function sendRunCommand(runId: string, command: 'retryRun' | 'pauseRun' | 'resumeRun' | 'cancelAgentRun') {
  const plan = command === 'retryRun'
    ? retryAgentRun(runId)
    : command === 'pauseRun'
      ? pauseAgentRun(runId)
      : command === 'resumeRun'
        ? resumeAgentRun(runId)
        : cancelAgentRun(runId);
  await plan.commit();
}

export async function sendTicketAssignment(ticketId: string, agentId: string) {
  await mutateTicketAssignment(ticketId, agentId);
}

export async function sendTicketCommand(ticketId: string, command: 'escalateTicket' | 'resolveTicket') {
  await mutateTicketCommand(ticketId, command);
}
