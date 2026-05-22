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
import { useWorkflowStateSnapshot } from './workflow-engine';

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
  const workflowState = useWorkflowStateSnapshot();
  return ready(useMemo(() => selectCommandCenterUiViewModel(uiState), [uiState, workflowState]));
}

export function useWorkforceData() {
  const uiState = useUiStateSnapshot();
  const workflowState = useWorkflowStateSnapshot();
  return ready(useMemo(() => selectWorkforceUiViewModel(uiState), [uiState, workflowState]));
}

export function useOrgChartData() {
  const uiState = useUiStateSnapshot();
  const workflowState = useWorkflowStateSnapshot();
  return ready(useMemo(() => selectOrgChartUiViewModel(uiState), [uiState, workflowState]));
}

export function useAgentDetailData() {
  const uiState = useUiStateSnapshot();
  const workflowState = useWorkflowStateSnapshot();
  return ready(useMemo(() => selectAgentDetailUiViewModel(uiState), [uiState, workflowState]));
}

export function useTicketsBoardData() {
  const uiState = useUiStateSnapshot();
  const workflowState = useWorkflowStateSnapshot();
  return ready(useMemo(() => selectTicketsBoardUiViewModel(uiState), [uiState, workflowState]));
}

export function useTicketDetailData() {
  const uiState = useUiStateSnapshot();
  const workflowState = useWorkflowStateSnapshot();
  return ready(useMemo(() => selectTicketDetailUiViewModel(uiState), [uiState, workflowState]));
}

export function useRunConsoleData() {
  const uiState = useUiStateSnapshot();
  const workflowState = useWorkflowStateSnapshot();
  return ready(useMemo(() => selectRunConsoleUiViewModel(uiState), [uiState, workflowState]));
}

export function useApprovalCenterData() {
  const uiState = useUiStateSnapshot();
  const workflowState = useWorkflowStateSnapshot();
  return ready(useMemo(() => selectApprovalCenterUiViewModel(uiState), [uiState, workflowState]));
}
