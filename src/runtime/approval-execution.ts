import type { Artifact } from '../domain/types';
import type { ApprovalHold } from './governance-enforcement';

export type ApprovalExecutionStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESUMED' | 'CANCELLED' | 'EXPIRED';
export type ApprovalExecutionDecisionType = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'ESCALATE';
export type ApprovalExecutionEventAction =
  | 'approval.created'
  | 'approval.approve'
  | 'approval.reject'
  | 'approval.request_changes'
  | 'approval.escalate'
  | 'approval.resumed'
  | 'approval.cancelled'
  | 'approval.expired';

export interface ApprovalExecutionRequest {
  id: string;
  holdId: string;
  enforcementReportId: string;
  targetId: string;
  targetType: ApprovalHold['targetType'];
  runtimeAction: string;
  reasons: string[];
  status: ApprovalExecutionStatus;
  priority: 'normal' | 'high';
  requestedBy: string;
  reviewerId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface ApprovalExecutionDecision {
  id: string;
  requestId: string;
  type: ApprovalExecutionDecisionType;
  reviewerId: string;
  note: string;
  decidedAt: string;
}

export interface ApprovalExecutionEvent {
  id: string;
  requestId: string;
  targetId: string;
  runtimeAction: string;
  action: ApprovalExecutionEventAction;
  actorId: string;
  status: ApprovalExecutionStatus;
  message: string;
  createdAt: string;
  priority: 'normal' | 'high';
}

export interface ApprovalExecutionReport {
  totalRequests: number;
  pending: number;
  approved: number;
  rejected: number;
  resumed: number;
  cancelled: number;
  escalated: number;
  expired: number;
  latestStatus: ApprovalExecutionStatus | 'NONE';
}

export interface ApprovalExecutionTransition {
  request: ApprovalExecutionRequest;
  decision?: ApprovalExecutionDecision;
  event: ApprovalExecutionEvent;
}

function now() {
  return new Date().toISOString();
}

function requestId(hold: ApprovalHold) {
  return `approval-exec-${hold.id}`;
}

function eventId(requestIdValue: string, action: ApprovalExecutionEventAction) {
  return `approval-exec-event-${requestIdValue}-${action}-${Date.now()}`;
}

function decisionAction(type: ApprovalExecutionDecisionType): ApprovalExecutionEventAction {
  if (type === 'REQUEST_CHANGES') return 'approval.request_changes';
  return `approval.${type.toLowerCase()}` as ApprovalExecutionEventAction;
}

export function createApprovalExecutionRequest(hold: ApprovalHold, actorId = 'system'): ApprovalExecutionTransition {
  const createdAt = now();
  const request: ApprovalExecutionRequest = {
    id: requestId(hold),
    holdId: hold.id,
    enforcementReportId: hold.reportId,
    targetId: hold.targetId,
    targetType: hold.targetType,
    runtimeAction: hold.runtimeAction,
    reasons: hold.reasons,
    status: 'PENDING_REVIEW',
    priority: hold.reasons.some((reason) => /critical|rbac|deployment|override/i.test(reason)) ? 'high' : 'normal',
    requestedBy: actorId,
    createdAt,
    updatedAt: createdAt,
  };
  return {
    request,
    event: {
      id: eventId(request.id, 'approval.created'),
      requestId: request.id,
      targetId: request.targetId,
      runtimeAction: request.runtimeAction,
      action: 'approval.created',
      actorId,
      status: request.status,
      message: `Approval execution request created for ${request.runtimeAction}.`,
      createdAt,
      priority: request.priority,
    },
  };
}

function transition(
  request: ApprovalExecutionRequest,
  type: ApprovalExecutionDecisionType,
  status: ApprovalExecutionStatus,
  reviewerId: string,
  note: string,
  message: string,
): ApprovalExecutionTransition {
  const decidedAt = now();
  const nextRequest: ApprovalExecutionRequest = {
    ...request,
    status,
    reviewerId,
    updatedAt: decidedAt,
    priority: type === 'ESCALATE' ? 'high' : request.priority,
  };
  return {
    request: nextRequest,
    decision: {
      id: `approval-exec-decision-${request.id}-${type}-${Date.now()}`,
      requestId: request.id,
      type,
      reviewerId,
      note,
      decidedAt,
    },
    event: {
      id: eventId(request.id, decisionAction(type)),
      requestId: request.id,
      targetId: request.targetId,
      runtimeAction: request.runtimeAction,
      action: decisionAction(type),
      actorId: reviewerId,
      status,
      message,
      createdAt: decidedAt,
      priority: type === 'ESCALATE' ? 'high' : request.priority,
    },
  };
}

export function approveExecutionRequest(request: ApprovalExecutionRequest, reviewerId: string, note = 'Approved for runtime resume.'): ApprovalExecutionTransition {
  return transition(request, 'APPROVE', 'APPROVED', reviewerId, note, `Approved ${request.runtimeAction}; runtime may resume.`);
}

export function rejectExecutionRequest(request: ApprovalExecutionRequest, reviewerId: string, note = 'Rejected by reviewer.'): ApprovalExecutionTransition {
  return transition(request, 'REJECT', 'REJECTED', reviewerId, note, `Rejected ${request.runtimeAction}; runtime must cancel.`);
}

export function requestExecutionChanges(request: ApprovalExecutionRequest, reviewerId: string, note = 'Changes requested before execution.'): ApprovalExecutionTransition {
  return transition(request, 'REQUEST_CHANGES', 'PENDING_REVIEW', reviewerId, note, `Changes requested for ${request.runtimeAction}; hold remains active.`);
}

export function escalateExecutionRequest(request: ApprovalExecutionRequest, reviewerId: string, note = 'Escalated for high-priority review.'): ApprovalExecutionTransition {
  return transition(request, 'ESCALATE', 'PENDING_REVIEW', reviewerId, note, `Escalated ${request.runtimeAction} for high-priority review.`);
}

export function resumeApprovedExecution(request: ApprovalExecutionRequest, actorId: string): ApprovalExecutionTransition {
  if (request.status !== 'APPROVED' && request.status !== 'RESUMED') {
    throw new Error(`Cannot resume approval execution ${request.id} before reviewer approval.`);
  }
  const resumedAt = now();
  const nextRequest = { ...request, status: 'RESUMED' as ApprovalExecutionStatus, updatedAt: resumedAt };
  return {
    request: nextRequest,
    event: {
      id: eventId(request.id, 'approval.resumed'),
      requestId: request.id,
      targetId: request.targetId,
      runtimeAction: request.runtimeAction,
      action: 'approval.resumed',
      actorId,
      status: 'RESUMED',
      message: `Resumed original runtime action ${request.runtimeAction}.`,
      createdAt: resumedAt,
      priority: request.priority,
    },
  };
}

export function cancelRejectedExecution(request: ApprovalExecutionRequest, actorId: string): ApprovalExecutionTransition {
  if (request.status !== 'REJECTED' && request.status !== 'CANCELLED') {
    throw new Error(`Cannot cancel approval execution ${request.id} before reviewer rejection.`);
  }
  const cancelledAt = now();
  const nextRequest = { ...request, status: 'CANCELLED' as ApprovalExecutionStatus, updatedAt: cancelledAt };
  return {
    request: nextRequest,
    event: {
      id: eventId(request.id, 'approval.cancelled'),
      requestId: request.id,
      targetId: request.targetId,
      runtimeAction: request.runtimeAction,
      action: 'approval.cancelled',
      actorId,
      status: 'CANCELLED',
      message: `Cancelled original runtime action ${request.runtimeAction}.`,
      createdAt: cancelledAt,
      priority: request.priority,
    },
  };
}

export function expireApprovalExecutionRequest(request: ApprovalExecutionRequest, actorId = 'system'): ApprovalExecutionTransition {
  const expiredAt = now();
  const nextRequest = { ...request, status: 'EXPIRED' as ApprovalExecutionStatus, updatedAt: expiredAt };
  return {
    request: nextRequest,
    event: {
      id: eventId(request.id, 'approval.expired'),
      requestId: request.id,
      targetId: request.targetId,
      runtimeAction: request.runtimeAction,
      action: 'approval.expired',
      actorId,
      status: 'EXPIRED',
      message: `Approval execution request expired for ${request.runtimeAction}.`,
      createdAt: expiredAt,
      priority: request.priority,
    },
  };
}

export function summarizeApprovalExecutions(requests: ApprovalExecutionRequest[], decisions: ApprovalExecutionDecision[], events: ApprovalExecutionEvent[]): ApprovalExecutionReport {
  return {
    totalRequests: requests.length,
    pending: requests.filter((request) => request.status === 'PENDING_REVIEW').length,
    approved: requests.filter((request) => request.status === 'APPROVED').length,
    rejected: requests.filter((request) => request.status === 'REJECTED').length,
    resumed: requests.filter((request) => request.status === 'RESUMED').length,
    cancelled: requests.filter((request) => request.status === 'CANCELLED').length,
    escalated: decisions.filter((decision) => decision.type === 'ESCALATE').length,
    expired: requests.filter((request) => request.status === 'EXPIRED').length,
    latestStatus: events[0]?.status ?? 'NONE',
  };
}

export function approvalExecutionArtifacts(input: {
  requests: ApprovalExecutionRequest[];
  decisions: ApprovalExecutionDecision[];
  events: ApprovalExecutionEvent[];
  resumedExecutions: ApprovalExecutionRequest[];
  cancelledExecutions: ApprovalExecutionRequest[];
  report: ApprovalExecutionReport;
}, runId: string): Artifact[] {
  const createdAt = now();
  const timeline = input.events.slice(0, 40).map((event) =>
    `| ${event.createdAt} | ${event.action} | ${event.status} | ${event.message} |`
  ).join('\n');
  return [
    {
      id: `artifact-${runId}-approval-execution-report`,
      runId,
      type: 'markdown',
      name: 'approval-execution-report.md',
      source: 'mock',
      contentSummary: 'Approval execution lifecycle summary.',
      contentText: `# Approval Execution Report\n\nTotal requests: ${input.report.totalRequests}\n\nPending: ${input.report.pending}\n\nResumed: ${input.report.resumed}\n\nCancelled: ${input.report.cancelled}\n`,
      createdAt,
    },
    {
      id: `artifact-${runId}-approval-decisions`,
      runId,
      type: 'json',
      name: 'approval-decisions.json',
      source: 'mock',
      contentSummary: `${input.decisions.length} reviewer decisions.`,
      contentJson: input.decisions,
      createdAt,
    },
    {
      id: `artifact-${runId}-approval-timeline`,
      runId,
      type: 'markdown',
      name: 'approval-timeline.md',
      source: 'mock',
      contentSummary: `${input.events.length} approval execution events.`,
      contentText: `# Approval Execution Timeline\n\n| Time | Action | Status | Message |\n|---|---|---|---|\n${timeline}\n`,
      createdAt,
    },
    {
      id: `artifact-${runId}-rejected-executions`,
      runId,
      type: 'json',
      name: 'rejected-executions.json',
      source: 'mock',
      contentSummary: `${input.cancelledExecutions.length} cancelled or rejected executions.`,
      contentJson: input.cancelledExecutions,
      createdAt,
    },
    {
      id: `artifact-${runId}-resumed-executions`,
      runId,
      type: 'json',
      name: 'resumed-executions.json',
      source: 'mock',
      contentSummary: `${input.resumedExecutions.length} resumed executions.`,
      contentJson: input.resumedExecutions,
      createdAt,
    },
  ];
}
