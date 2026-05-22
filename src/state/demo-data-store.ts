import { useMemo } from 'react';
import {
  selectAgentDetailViewModel,
  selectApprovalCenterViewModel,
  selectCommandCenterViewModel,
  selectOrgChartViewModel,
  selectRunConsoleViewModel,
  selectTicketDetailViewModel,
  selectTicketsBoardViewModel,
  selectWorkforceViewModel,
} from '../domain/selectors';

export interface DemoDataState<T> {
  data: T;
  loading: false;
  error: null;
}

function ready<T>(data: T): DemoDataState<T> {
  return { data, loading: false, error: null };
}

export function useCommandCenterData() {
  return ready(useMemo(() => selectCommandCenterViewModel(), []));
}

export function useWorkforceData() {
  return ready(useMemo(() => selectWorkforceViewModel(), []));
}

export function useOrgChartData() {
  return ready(useMemo(() => selectOrgChartViewModel(), []));
}

export function useAgentDetailData(agentId?: string) {
  return ready(useMemo(() => selectAgentDetailViewModel(agentId), [agentId]));
}

export function useTicketsBoardData() {
  return ready(useMemo(() => selectTicketsBoardViewModel(), []));
}

export function useTicketDetailData(ticketId?: string) {
  return ready(useMemo(() => selectTicketDetailViewModel(ticketId), [ticketId]));
}

export function useRunConsoleData(runId?: string) {
  return ready(useMemo(() => selectRunConsoleViewModel(runId), [runId]));
}

export function useApprovalCenterData() {
  return ready(useMemo(() => selectApprovalCenterViewModel(), []));
}
