import type { ImprovementLoop, ImprovementLoopRun } from './improvement-loop';
import type { Recommendation } from './learning-memory';

export type LoopGovernanceDecisionType =
  | 'ALLOW'
  | 'PAUSE'
  | 'REQUIRE_REVIEW'
  | 'BLOCK'
  | 'KILL'
  | 'ROLLBACK_REQUIRED';

export type LoopGovernanceBlockReason =
  | 'max_attempts_exceeded'
  | 'confidence_too_low'
  | 'repeated_failure'
  | 'cost_limit_exceeded'
  | 'risk_too_high'
  | 'governance_blocker'
  | 'approval_required'
  | 'regression_detected'
  | 'manual_kill_switch'
  | 'missing_evidence';

export interface ImprovementLoopGovernancePolicy {
  id: string;
  name: string;
  maxAttempts: number;
  maxCostUsd: number;
  maxRiskScore: number;
  minConfidence: number;
  enabled: boolean;
}

export interface ImprovementLoopGovernanceDecision {
  id: string;
  loopId: string;
  action: 'start' | 'resume' | 'retry' | 'complete' | 'rollback' | 'kill' | 'pause';
  decision: LoopGovernanceDecisionType;
  reasons: LoopGovernanceBlockReason[];
  message: string;
  createdAt: string;
}

export interface ImprovementLoopKillSwitch {
  enabled: boolean;
  reason?: string;
  enabledAt?: string;
  disabledAt?: string;
  affectedLoopIds: string[];
}

export interface LoopRollbackPlan {
  id: string;
  loopId: string;
  reason: LoopGovernanceBlockReason;
  steps: string[];
  status: 'draft' | 'required' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
}

export interface LoopGovernanceAuditEvent {
  id: string;
  loopId?: string;
  action: string;
  decision: LoopGovernanceDecisionType;
  reasons: LoopGovernanceBlockReason[];
  message: string;
  createdAt: string;
}

export interface LoopGovernanceSummary {
  totalDecisions: number;
  allowed: number;
  paused: number;
  blocked: number;
  killed: number;
  rollbackRequired: number;
  killSwitchEnabled: boolean;
  generatedAt: string;
}

export function defaultLoopGovernancePolicy(): ImprovementLoopGovernancePolicy {
  return {
    id: 'default_autonomous_loop_governance',
    name: 'Default autonomous loop governance',
    maxAttempts: 2,
    maxCostUsd: 25,
    maxRiskScore: 80,
    minConfidence: 50,
    enabled: true,
  };
}

export function riskScoreForLoop(loop: ImprovementLoop): number {
  if (loop.priority === 'critical') return 95;
  if (loop.priority === 'high') return 76;
  if (loop.priority === 'medium') return 48;
  return 25;
}

export function estimatedCostForLoop(loop: ImprovementLoop): number {
  if (loop.trigger.type === 'budget_variance') return 50;
  if (loop.priority === 'critical') return 32;
  if (loop.priority === 'high') return 18;
  return 8;
}

export function evaluateLoopGovernance(
  loop: ImprovementLoop,
  runs: ImprovementLoopRun[],
  recommendation: Recommendation | undefined,
  killSwitch: ImprovementLoopKillSwitch,
  policy: ImprovementLoopGovernancePolicy = defaultLoopGovernancePolicy(),
  action: ImprovementLoopGovernanceDecision['action'] = 'start',
): ImprovementLoopGovernanceDecision {
  const timestamp = new Date().toISOString();
  const failedRuns = runs.filter((run) => run.status === 'failed');
  const reasons: LoopGovernanceBlockReason[] = [];
  if (killSwitch.enabled) reasons.push('manual_kill_switch');
  if (action === 'retry' && runs.length >= policy.maxAttempts) reasons.push('max_attempts_exceeded');
  if ((recommendation?.confidence ?? loop.confidenceAtCreation) < policy.minConfidence) reasons.push('confidence_too_low');
  if (failedRuns.length >= 2) reasons.push('repeated_failure');
  if (estimatedCostForLoop(loop) > policy.maxCostUsd || loop.trigger.type === 'budget_variance') reasons.push('cost_limit_exceeded');
  if (riskScoreForLoop(loop) > policy.maxRiskScore) reasons.push('risk_too_high');
  if (loop.trigger.type === 'governance_warning') reasons.push('governance_blocker');
  if (loop.trigger.type === 'regression_detected') reasons.push('regression_detected');
  if (loop.priority === 'critical') reasons.push('approval_required');

  let decision: LoopGovernanceDecisionType = 'ALLOW';
  if (killSwitch.enabled) decision = 'KILL';
  else if (reasons.includes('regression_detected')) decision = 'ROLLBACK_REQUIRED';
  else if (reasons.includes('max_attempts_exceeded')) decision = 'BLOCK';
  else if (reasons.includes('repeated_failure')) decision = 'PAUSE';
  else if (reasons.includes('approval_required') || reasons.includes('risk_too_high')) decision = 'REQUIRE_REVIEW';
  else if (reasons.length) decision = 'BLOCK';

  return {
    id: `loop-governance-decision-${loop.id}-${action}-${Date.now()}`,
    loopId: loop.id,
    action,
    decision,
    reasons,
    message: decision === 'ALLOW'
      ? 'Autonomous loop is allowed to proceed.'
      : `Autonomous loop ${decision.toLowerCase().replace(/_/g, ' ')}: ${reasons.join(', ')}`,
    createdAt: timestamp,
  };
}
