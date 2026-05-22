import { useSyncExternalStore } from 'react';
import { DEMO_AGENT_ID, DEMO_APPROVAL_ID, DEMO_TICKET_ID } from '../data/demo-fixtures';

export type DemoRoute =
  | '/command-center'
  | '/workforce'
  | '/org-chart'
  | '/agents/demo-agent'
  | '/tickets'
  | '/tickets/demo-ticket'
  | '/runs/demo-run'
  | '/approvals';

export interface UiState {
  selectedTicketId: string;
  selectedAgentId: string;
  selectedApprovalId: string;
  searchQuery: string;
  routeFilters: Record<string, Record<string, string>>;
  activeTabs: Record<string, string>;
}

const defaultState: UiState = {
  selectedTicketId: DEMO_TICKET_ID,
  selectedAgentId: DEMO_AGENT_ID,
  selectedApprovalId: DEMO_APPROVAL_ID,
  searchQuery: '',
  routeFilters: {},
  activeTabs: {
    '/agents/demo-agent': 'Overview',
    '/tickets/demo-ticket': 'Overview',
  },
};

const storageKey = 'uikigai-demo-ui-state';

function loadInitialState(): UiState {
  if (typeof window === 'undefined') return defaultState;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : defaultState;
  } catch {
    return defaultState;
  }
}

function persistState(nextState: UiState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(storageKey, JSON.stringify(nextState));
}

let state: UiState = loadInitialState();
const listeners = new Set<() => void>();

export function getUiState(): UiState {
  return state;
}

export function subscribeUiState(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateUiState(updater: (current: UiState) => UiState) {
  state = updater(state);
  persistState(state);
  listeners.forEach((listener) => listener());
}

export function useUiStateSnapshot() {
  return useSyncExternalStore(subscribeUiState, getUiState, getUiState);
}
