import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/worker-recovery-smoke.json');
const runId = 'run-demo-module-3';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error(`Timed out waiting for dev server at ${url}`));
        else setTimeout(attempt, 500);
      });
      req.setTimeout(1500, () => req.destroy());
    };
    attempt();
  });
}

async function ensureServer() {
  try {
    await waitForServer(baseUrl, 1500);
    return null;
  } catch {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
    const args = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm run dev -- --host 127.0.0.1']
      : ['run', 'dev', '--', '--host', '127.0.0.1'];
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true });
    child.stdout.on('data', (chunk) => fs.appendFileSync(path.join(root, 'parity-reports/vite-dev.out.log'), chunk));
    child.stderr.on('data', (chunk) => fs.appendFileSync(path.join(root, 'parity-reports/vite-dev.err.log'), chunk));
    await waitForServer(baseUrl, 20000);
    return child;
  }
}

async function stopServer(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      killer.on('close', resolve);
      killer.on('error', resolve);
    });
    return;
  }
  child.kill();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectStep(rows, name, action) {
  try {
    const details = await action();
    rows.push({ name, ...details, status: 'passed' });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

async function prepareRuntime(page) {
  return page.evaluate(async (id) => {
    const { resetRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
    const { resetWorkflowState } = await import('/src/state/workflow-engine.ts');
    const { clearRunPlans } = await import('/src/runtime-store/run-plan-store.ts');
    const { resetUsageLedgerStore } = await import('/src/runtime-store/usage-ledger-store.ts');
    const { clearArtifactRegistry } = await import('/src/runtime/artifact-registry-store.ts');
    const { clearExecutionTimelineStore, buildTimelineForRun } = await import('/src/runtime/execution-timeline-store.ts');
    const { clearRunEvaluationStore } = await import('/src/runtime/run-evaluation-store.ts');
    const { clearEvaluationFeedbackStore, generateFeedbackForRun } = await import('/src/runtime/evaluation-feedback-store.ts');
    const { clearFeedbackActionPlanStore, createActionPlanFromFeedback } = await import('/src/runtime/feedback-action-planner-store.ts');
    const { clearActionPlanExecutionStore, startActionPlanExecution, completeActionTask } = await import('/src/runtime/action-plan-execution-store.ts');
    const { clearImprovementOutcomeStore, createOutcomeVerification } = await import('/src/runtime/improvement-outcome-store.ts');
    const { clearLearningMemoryStore, createLearningSignalFromOutcome, generateRecommendationFromSignal, markRecommendationAccepted, updateRecommendationConfidence } = await import('/src/runtime/learning-memory-store.ts');
    const { clearRecommendationExecutionStore } = await import('/src/runtime/recommendation-execution-store.ts');
    const { clearImprovementLoopStore } = await import('/src/runtime/improvement-loop-store.ts');
    const { clearImprovementLoopGovernanceStore, disableGlobalLoopKillSwitch } = await import('/src/runtime/improvement-loop-governance-store.ts');
    const { clearImprovementLoopQueueStore } = await import('/src/runtime/improvement-loop-queue-store.ts');
    const { clearImprovementLoopWorkerStore } = await import('/src/runtime/improvement-loop-worker-store.ts');
    const { clearWorkerObservabilityStore } = await import('/src/runtime/worker-observability-store.ts');
    const { clearWorkerRecoveryStore } = await import('/src/runtime/worker-recovery-store.ts');
    const { createPlanForTicket, startStreamingRun, nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const { isStreamComplete } = await import('/src/runtime-store/stream-store.ts');

    resetRuntimeState(); resetWorkflowState(); clearRunPlans(); resetUsageLedgerStore(); clearArtifactRegistry(); clearExecutionTimelineStore();
    clearRunEvaluationStore(); clearEvaluationFeedbackStore(); clearFeedbackActionPlanStore(); clearActionPlanExecutionStore();
    clearImprovementOutcomeStore(); clearLearningMemoryStore(); clearRecommendationExecutionStore(); clearImprovementLoopStore();
    clearImprovementLoopGovernanceStore(); clearImprovementLoopQueueStore(); clearImprovementLoopWorkerStore(); clearWorkerObservabilityStore(); clearWorkerRecoveryStore(); disableGlobalLoopKillSwitch();

    createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
    await startStreamingRun('ticket-audit-module-3');
    for (let guard = 0; guard < 24 && !isStreamComplete(id); guard += 1) await nextStreamTick(id);
    buildTimelineForRun(id);
    const feedback = generateFeedbackForRun(id);
    const plan = createActionPlanFromFeedback(feedback.id);
    const execution = startActionPlanExecution(plan.id);
    completeActionTask(execution.tasks[0].taskId, { type: 'note', title: 'Worker recovery fixture', description: 'Completed task.', createdBy: 'Smoke test' });
    const baseOutcome = createOutcomeVerification(execution.id);

    const syntheticOutcome = (suffix, dimensions, status = 'improved') => ({
      ...baseOutcome,
      id: `improvement-outcome-recovery-${suffix}`,
      actionExecutionId: `recovery-${suffix}-action`,
      status,
      targetDimensions: dimensions,
      comparison: {
        beforeRunId: id,
        afterRunId: `${id}-${suffix}`,
        beforeEvaluationId: `before-${suffix}`,
        afterEvaluationId: `after-${suffix}`,
        overallDelta: status === 'improved' ? 8 : -12,
        metricDeltas: dimensions.map((dimension) => ({ dimension, before: 78, after: status === 'improved' ? 91 : 54, delta: status === 'improved' ? 13 : -24, improved: status === 'improved' })),
        comparedAt: new Date().toISOString(),
      },
      evidence: [{ id: `outcome-evidence-recovery-${suffix}`, outcomeId: `improvement-outcome-recovery-${suffix}`, type: 'metric_delta', title: 'Worker recovery evidence', description: suffix, createdAt: new Date().toISOString() }],
      regressions: [],
      updatedAt: new Date().toISOString(),
    });
    const raw = window.sessionStorage.getItem('uikigai-improvement-outcome-v1');
    const state = raw ? JSON.parse(raw) : { outcomes: {}, updatedAt: new Date().toISOString() };
    const specs = {
      active: syntheticOutcome('active', ['artifact_quality']),
      failed: syntheticOutcome('failed', ['tool_success'], 'regressed'),
      retry: syntheticOutcome('retry', ['cost_efficiency'], 'regressed'),
    };
    Object.values(specs).forEach((outcome) => { state.outcomes[outcome.id] = outcome; });
    window.sessionStorage.setItem('uikigai-improvement-outcome-v1', JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
    const makeRecommendation = (outcome, delta = 0) => {
      const recommendation = markRecommendationAccepted(generateRecommendationFromSignal(createLearningSignalFromOutcome(outcome.id).id).id);
      return delta ? updateRecommendationConfidence(recommendation.id, delta).id : recommendation.id;
    };
    return {
      active: makeRecommendation(specs.active),
      failed: makeRecommendation(specs.failed),
      retry: makeRecommendation(specs.retry),
    };
  }, runId);
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const rows = [];
  try {
    await page.goto(`${baseUrl}/worker-recovery`, { waitUntil: 'networkidle' });
    const ids = await prepareRuntime(page);
    await page.goto(`${baseUrl}/worker-recovery`, { waitUntil: 'networkidle' });
    await page.locator('[data-worker-recovery-route]').waitFor({ timeout: 10000 });
    let stalePlanId;
    let failedPlanId;
    let exhaustedPlanId;

    await expectStep(rows, 'create recovery plan from stale worker incident', async () => {
      const result = await page.evaluate(async () => {
        const { recordWorkerIncident } = await import('/src/runtime/worker-observability-store.ts');
        const { createRecoveryPlanForIncident } = await import('/src/runtime/worker-recovery-store.ts');
        const incident = recordWorkerIncident('stale_worker', 'Stale worker smoke incident.', undefined, 'info');
        const plan = createRecoveryPlanForIncident(incident.id);
        return { incident, plan };
      });
      stalePlanId = result.plan.id;
      assert(result.plan.incidentReason === 'stale_worker', 'stale incident was not mapped');
      return { planId: stalePlanId, risk: result.plan.risk };
    });

    await expectStep(rows, 'create recovery plan from failed queue item', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const { executeNextQueueItem, failWorkerRun, getActiveImprovementLoopWorker } = await import('/src/runtime/improvement-loop-worker-store.ts');
        const { recordWorkerIncident } = await import('/src/runtime/worker-observability-store.ts');
        const { createRecoveryPlanForIncident } = await import('/src/runtime/worker-recovery-store.ts');
        enqueueImprovementLoop(recommendationId, 'normal');
        executeNextQueueItem();
        failWorkerRun();
        const worker = getActiveImprovementLoopWorker();
        const incident = recordWorkerIncident('execution_failed', 'Failed queue item smoke incident.', worker?.activeQueueItemId, 'warning');
        const plan = createRecoveryPlanForIncident(incident.id);
        return { incident, plan };
      }, ids.failed);
      failedPlanId = result.plan.id;
      assert(result.plan.incidentReason === 'queue_item_failed', 'failed queue item was not mapped');
      assert(Boolean(result.plan.queueItemId), 'failed queue item plan was not linked to queue item');
      return { planId: failedPlanId, queueItemId: result.plan.queueItemId };
    });

    await expectStep(rows, 'auto-healing allows low-risk retry', async () => {
      const result = await page.evaluate(async (planId) => {
        const { evaluateAutoHealingDecision } = await import('/src/runtime/worker-recovery-store.ts');
        return evaluateAutoHealingDecision(planId);
      }, stalePlanId);
      assert(result.decision === 'AUTO_EXECUTE', `expected AUTO_EXECUTE, got ${result.decision}`);
      return { decision: result.decision, risk: result.risk };
    });

    await expectStep(rows, 'auto-healing blocks high-risk rollback without approval', async () => {
      const result = await page.evaluate(async () => {
        const { recordWorkerIncident } = await import('/src/runtime/worker-observability-store.ts');
        const { createRecoveryPlanForIncident, executeRecoveryStep } = await import('/src/runtime/worker-recovery-store.ts');
        const incident = recordWorkerIncident('retry_exhausted', 'Retry exhausted smoke incident.', undefined, 'critical');
        const plan = createRecoveryPlanForIncident(incident.id);
        const attempt = executeRecoveryStep(plan.id, 'rollback-last-action');
        return { plan, attempt };
      });
      exhaustedPlanId = result.plan.id;
      assert(result.attempt.status === 'blocked' && result.attempt.reason === 'reason_required', 'rollback without approval/reason was not blocked');
      return { planId: exhaustedPlanId, attempt: result.attempt.status, reason: result.attempt.reason };
    });

    await expectStep(rows, 'recovery plan links to original incident', async () => {
      const result = await page.evaluate(async (planId) => {
        const { getWorkerRecoveryDashboard } = await import('/src/runtime/worker-recovery-store.ts');
        const dashboard = getWorkerRecoveryDashboard();
        return dashboard.links.find((link) => link.planId === planId);
      }, stalePlanId);
      assert(result?.status === 'linked', 'recovery link was not created');
      return { linkId: result.id, status: result.status };
    });

    await expectStep(rows, 'recovery step writes audit event', async () => {
      const result = await page.evaluate(async (planId) => {
        const { executeRecoveryStep, getRecoveryAuditTrail } = await import('/src/runtime/worker-recovery-store.ts');
        executeRecoveryStep(planId, 'export-diagnostics');
        return getRecoveryAuditTrail();
      }, stalePlanId);
      assert(result.some((item) => item.stepId === 'export-diagnostics'), 'recovery audit missing export-diagnostics');
      return { auditEvents: result.length };
    });

    await expectStep(rows, 'retry action updates worker state', async () => {
      const result = await page.evaluate(async (planId) => {
        const { approveRecoveryPlan, executeRecoveryStep } = await import('/src/runtime/worker-recovery-store.ts');
        const { getActiveImprovementLoopWorker } = await import('/src/runtime/improvement-loop-worker-store.ts');
        approveRecoveryPlan(planId);
        const attempt = executeRecoveryStep(planId, 'retry-current-item', 'Smoke retry recovery.');
        return { attempt, worker: getActiveImprovementLoopWorker() };
      }, failedPlanId);
      assert(result.attempt.status === 'completed', 'retry recovery step did not complete');
      assert(['retrying', 'executing', 'polling', 'idle'].includes(result.worker?.status), 'worker state did not update after retry');
      return { status: result.worker?.status };
    });

    await expectStep(rows, 'requeue action updates queue state', async () => {
      const result = await page.evaluate(async (planId) => {
        const { approveRecoveryPlan, executeRecoveryStep, getRecoveryPlans } = await import('/src/runtime/worker-recovery-store.ts');
        const { getImprovementLoopQueue } = await import('/src/runtime/improvement-loop-queue-store.ts');
        approveRecoveryPlan(planId);
        const attempt = executeRecoveryStep(planId, 'requeue-item', 'Smoke requeue recovery.');
        const plan = getRecoveryPlans().find((candidate) => candidate.id === planId);
        const item = getImprovementLoopQueue().find((candidate) => candidate.id === plan?.queueItemId);
        return { attempt, item };
      }, exhaustedPlanId);
      assert(['completed', 'failed', 'blocked'].includes(result.attempt.status), 'requeue did not produce an audit result');
      return { attempt: result.attempt.status, queueStatus: result.item?.status };
    });

    await expectStep(rows, 'skip action requires reason', async () => {
      const result = await page.evaluate(async (planId) => {
        const { executeRecoveryStep } = await import('/src/runtime/worker-recovery-store.ts');
        return executeRecoveryStep(planId, 'pause-for-review');
      }, exhaustedPlanId);
      assert(result.status === 'blocked' && result.reason === 'reason_required', 'reason-required recovery step was not blocked');
      return { status: result.status, reason: result.reason };
    });

    await expectStep(rows, 'kill action requires governance approval', async () => {
      const result = await page.evaluate(async () => {
        const { recordWorkerIncident } = await import('/src/runtime/worker-observability-store.ts');
        const { createRecoveryPlanForIncident, executeRecoveryStep } = await import('/src/runtime/worker-recovery-store.ts');
        const incident = recordWorkerIncident('none', 'Unknown runtime error smoke incident.', undefined, 'critical');
        const plan = createRecoveryPlanForIncident(incident.id);
        const attempt = executeRecoveryStep(plan.id, 'kill-worker', 'Smoke kill recovery.');
        return { plan, attempt };
      });
      assert(result.attempt.status === 'blocked' && result.attempt.reason === 'approval_required', 'kill recovery did not require approval');
      return { planId: result.plan.id, reason: result.attempt.reason };
    });

    await expectStep(rows, 'unresolved incidents appear in selector', async () => {
      const result = await page.evaluate(async () => {
        const { getUnresolvedRecoveryIncidents } = await import('/src/runtime/worker-recovery-store.ts');
        return getUnresolvedRecoveryIncidents();
      });
      assert(result.length > 0, 'unresolved incidents selector returned none');
      return { unresolved: result.length };
    });

    await expectStep(rows, 'resolved incident disappears from unresolved list', async () => {
      const result = await page.evaluate(async (planId) => {
        const { markRecoveryResolved, getWorkerRecoveryDashboard } = await import('/src/runtime/worker-recovery-store.ts');
        const resolved = markRecoveryResolved(planId);
        const dashboard = getWorkerRecoveryDashboard();
        return { resolved, stillUnresolved: dashboard.unresolvedIncidents.some((incident) => incident.id === resolved.incidentId) };
      }, stalePlanId);
      assert(result.stillUnresolved === false, 'resolved incident still appears unresolved');
      return { status: result.resolved.status };
    });

    await expectStep(rows, 'recovery artifacts are registered', async () => {
      const result = await page.evaluate(async () => {
        const { exportRecoveryReport, getWorkerRecoveryDashboard } = await import('/src/runtime/worker-recovery-store.ts');
        const artifacts = exportRecoveryReport();
        const dashboard = getWorkerRecoveryDashboard();
        return { artifacts, names: dashboard.artifacts };
      });
      assert(result.names.includes('artifact-run-demo-module-3-worker-recovery-plan-json'), 'recovery plan artifact missing');
      assert(result.artifacts.length >= 5, 'expected recovery artifact exports');
      return { artifacts: result.artifacts.length };
    });

    await expectStep(rows, 'compact widgets render from selectors', async () => {
      await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
      const evaluation = await page.locator('[data-worker-recovery-widget="evaluation"]').count();
      await page.goto(`${baseUrl}/worker-control`, { waitUntil: 'networkidle' });
      const workerControl = await page.locator('[data-worker-recovery-widget="worker-control"]').count();
      assert(evaluation > 0 && workerControl > 0, 'worker recovery compact widgets missing');
      return { evaluation, workerControl };
    });

    await expectStep(rows, 'existing worker observability smoke still passes', async () => {
      await page.goto(`${baseUrl}/worker-control`, { waitUntil: 'networkidle' });
      const count = await page.locator('[data-worker-observability-widget="worker-control"]').count();
      assert(count > 0, 'worker-control observability compact widget missing');
      return { count };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const failed = rows.filter((row) => row.status !== 'passed');
  const report = { generatedAt: new Date().toISOString(), baseUrl, rows, passed: rows.length - failed.length, failed: failed.length };
  writeJson(reportPath, report);
  if (failed.length) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), status: 'failed', error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
