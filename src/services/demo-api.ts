import {
  DEMO_AGENT_ID,
  DEMO_APPROVAL_ID,
  DEMO_RUN_ID,
  DEMO_TICKET_ID,
  demoAgents,
  demoApprovals,
  demoCostBreakdown,
  demoCurrentUser,
  demoRuns,
  demoTickets,
  demoWorkspace,
} from '../data/demo-fixtures';
import {
  getRecentActivities as selectRecentActivities,
  selectAgentDetailViewModel,
  selectApprovalCenterViewModel,
  selectCommandCenterViewModel,
  selectOrgChartViewModel,
  selectRunConsoleViewModel,
  selectTicketDetailViewModel,
  selectTicketsBoardViewModel,
  selectWorkforceViewModel,
} from '../domain/selectors';

export async function getWorkspace() {
  return Promise.resolve(demoWorkspace);
}

export async function getCurrentUser() {
  return Promise.resolve(demoCurrentUser);
}

export async function getCommandCenterSummary() {
  return Promise.resolve(selectCommandCenterViewModel());
}

export async function getWorkforceOverview() {
  return Promise.resolve(selectWorkforceViewModel());
}

export async function getOrgChart() {
  return Promise.resolve(selectOrgChartViewModel());
}

export async function getAgentById(agentId: string) {
  return Promise.resolve(demoAgents.find((agent) => agent.id === agentId) ?? null);
}

export async function getDemoAgent() {
  return Promise.resolve(selectAgentDetailViewModel(DEMO_AGENT_ID));
}

export async function getTicketsBoard() {
  return Promise.resolve(selectTicketsBoardViewModel());
}

export async function getTicketById(ticketId: string) {
  return Promise.resolve(demoTickets.find((ticket) => ticket.id === ticketId) ?? null);
}

export async function getDemoTicket() {
  return Promise.resolve(selectTicketDetailViewModel(DEMO_TICKET_ID));
}

export async function getRunById(runId: string) {
  return Promise.resolve(demoRuns.find((run) => run.id === runId) ?? null);
}

export async function getDemoRun() {
  return Promise.resolve(selectRunConsoleViewModel(DEMO_RUN_ID));
}

export async function getApprovals() {
  return Promise.resolve(selectApprovalCenterViewModel());
}

export async function getApprovalById(approvalId: string = DEMO_APPROVAL_ID) {
  return Promise.resolve(demoApprovals.find((approval) => approval.id === approvalId) ?? null);
}

export async function getRecentActivities() {
  return Promise.resolve(selectRecentActivities());
}

export async function getCostBreakdown() {
  return Promise.resolve(demoCostBreakdown);
}

type DemoMutationCommand =
  | 'approveApproval'
  | 'rejectApproval'
  | 'retryRun'
  | 'pauseRun'
  | 'resumeRun'
  | 'assignTicket'
  | 'escalateTicket'
  | 'resolveTicket';

function consumeMockFailure(command: DemoMutationCommand) {
  if (typeof window === 'undefined') return false;
  const storageKey = 'uikigai-demo-fail-next-command';
  const failure = window.sessionStorage.getItem(storageKey);
  if (failure !== command) return false;
  window.sessionStorage.removeItem(storageKey);
  return true;
}

async function simulateMutation(command: DemoMutationCommand) {
  await new Promise((resolve) => setTimeout(resolve, 180));
  if (consumeMockFailure(command)) {
    throw new Error(`Mock API rejected ${command}`);
  }
}

export async function mutateApprovalDecision(_approvalId: string, outcome: 'approved' | 'rejected') {
  return simulateMutation(outcome === 'approved' ? 'approveApproval' : 'rejectApproval');
}

export async function mutateRunCommand(_runId: string, command: 'retryRun' | 'pauseRun' | 'resumeRun') {
  return simulateMutation(command);
}

export async function mutateTicketAssignment(_ticketId: string, _agentId: string) {
  return simulateMutation('assignTicket');
}

export async function mutateTicketCommand(_ticketId: string, command: 'escalateTicket' | 'resolveTicket') {
  return simulateMutation(command);
}
