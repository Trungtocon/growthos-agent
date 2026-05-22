import { useMemo } from 'react';
import {
  selectAgentDetailUiViewModel,
  selectApprovalCenterUiViewModel,
  selectCommandCenterUiViewModel,
  selectOrgChartUiViewModel,
  selectRunConsoleUiViewModel,
  selectTicketDetailUiViewModel,
  selectTicketsBoardUiViewModel,
  selectWorkforceUiViewModel,
} from './ui-selectors';
import { useUiStateSnapshot } from './ui-state';

export interface DemoDataState<T> {
  data: T;
  loading: false;
  error: null;
}

function ready<T>(data: T): DemoDataState<T> {
  return { data, loading: false, error: null };
}

export function useCommandCenterData() {
  const uiState = useUiStateSnapshot();
  return ready(useMemo(() => selectCommandCenterUiViewModel(uiState), [uiState]));
}

export function useWorkforceData() {
  const uiState = useUiStateSnapshot();
  return ready(useMemo(() => selectWorkforceUiViewModel(uiState), [uiState]));
}

export function useOrgChartData() {
  const uiState = useUiStateSnapshot();
  return ready(useMemo(() => selectOrgChartUiViewModel(uiState), [uiState]));
}

export function useAgentDetailData() {
  const uiState = useUiStateSnapshot();
  return ready(useMemo(() => selectAgentDetailUiViewModel(uiState), [uiState]));
}

export function useTicketsBoardData() {
  const uiState = useUiStateSnapshot();
  return ready(useMemo(() => selectTicketsBoardUiViewModel(uiState), [uiState]));
}

export function useTicketDetailData() {
  const uiState = useUiStateSnapshot();
  return ready(useMemo(() => selectTicketDetailUiViewModel(uiState), [uiState]));
}

export function useRunConsoleData() {
  const uiState = useUiStateSnapshot();
  return ready(useMemo(() => selectRunConsoleUiViewModel(uiState), [uiState]));
}

export function useApprovalCenterData() {
  const uiState = useUiStateSnapshot();
  return ready(useMemo(() => selectApprovalCenterUiViewModel(uiState), [uiState]));
}
