import { updateUiState } from './ui-state';

export function selectTicket(ticketId: string) {
  updateUiState((state) => ({ ...state, selectedTicketId: ticketId }));
}

export function selectAgent(agentId: string) {
  updateUiState((state) => ({ ...state, selectedAgentId: agentId }));
}

export function selectApproval(approvalId: string) {
  updateUiState((state) => ({ ...state, selectedApprovalId: approvalId }));
}

export function setSearchQuery(searchQuery: string) {
  updateUiState((state) => ({ ...state, searchQuery }));
}

export function setActiveTab(route: string, tab: string) {
  updateUiState((state) => ({
    ...state,
    activeTabs: { ...state.activeTabs, [route]: tab },
  }));
}

export function setRouteFilter(route: string, key: string, value: string) {
  updateUiState((state) => ({
    ...state,
    routeFilters: {
      ...state.routeFilters,
      [route]: {
        ...(state.routeFilters[route] ?? {}),
        [key]: value,
      },
    },
  }));
}
