import {
  selectAgentDetailViewModel,
  selectApprovalCenterViewModel,
  selectCommandCenterViewModel,
  getArtifactPreviewModel,
  selectOrgChartViewModel,
  selectRunConsoleViewModel,
  selectTicketDetailViewModel,
  selectTicketsBoardViewModel,
  selectWorkforceViewModel,
} from '../domain/selectors';
import type { UiState } from './ui-state';

function includesQuery(values: string[], query: string) {
  const normalized = query.trim().toLowerCase();
  return normalized.length === 0 || values.some((value) => value.toLowerCase().includes(normalized));
}

export function selectCommandCenterUiViewModel(_state: UiState) {
  return selectCommandCenterViewModel();
}

export function selectWorkforceUiViewModel(state: UiState) {
  const data = selectWorkforceViewModel();
  const agents = data.agentCards.filter((agent) => includesQuery([agent.name, agent.role, agent.status], state.searchQuery));
  return { ...data, agentCards: agents };
}

export function selectOrgChartUiViewModel(state: UiState) {
  const data = selectOrgChartViewModel();
  const selectedAgent = data.agents.find((agent) => agent.id === state.selectedAgentId) ?? data.detailAgent;
  return { ...data, selectedAgent };
}

export function selectAgentDetailUiViewModel(state: UiState) {
  return {
    ...selectAgentDetailViewModel(state.selectedAgentId),
    activeTab: state.activeTabs['/agents/demo-agent'] ?? 'Overview',
  };
}

export function selectTicketsBoardUiViewModel(state: UiState) {
  const data = selectTicketsBoardViewModel();
  const filters = state.routeFilters['/tickets'] ?? {};
  const tickets = data.tickets.filter((ticket) => {
    const statusMatch = !filters.status || filters.status === 'All' || ticket.column === filters.status;
    const searchMatch = includesQuery([ticket.title, ticket.project, ticket.agent], state.searchQuery);
    return statusMatch && searchMatch;
  });
  return { ...data, tickets, filters, searchQuery: state.searchQuery };
}

export function selectTicketDetailUiViewModel(state: UiState) {
  const data = selectTicketDetailViewModel(state.selectedTicketId);
  const selectedPreview = state.selectedArtifactId ? getArtifactPreviewModel(state.selectedArtifactId) : undefined;
  const selectedArtifactBelongsToRun = Boolean(selectedPreview && selectedPreview.runId === data.run?.id);
  return {
    ...data,
    selectedArtifactId: selectedArtifactBelongsToRun && selectedPreview ? selectedPreview.id : data.primaryArtifactPreview?.id ?? '',
    selectedArtifactPreview: selectedArtifactBelongsToRun ? selectedPreview : data.primaryArtifactPreview,
    activeTab: state.activeTabs['/tickets/demo-ticket'] ?? 'Overview',
  };
}

export function selectRunConsoleUiViewModel(state: UiState) {
  const data = selectRunConsoleViewModel();
  const selectedPreview = state.selectedArtifactId ? getArtifactPreviewModel(state.selectedArtifactId) : undefined;
  const belongsToRun = selectedPreview?.runId === data.run.id;
  return {
    ...data,
    selectedArtifactId: belongsToRun ? selectedPreview.id : data.primaryArtifactPreview?.id ?? data.artifacts[0]?.id ?? '',
    selectedArtifactPreview: belongsToRun ? selectedPreview : data.primaryArtifactPreview,
  };
}

export function selectApprovalCenterUiViewModel(state: UiState) {
  const data = selectApprovalCenterViewModel();
  const filters = state.routeFilters['/approvals'] ?? {};
  const approvals = data.approvals.filter((approval) => {
    const riskMatch = !filters.risk || filters.risk === 'All' || approval.risk === filters.risk;
    const searchMatch = includesQuery([approval.title, approval.agent, approval.ticket], state.searchQuery);
    return riskMatch && searchMatch;
  });
  const selectedApproval = approvals.find((approval) => approval.id === state.selectedApprovalId) ?? data.selectedApproval;
  const selectedRawApproval = data.rawApprovals.find((approval) => approval.id === selectedApproval.id);
  const selectedPreview = state.selectedArtifactId ? getArtifactPreviewModel(state.selectedArtifactId) : undefined;
  const approvalPreview = selectedPreview?.runId === selectedRawApproval?.runId ? selectedPreview : data.selectedArtifactPreview;
  return { ...data, approvals, selectedApproval, selectedArtifactPreview: approvalPreview, filters, searchQuery: state.searchQuery };
}
