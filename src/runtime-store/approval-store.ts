import type { Approval } from '../domain/types';
import { readRuntimeState, updateRuntimeState } from './runtime-persistence';

export function upsertApproval(approval: Approval): Approval {
  updateRuntimeState((state) => ({
    ...state,
    approvals: { ...state.approvals, [approval.id]: approval },
  }));
  return approval;
}

export function getApprovalById(approvalId: string): Approval | undefined {
  return readRuntimeState().approvals[approvalId];
}

export function getApprovals(): Approval[] {
  return Object.values(readRuntimeState().approvals);
}

export function getPendingApprovals(): Approval[] {
  return getApprovals().filter((approval) => approval.status === 'pending');
}

export function ensureApproval(approval: Approval): Approval {
  return getApprovalById(approval.id) ?? upsertApproval(approval);
}
