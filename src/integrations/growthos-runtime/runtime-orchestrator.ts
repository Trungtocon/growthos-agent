import { DEMO_AGENT_ID, DEMO_APPROVAL_ID, DEMO_RUN_ID, DEMO_TICKET_ID } from '../../data/demo-fixtures';
import type { Activity, Approval, Run, RunLog, RunStatus, ToolCall } from '../../domain/types';
import { createHermesAdapter } from '../hermes/hermes-adapter';
import type { HermesExecution, HermesTask } from '../hermes/hermes-types';
import { createPaperclipAdapter } from '../paperclip/paperclip-adapter';
import { mapPaperclipArtifactToArtifact } from './run-event-mapper';
import { mapTicketToHermesTask } from './ticket-to-task-mapper';
import type { RuntimeActionPlan, RuntimeDecisionOutcome, RuntimeMode, RuntimeRunCommand } from './runtime-types';
import { getApprovalById, upsertApproval } from '../../runtime-store/approval-store';
import { upsertArtifact } from '../../runtime-store/artifact-store';
import { appendRuntimeEvent } from '../../runtime-store/event-store';
import { setRunLifecycle, upsertRun } from '../../runtime-store/run-store';
import type { RuntimeLifecycle } from '../../runtime-store/runtime-persistence';

const hermes = createHermesAdapter('mock');
const paperclip = createPaperclipAdapter('mock');

function runtimeNow() {
  return new Date().toISOString();
}

function runtimeLog(id: string, message: string, level: RunLog['level'] = 'info'): RunLog {
  return { id, timestamp: runtimeNow(), level, message };
}

function runtimeTool(id: string, toolName: string, status: ToolCall['status'], inputSummary: string, outputSummary: string, cost = 0.002): ToolCall {
  return {
    id,
    toolName,
    status,
    inputSummary,
    outputSummary,
    durationMs: status === 'running' ? 900 : 2400,
    cost,
  };
}

function fallbackTask(ticketId: string): HermesTask {
  return {
    id: `hermes-task-${ticketId}`,
    ticketId,
    agentId: DEMO_AGENT_ID,
    title: 'Runtime ticket execution',
    prompt: 'Simulated Sprint 6A Hermes runtime task.',
    priority: 'high',
    riskLevel: 'medium',
    acceptanceCriteria: ['Map ticket', 'Run Hermes tool chain', 'Create Paperclip artifact', 'Open approval gate'],
    tags: ['runtime', 'paperclip', 'hermes'],
  };
}

function createRuntimeRun(existingRun: Run, task: HermesTask): Run {
  const now = runtimeNow();
  const paperclipArtifact = mapPaperclipArtifactToArtifact({
    id: `paperclip-${existingRun.id}-qa-packet`,
    runId: existingRun.id,
    type: 'report',
    name: 'Paperclip_QA_Runtime_Packet.md',
    createdAt: now,
    source: 'paperclip',
  });
  const artifacts = [
    paperclipArtifact,
    ...existingRun.artifacts.filter((artifact) => artifact.id !== paperclipArtifact.id),
  ];

  return {
    ...existingRun,
    status: 'running',
    currentStep: 'Waiting for human approval gate',
    elapsedSeconds: Math.max(existingRun.elapsedSeconds, 18),
    cost: Math.max(existingRun.cost, 0.038),
    riskLevel: task.riskLevel,
    steps: [
      { id: 'runtime-step-context', name: 'Mapped ticket into Hermes task', status: 'success', startedAt: now, durationSeconds: 2, cost: 0.001 },
      { id: 'runtime-step-tools', name: 'Selected runtime tools', status: 'success', startedAt: now, durationSeconds: 3, cost: 0.002 },
      { id: 'runtime-step-approval', name: 'Human approval required', status: 'warning', startedAt: now, durationSeconds: 1, cost: 0 },
      ...existingRun.steps.filter((step) => !step.id.startsWith('runtime-step-')),
    ],
    toolCalls: [
      runtimeTool('runtime-tool-read-context', 'Read Context', 'success', task.title, 'Ticket context loaded into Hermes runtime'),
      runtimeTool('runtime-tool-plan', 'Plan Execution', 'success', 'acceptance criteria', 'Execution checklist generated', 0.004),
      runtimeTool('runtime-tool-approval', 'Request Approval', 'warning', 'terminal command approval', 'Human approval gate opened', 0),
      ...existingRun.toolCalls.filter((tool) => !tool.id.startsWith('runtime-tool-')),
    ],
    logs: [
      runtimeLog('runtime-log-started', `Hermes accepted task ${task.id}`),
      runtimeLog('runtime-log-context', 'Mapped ticket context and criteria'),
      runtimeLog('runtime-log-approval', 'Approval required before external tool execution', 'warn'),
      ...existingRun.logs.filter((log) => !log.id.startsWith('runtime-log-')),
    ],
    artifacts,
  };
}

function persistRuntimeBundle(run: Run, approval?: Approval) {
  const lifecycle = run.currentStep.toLowerCase().includes('approval') ? 'WAITING_APPROVAL' : 'RUNNING';
  upsertRun(run, lifecycle);
  run.artifacts.forEach((artifact) => upsertArtifact(artifact));
  if (approval) upsertApproval(approval);
}

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  return items.some((item) => item.id === next.id)
    ? items.map((item) => item.id === next.id ? next : item)
    : [next, ...items];
}

function activity(id: string, title: string, description: string, relatedTicketId?: string, relatedRunId?: string): Activity {
  return {
    id,
    type: 'run',
    title,
    description,
    actorAgentId: DEMO_AGENT_ID,
    relatedTicketId,
    relatedRunId,
    createdAt: runtimeNow(),
    status: 'running',
  };
}

function runtimeApproval(existing: Approval | undefined, ticketId: string, runId: string, agentId: string): Approval {
  const now = runtimeNow();
  return {
    id: existing?.id ?? DEMO_APPROVAL_ID,
    ticketId,
    runId,
    agentId,
    title: 'Hermes runtime approval required',
    description: 'Paperclip captured a runtime evidence packet. Hermes needs human approval before external command execution.',
    status: 'pending',
    severity: 'medium',
    requestedAt: now,
    requestedBy: agentId,
    policy: 'human-approval-runtime-tool-call',
    auditTrail: [
      ...(existing?.auditTrail ?? []),
      { id: `audit-runtime-${runId}`, actorId: agentId, action: 'created Hermes runtime approval gate', createdAt: now },
    ],
  };
}

export function createRuntimeAdapters(mode: RuntimeMode = 'mock') {
  return {
    hermes: createHermesAdapter(mode),
    paperclip: createPaperclipAdapter(mode),
  };
}

export function startAgentRun(ticketId: string): RuntimeActionPlan {
  return {
    applyOptimistic: (data) => {
      const ticket = data.tickets.find((item) => item.id === ticketId);
      if (!ticket) return data;

      const task = mapTicketToHermesTask(ticket);
      const runId = ticket.runId ?? DEMO_RUN_ID;
      const existingRun = data.runs.find((item) => item.id === runId) ?? data.runs.find((item) => item.id === DEMO_RUN_ID);
      if (!existingRun) return data;

      const nextRun = createRuntimeRun({ ...existingRun, id: runId, ticketId: ticket.id, agentId: task.agentId }, task);
      const existingApproval = data.approvals.find((approval) => approval.id === ticket.approvalId || approval.runId === nextRun.id);
      const nextApproval = runtimeApproval(existingApproval, ticket.id, nextRun.id, task.agentId);
      persistRuntimeBundle(nextRun, nextApproval);
      appendRuntimeEvent({
        command: 'startAgentRun',
        entityType: 'run',
        entityId: nextRun.id,
        actorId: task.agentId,
        title: 'Hermes runtime persisted',
        status: 'success',
      });

      return {
        ...data,
        agents: data.agents.map((agent) => agent.id !== task.agentId ? agent : {
          ...agent,
          status: 'running',
          currentRunIds: agent.currentRunIds.includes(nextRun.id) ? agent.currentRunIds : [...agent.currentRunIds, nextRun.id],
          currentTicketIds: agent.currentTicketIds.includes(ticket.id) ? agent.currentTicketIds : [...agent.currentTicketIds, ticket.id],
        }),
        tickets: data.tickets.map((item) => item.id !== ticket.id ? item : {
          ...item,
          status: 'in_progress',
          runId: nextRun.id,
          approvalId: nextApproval.id,
          updatedAt: runtimeNow(),
        }),
        runs: upsertById(data.runs, nextRun),
        approvals: upsertById(data.approvals, nextApproval),
        activities: [
          activity(`activity-runtime-${ticket.id}`, 'Hermes runtime started', 'Hermes accepted a ticket and Paperclip generated an evidence packet.', ticket.id, nextRun.id),
          ...data.activities,
        ],
      };
    },
    async commit() {
      const task = fallbackTask(ticketId);
      await hermes.startTask(task);
      await paperclip.createArtifact({
        runId: ticketId === DEMO_TICKET_ID ? DEMO_RUN_ID : `run-${ticketId}-hermes`,
        type: 'report',
        name: 'Paperclip_QA_Runtime_Packet.md',
      });
    },
  };
}

export function applyRunCommand(runId: string, command: RuntimeRunCommand): RuntimeActionPlan {
  return {
    applyOptimistic: (data) => {
      let nextLifecycle: RuntimeLifecycle = 'RUNNING';
      const nextData = {
        ...data,
        runs: data.runs.map((run) => {
        if (run.id !== runId) return run;
        const status: RunStatus = command === 'pause' ? 'paused' : command === 'cancel' ? 'failed' : 'running';
        nextLifecycle = command === 'pause' ? 'WAITING_APPROVAL' : command === 'cancel' ? 'FAILED' : 'RUNNING';
        const currentStep = command === 'pause'
          ? 'Paused at Hermes checkpoint'
          : command === 'cancel'
            ? 'Cancelled by operator'
            : command === 'retry'
              ? 'Retrying Hermes execution'
              : 'Resumed Hermes execution';
        return {
          ...run,
          status,
          currentStep,
          logs: [runtimeLog(`runtime-log-${command}`, `Hermes ${command} command queued`, command === 'cancel' ? 'warn' : 'info'), ...run.logs],
        };
      }),
      };
      const nextRun = nextData.runs.find((run) => run.id === runId);
      if (nextRun) {
        upsertRun(nextRun, nextLifecycle);
        appendRuntimeEvent({
          command: command === 'pause' ? 'pauseRun' : command === 'resume' ? 'resumeRun' : command === 'retry' ? 'retryRun' : 'cancelAgentRun',
          entityType: 'run',
          entityId: runId,
          actorId: nextRun.agentId,
          title: `Runtime ${command} persisted`,
          status: 'success',
        });
      } else {
        setRunLifecycle(runId, nextLifecycle);
      }
      return nextData;
    },
    async commit() {
      await hermes.sendRunCommand(runId, command);
    },
  };
}

export function pauseAgentRun(runId: string) {
  return applyRunCommand(runId, 'pause');
}

export function resumeAgentRun(runId: string) {
  return applyRunCommand(runId, 'resume');
}

export function retryAgentRun(runId: string) {
  return applyRunCommand(runId, 'retry');
}

export function cancelAgentRun(runId: string) {
  return applyRunCommand(runId, 'cancel');
}

export function approveRunAction(approvalId: string): RuntimeActionPlan {
  return decisionAction(approvalId, 'approved');
}

export function rejectRunAction(approvalId: string): RuntimeActionPlan {
  return decisionAction(approvalId, 'rejected');
}

function decisionAction(approvalId: string, outcome: RuntimeDecisionOutcome): RuntimeActionPlan {
  return {
    applyOptimistic: (data) => data,
    async commit() {
      const command = outcome === 'approved' ? 'resume' : 'pause';
      await hermes.sendRunCommand(approvalId, command);
      const approval = getApprovalById(approvalId);
      if (!approval) return;
      const decidedAt = runtimeNow();
      upsertApproval({
        ...approval,
        status: outcome,
        decision: {
          decidedAt,
          decidedBy: approval.requestedBy,
          outcome,
          note: 'Runtime approval reconciled after mock Hermes mutation.',
        },
        auditTrail: [
          ...approval.auditTrail,
          {
            id: `audit-runtime-decision-${approval.id}-${decidedAt}`,
            actorId: approval.requestedBy,
            action: outcome === 'approved' ? 'approved runtime action' : 'rejected runtime action',
            createdAt: decidedAt,
          },
        ],
      });
      if (approval.runId) {
        setRunLifecycle(approval.runId, outcome === 'approved' ? 'APPROVED' : 'REJECTED');
      }
    },
  };
}

export function executionToRuntimeResult(execution: HermesExecution) {
  return {
    runId: execution.id,
    status: execution.status,
    message: execution.currentStep,
  };
}
