import { demoCurrentUser } from '../data/demo-fixtures';
import { appendRuntimeEvent } from '../runtime-store/event-store';
import { setRunLifecycle } from '../runtime-store/run-store';
import { authorizeAction } from './rbac-store';
import { evaluateGovernanceDecision } from './governance-decision-engine';
import { recordGovernanceDecision } from './governance-decision-store';
import { enforceGovernanceDecision, type ApprovalHold } from './governance-enforcement';
import { getApprovalHolds, recordGovernanceEnforcement } from './governance-enforcement-store';
import {
  approvalExecutionArtifacts,
  approveExecutionRequest as buildApprovalDecision,
  cancelRejectedExecution as buildCancelRejectedExecution,
  createApprovalExecutionRequest as buildApprovalRequest,
  escalateExecutionRequest as buildEscalationDecision,
  expireApprovalExecutionRequest,
  rejectExecutionRequest as buildRejectionDecision,
  requestExecutionChanges as buildChangesDecision,
  resumeApprovedExecution as buildResumeApprovedExecution,
  summarizeApprovalExecutions,
  type ApprovalExecutionDecision,
  type ApprovalExecutionEvent,
  type ApprovalExecutionReport,
  type ApprovalExecutionRequest,
  type ApprovalExecutionTransition,
} from './approval-execution';

const APPROVAL_EXECUTION_KEY = 'uikigai-approval-execution-v1';

interface ApprovalExecutionState {
  approvalRequests: ApprovalExecutionRequest[];
  approvalDecisions: ApprovalExecutionDecision[];
  approvalEvents: ApprovalExecutionEvent[];
  resumedExecutions: ApprovalExecutionRequest[];
  cancelledExecutions: ApprovalExecutionRequest[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyState(): ApprovalExecutionState {
  return {
    approvalRequests: [],
    approvalDecisions: [],
    approvalEvents: [],
    resumedExecutions: [],
    cancelledExecutions: [],
  };
}

function readState(): ApprovalExecutionState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = window.sessionStorage.getItem(APPROVAL_EXECUTION_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<ApprovalExecutionState>;
    return {
      approvalRequests: parsed.approvalRequests ?? [],
      approvalDecisions: parsed.approvalDecisions ?? [],
      approvalEvents: parsed.approvalEvents ?? [],
      resumedExecutions: parsed.resumedExecutions ?? [],
      cancelledExecutions: parsed.cancelledExecutions ?? [],
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: ApprovalExecutionState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(APPROVAL_EXECUTION_KEY, JSON.stringify(state));
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  return [item, ...items.filter((existing) => existing.id !== item.id)];
}

function knownHold(holdId: string): ApprovalHold | undefined {
  return getApprovalHolds().find((hold) => hold.id === holdId);
}

function persistTransition(transition: ApprovalExecutionTransition, bucket?: 'resumed' | 'cancelled'): ApprovalExecutionRequest {
  const state = readState();
  const approvalRequests = upsertById(state.approvalRequests, transition.request).slice(0, 150);
  const approvalDecisions = transition.decision
    ? upsertById(state.approvalDecisions, transition.decision).slice(0, 150)
    : state.approvalDecisions;
  const approvalEvents = upsertById(state.approvalEvents, transition.event).slice(0, 200);
  const resumedExecutions = bucket === 'resumed'
    ? upsertById(state.resumedExecutions, transition.request).slice(0, 100)
    : state.resumedExecutions;
  const cancelledExecutions = bucket === 'cancelled'
    ? upsertById(state.cancelledExecutions, transition.request).slice(0, 100)
    : state.cancelledExecutions;
  writeState({ approvalRequests, approvalDecisions, approvalEvents, resumedExecutions, cancelledExecutions });
  appendRuntimeEvent({
    command: transition.event.action,
    entityType: 'run',
    entityId: transition.request.targetId,
    actorId: transition.event.actorId,
    title: transition.event.message,
    status: transition.event.status === 'REJECTED' || transition.event.status === 'CANCELLED' ? 'failed' : transition.event.status === 'PENDING_REVIEW' ? 'pending' : 'success',
  });
  return transition.request;
}

function recordDecisionGovernance(request: ApprovalExecutionRequest, action: string, deniedReason?: string) {
  const authorizationDecision = authorizeAction({
    action,
    resourceId: request.targetId,
    requiredPermissions: ['run.approve'],
  });
  const report = recordGovernanceDecision(evaluateGovernanceDecision({
    targetId: request.targetId,
    targetType: request.targetType,
    action,
    authorizationDecision,
    approvalRequired: false,
    deniedReason,
  }));
  recordGovernanceEnforcement(enforceGovernanceDecision(report, { runtimeAction: action }));
  if (!authorizationDecision.allowed) {
    throw new Error(`Authorization denied for ${action}: ${authorizationDecision.reason}`);
  }
}

export function createApprovalExecutionRequest(hold: ApprovalHold, actorId = 'system'): ApprovalExecutionRequest {
  const sourceHold = knownHold(hold.id);
  if (!sourceHold) throw new Error(`Cannot create approval execution request without governance enforcement hold ${hold.id}.`);
  const existing = readState().approvalRequests.find((request) => request.holdId === hold.id);
  if (existing) return clone(existing);
  return persistTransition(buildApprovalRequest(sourceHold, actorId));
}

function getRequestOrThrow(requestId: string): ApprovalExecutionRequest {
  const request = readState().approvalRequests.find((item) => item.id === requestId);
  if (!request) throw new Error(`Missing approval execution request ${requestId}.`);
  return request;
}

export function approveExecutionRequest(requestId: string, reviewerId = demoCurrentUser.id, note?: string): ApprovalExecutionRequest {
  const request = getRequestOrThrow(requestId);
  recordDecisionGovernance(request, 'approve_execution');
  return persistTransition(buildApprovalDecision(request, reviewerId, note));
}

export function rejectExecutionRequest(requestId: string, reviewerId = demoCurrentUser.id, note?: string): ApprovalExecutionRequest {
  const request = getRequestOrThrow(requestId);
  recordDecisionGovernance(request, 'reject_execution');
  return persistTransition(buildRejectionDecision(request, reviewerId, note));
}

export function requestExecutionChanges(requestId: string, reviewerId = demoCurrentUser.id, note?: string): ApprovalExecutionRequest {
  const request = getRequestOrThrow(requestId);
  recordDecisionGovernance(request, 'request_execution_changes');
  return persistTransition(buildChangesDecision(request, reviewerId, note));
}

export function escalateExecutionRequest(requestId: string, reviewerId = demoCurrentUser.id, note?: string): ApprovalExecutionRequest {
  const request = getRequestOrThrow(requestId);
  recordDecisionGovernance(request, 'escalate_execution');
  return persistTransition(buildEscalationDecision(request, reviewerId, note));
}

export function resumeApprovedExecution(requestId: string, actorId = demoCurrentUser.id): ApprovalExecutionRequest {
  const request = getRequestOrThrow(requestId);
  recordDecisionGovernance(request, 'resume_approved_execution');
  const resumed = persistTransition(buildResumeApprovedExecution(request, actorId), 'resumed');
  if (resumed.targetType === 'run' || resumed.targetType === 'runtime' || resumed.targetType === 'plan') {
    setRunLifecycle(resumed.targetId, 'APPROVED');
  }
  return resumed;
}

export function cancelRejectedExecution(requestId: string, actorId = demoCurrentUser.id): ApprovalExecutionRequest {
  const request = getRequestOrThrow(requestId);
  recordDecisionGovernance(request, 'cancel_rejected_execution');
  const cancelled = persistTransition(buildCancelRejectedExecution(request, actorId), 'cancelled');
  if (cancelled.targetType === 'run' || cancelled.targetType === 'runtime' || cancelled.targetType === 'plan') {
    setRunLifecycle(cancelled.targetId, 'REJECTED');
  }
  return cancelled;
}

export function expireStaleApprovalRequests(maxAgeMs = 24 * 60 * 60 * 1000): ApprovalExecutionRequest[] {
  const cutoff = Date.now() - maxAgeMs;
  return readState().approvalRequests
    .filter((request) => request.status === 'PENDING_REVIEW' && new Date(request.createdAt).getTime() < cutoff)
    .map((request) => persistTransition(expireApprovalExecutionRequest(request), 'cancelled'));
}

export function assertApprovalExecutionAllowsRuntime(targetId: string): void {
  const blocked = readState().approvalRequests.find((request) =>
    request.targetId === targetId && (request.status === 'REJECTED' || request.status === 'CANCELLED' || request.status === 'EXPIRED')
  );
  if (blocked) {
    throw new Error(`Approval execution ${blocked.status} blocks runtime action ${blocked.runtimeAction} for ${targetId}.`);
  }
}

export function getApprovalExecutionRequests(): ApprovalExecutionRequest[] {
  return clone(readState().approvalRequests);
}

export function getApprovalExecutionDecisions(): ApprovalExecutionDecision[] {
  return clone(readState().approvalDecisions);
}

export function getApprovalExecutionEvents(): ApprovalExecutionEvent[] {
  return clone(readState().approvalEvents);
}

export function getResumedExecutions(): ApprovalExecutionRequest[] {
  return clone(readState().resumedExecutions);
}

export function getCancelledExecutions(): ApprovalExecutionRequest[] {
  return clone(readState().cancelledExecutions);
}

export function getPendingApprovalExecutions(): ApprovalExecutionRequest[] {
  return getApprovalExecutionRequests().filter((request) => request.status === 'PENDING_REVIEW');
}

export function getApprovedExecutions(): ApprovalExecutionRequest[] {
  return getApprovalExecutionRequests().filter((request) => request.status === 'APPROVED' || request.status === 'RESUMED');
}

export function getRejectedApprovalExecutions(): ApprovalExecutionRequest[] {
  return getApprovalExecutionRequests().filter((request) => request.status === 'REJECTED' || request.status === 'CANCELLED');
}

export function getApprovalExecutionByRun(runId: string): ApprovalExecutionRequest[] {
  return getApprovalExecutionRequests().filter((request) => request.targetId === runId || request.runtimeAction.includes(runId));
}

export function getApprovalExecutionByActor(actorId: string): ApprovalExecutionRequest[] {
  return getApprovalExecutionRequests().filter((request) => request.requestedBy === actorId || request.reviewerId === actorId);
}

export function getEscalatedApprovals(): ApprovalExecutionRequest[] {
  const escalatedIds = new Set(getApprovalExecutionDecisions().filter((decision) => decision.type === 'ESCALATE').map((decision) => decision.requestId));
  return getApprovalExecutionRequests().filter((request) => escalatedIds.has(request.id) || request.priority === 'high');
}

export function getApprovalExecutionSummary(): ApprovalExecutionReport {
  return summarizeApprovalExecutions(getApprovalExecutionRequests(), getApprovalExecutionDecisions(), getApprovalExecutionEvents());
}

export function generateApprovalExecutionArtifacts(runId: string) {
  return approvalExecutionArtifacts({
    requests: getApprovalExecutionRequests(),
    decisions: getApprovalExecutionDecisions(),
    events: getApprovalExecutionEvents(),
    resumedExecutions: getResumedExecutions(),
    cancelledExecutions: getCancelledExecutions(),
    report: getApprovalExecutionSummary(),
  }, runId);
}

export function clearApprovalExecutionStore() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(APPROVAL_EXECUTION_KEY);
}
