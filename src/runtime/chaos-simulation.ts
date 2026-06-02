import type { AutoHealingDecision, WorkerRecoveryRisk, WorkerRecoveryStatus } from './worker-recovery';

export type ChaosScenarioType =
  | 'worker_stale'
  | 'worker_heartbeat_missing'
  | 'queue_retry_exhausted'
  | 'governance_blocked'
  | 'approval_timeout'
  | 'sandbox_offline'
  | 'tool_call_failure'
  | 'artifact_export_failure'
  | 'quota_exceeded'
  | 'cost_spike'
  | 'recovery_loop_failure'
  | 'kill_switch_triggered';

export type ChaosRunStatus = 'draft' | 'running' | 'waiting_approval' | 'completed' | 'failed';
export type ChaosEventSeverity = 'info' | 'warning' | 'critical';

export interface ChaosSafetyGuard {
  id: string;
  name: string;
  enforced: boolean;
  message: string;
}

export interface ChaosScenario {
  id: string;
  type: ChaosScenarioType;
  name: string;
  description: string;
  risk: WorkerRecoveryRisk;
  enabled: boolean;
  safetyGuards: ChaosSafetyGuard[];
  createdAt: string;
}

export interface ChaosRun {
  id: string;
  scenarioId: string;
  scenarioType: ChaosScenarioType;
  status: ChaosRunStatus;
  runtimeMode: 'chaos_mock';
  realEndpointCalls: 0;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  failedReason?: string;
}

export interface ChaosInjection {
  id: string;
  runId: string;
  scenarioId: string;
  type: ChaosScenarioType;
  target: 'worker' | 'queue' | 'governance' | 'approval' | 'sandbox' | 'tool' | 'artifact' | 'quota' | 'budget' | 'recovery';
  injectedAt: string;
}

export interface ChaosEvent {
  id: string;
  runId: string;
  scenarioId: string;
  type: ChaosScenarioType;
  severity: ChaosEventSeverity;
  message: string;
  auditable: true;
  createdAt: string;
}

export interface ChaosRecoveryResult {
  id: string;
  runId: string;
  incidentId: string;
  recoveryPlanId: string;
  risk: WorkerRecoveryRisk;
  autoHealingDecision: AutoHealingDecision['decision'];
  recoveryStatus: WorkerRecoveryStatus;
  message: string;
  createdAt: string;
}

export interface ChaosScorecard {
  id: string;
  runId: string;
  score: number;
  incidentCreated: boolean;
  recoveryPlanCreated: boolean;
  governanceRespected: boolean;
  endpointIsolationPreserved: boolean;
  killSwitchRespected: boolean;
  createdAt: string;
}

export interface ChaosReadiness {
  ready: boolean;
  mode: 'chaos_mock';
  safetyGuards: ChaosSafetyGuard[];
  blockedReasons: string[];
}

export interface ChaosDashboard {
  scenarios: ChaosScenario[];
  runs: ChaosRun[];
  activeRun?: ChaosRun;
  events: ChaosEvent[];
  injections: ChaosInjection[];
  results: ChaosRecoveryResult[];
  scorecards: ChaosScorecard[];
  readiness: ChaosReadiness;
  artifacts: string[];
}
