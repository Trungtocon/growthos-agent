import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/worker-observability-smoke.json');
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
    const { createPlanForTicket, startStreamingRun, nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const { isStreamComplete } = await import('/src/runtime-store/stream-store.ts');

    resetRuntimeState(); resetWorkflowState(); clearRunPlans(); resetUsageLedgerStore(); clearArtifactRegistry(); clearExecutionTimelineStore();
    clearRunEvaluationStore(); clearEvaluationFeedbackStore(); clearFeedbackActionPlanStore(); clearActionPlanExecutionStore();
    clearImprovementOutcomeStore(); clearLearningMemoryStore(); clearRecommendationExecutionStore(); clearImprovementLoopStore();
    clearImprovementLoopGovernanceStore(); clearImprovementLoopQueueStore(); clearImprovementLoopWorkerStore(); clearWorkerObservabilityStore(); disableGlobalLoopKillSwitch();

    createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
    await startStreamingRun('ticket-audit-module-3');
    for (let guard = 0; guard < 24 && !isStreamComplete(id); guard += 1) await nextStreamTick(id);
    buildTimelineForRun(id);
    const feedback = generateFeedbackForRun(id);
    const plan = createActionPlanFromFeedback(feedback.id);
    const execution = startActionPlanExecution(plan.id);
    completeActionTask(execution.tasks[0].taskId, { type: 'note', title: 'Worker observability fixture', description: 'Completed task.', createdBy: 'Smoke test' });
    const baseOutcome = createOutcomeVerification(execution.id);

    const syntheticOutcome = (suffix, dimensions, status = 'improved') => ({
      ...baseOutcome,
      id: `improvement-outcome-observability-${suffix}`,
      actionExecutionId: `observability-${suffix}-action`,
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
      evidence: [{ id: `outcome-evidence-observability-${suffix}`, outcomeId: `improvement-outcome-observability-${suffix}`, type: 'metric_delta', title: 'Worker observability evidence', description: suffix, createdAt: new Date().toISOString() }],
      regressions: [],
      updatedAt: new Date().toISOString(),
    });
    const raw = window.sessionStorage.getItem('uikigai-improvement-outcome-v1');
    const state = raw ? JSON.parse(raw) : { outcomes: {}, updatedAt: new Date().toISOString() };
    const specs = {
      active: syntheticOutcome('active', ['artifact_quality']),
      block: syntheticOutcome('block', ['replay_integrity'], 'regressed'),
      review: syntheticOutcome('review', ['approval_compliance'], 'regressed'),
      retry: syntheticOutcome('retry', ['cost_efficiency'], 'regressed'),
      requeue: syntheticOutcome('requeue', ['tool_success']),
    };
    Object.values(specs).forEach((outcome) => { state.outcomes[outcome.id] = outcome; });
    window.sessionStorage.setItem('uikigai-improvement-outcome-v1', JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
    const makeRecommendation = (outcome, delta = 0) => {
      const recommendation = markRecommendationAccepted(generateRecommendationFromSignal(createLearningSignalFromOutcome(outcome.id).id).id);
      return delta ? updateRecommendationConfidence(recommendation.id, delta).id : recommendation.id;
    };
    return {
      active: makeRecommendation(specs.active),
      block: makeRecommendation(specs.block, -90),
      review: makeRecommendation(specs.review),
      retry: makeRecommendation(specs.retry),
      requeue: makeRecommendation(specs.requeue),
    };
  }, runId);
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const rows = [];
  try {
    await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
    const ids = await prepareRuntime(page);
    await page.goto(`${baseUrl}/worker-control`, { waitUntil: 'networkidle' });
    await page.locator('[data-worker-control-route]').waitFor({ timeout: 10000 });

    await expectStep(rows, 'observation dashboard builds from worker state', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const { runWorkerTick } = await import('/src/runtime/improvement-loop-worker-store.ts');
        const { getWorkerObservationDashboard } = await import('/src/runtime/worker-observability-store.ts');
        enqueueImprovementLoop(recommendationId, 'normal');
        runWorkerTick();
        return getWorkerObservationDashboard();
      }, ids.active);
      assert(result.observation.status === 'executing', `expected executing, got ${result.observation.status}`);
      assert(result.activeQueueItem?.status === 'running', 'active queue item was not running');
      return { workerStatus: result.observation.status, queueStatus: result.activeQueueItem.status };
    });

    await expectStep(rows, 'active queue item is visible', async () => {
      const text = await page.locator('[data-worker-active-queue-item]').innerText();
      assert(text.includes('queue'), 'active queue item panel did not render queue content');
      return { rendered: true };
    });

    await expectStep(rows, 'heartbeat status is calculated', async () => {
      const result = await page.evaluate(async () => {
        const { recordWorkerHeartbeat } = await import('/src/runtime/improvement-loop-worker-store.ts');
        const { getWorkerHealthSnapshot } = await import('/src/runtime/worker-observability-store.ts');
        recordWorkerHeartbeat();
        return getWorkerHealthSnapshot();
      });
      assert(['healthy', 'warning', 'breached'].includes(result.slaStatus), 'invalid SLA status');
      return { slaStatus: result.slaStatus, heartbeatAgeMs: result.heartbeatAgeMs };
    });

    await expectStep(rows, 'stale worker warning appears', async () => {
      const result = await page.evaluate(async () => {
        const { recoverStaleWorker } = await import('/src/runtime/improvement-loop-worker-store.ts');
        const { getWorkerHealthSnapshot } = await import('/src/runtime/worker-observability-store.ts');
        recoverStaleWorker(undefined, 0);
        return getWorkerHealthSnapshot();
      });
      assert(result.stale === true, 'stale worker was not detected');
      return { stale: result.stale, slaStatus: result.slaStatus };
    });

    await expectStep(rows, 'incident is recorded on failure', async () => {
      const result = await page.evaluate(async () => {
        const { recordWorkerIncident, getWorkerIncidents } = await import('/src/runtime/worker-observability-store.ts');
        recordWorkerIncident('execution_failed', 'Smoke failure incident.', undefined, 'error');
        return getWorkerIncidents();
      });
      assert(result.some((incident) => incident.reason === 'execution_failed'), 'failure incident not recorded');
      return { incidents: result.length };
    });

    await expectStep(rows, 'SLA breach is detected', async () => {
      const result = await page.evaluate(async () => {
        const { runWorkerTick } = await import('/src/runtime/improvement-loop-worker-store.ts');
        const { getWorkerObservationDashboard } = await import('/src/runtime/worker-observability-store.ts');
        for (let index = 0; index < 30; index += 1) runWorkerTick();
        return getWorkerObservationDashboard().health;
      });
      assert(['warning', 'breached'].includes(result.slaStatus), `expected warning/breached SLA, got ${result.slaStatus}`);
      return { slaStatus: result.slaStatus };
    });

    await expectStep(rows, 'pause action requires eligibility', async () => {
      const result = await page.evaluate(async () => {
        const { requestWorkerPause, getWorkerControlActions } = await import('/src/runtime/worker-observability-store.ts');
        const action = requestWorkerPause('Smoke pause.');
        return { action, actions: getWorkerControlActions() };
      });
      assert(['executed', 'rejected'].includes(result.action.status), 'pause did not return an eligibility result');
      return { status: result.action.status, count: result.actions.length };
    });

    await expectStep(rows, 'resume action updates control action log', async () => {
      const result = await page.evaluate(async () => {
        const { requestWorkerResume, getWorkerControlActions } = await import('/src/runtime/worker-observability-store.ts');
        const action = requestWorkerResume('Smoke resume.');
        return { action, actions: getWorkerControlActions().filter((candidate) => candidate.type === 'resume') };
      });
      assert(result.actions.length > 0, 'resume action was not logged');
      return { status: result.action.status, count: result.actions.length };
    });

    await expectStep(rows, 'kill action writes audit event', async () => {
      const result = await page.evaluate(async () => {
        const { requestWorkerKill, getWorkerControlActions, getWorkerIncidents } = await import('/src/runtime/worker-observability-store.ts');
        const action = requestWorkerKill('Smoke kill.');
        return { action, incidents: getWorkerIncidents(), actions: getWorkerControlActions().filter((candidate) => candidate.type === 'kill') };
      });
      assert(result.action.status === 'executed', 'kill action was not executed');
      assert(result.incidents.some((incident) => incident.severity === 'critical'), 'kill action did not record critical incident');
      return { status: result.action.status, count: result.actions.length };
    });

    await expectStep(rows, 'retry action respects retry policy', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { disableGlobalLoopKillSwitch } = await import('/src/runtime/improvement-loop-governance-store.ts');
        const { enqueueImprovementLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const { executeNextQueueItem, failWorkerRun } = await import('/src/runtime/improvement-loop-worker-store.ts');
        const { requestWorkerRetryNow } = await import('/src/runtime/worker-observability-store.ts');
        disableGlobalLoopKillSwitch();
        enqueueImprovementLoop(recommendationId, 'normal');
        executeNextQueueItem();
        failWorkerRun();
        return requestWorkerRetryNow('Smoke retry.');
      }, ids.retry);
      assert(['executed', 'rejected'].includes(result.status), 'retry did not produce a policy decision');
      return { status: result.status, blockedReason: result.blockedReason };
    });

    await expectStep(rows, 'skip action requires reason', async () => {
      const result = await page.evaluate(async () => {
        const { requestWorkerSkipItem } = await import('/src/runtime/worker-observability-store.ts');
        return requestWorkerSkipItem('');
      });
      assert(result.status === 'rejected' && result.blockedReason === 'missing_reason', 'skip without reason was not rejected');
      return { status: result.status, reason: result.blockedReason };
    });

    await expectStep(rows, 'requeue action updates queue state', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const { requestWorkerRequeueItem, getWorkerObservationDashboard } = await import('/src/runtime/worker-observability-store.ts');
        enqueueImprovementLoop(recommendationId, 'high');
        const action = requestWorkerRequeueItem('Smoke requeue.');
        return { action, dashboard: getWorkerObservationDashboard() };
      }, ids.requeue);
      assert(result.action.status === 'executed', `expected requeue executed, got ${result.action.status}`);
      return { status: result.action.status, queueStatus: result.dashboard.activeQueueItem?.status };
    });

    await expectStep(rows, 'diagnostics artifact is exported', async () => {
      const result = await page.evaluate(async () => {
        const { requestWorkerExportDiagnostics, getWorkerDiagnosticsArtifacts } = await import('/src/runtime/worker-observability-store.ts');
        const action = requestWorkerExportDiagnostics('Smoke export.');
        return { action, artifacts: getWorkerDiagnosticsArtifacts() };
      });
      assert(result.action.status === 'executed', 'diagnostic export action did not execute');
      assert(result.artifacts.includes('artifact-run-demo-module-3-worker-diagnostics-json'), 'diagnostics artifact missing');
      return { artifacts: result.artifacts.length };
    });

    await expectStep(rows, 'compact widgets render through selectors', async () => {
      await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
      const count = await page.locator('[data-worker-observability-widget="evaluation"]').count();
      assert(count > 0, 'evaluation compact worker observability widget missing');
      return { count };
    });

    await expectStep(rows, 'no duplicate control IDs', async () => {
      const result = await page.evaluate(async () => {
        const { getWorkerControlActions } = await import('/src/runtime/worker-observability-store.ts');
        const ids = getWorkerControlActions().map((action) => action.id);
        return { ids, unique: new Set(ids).size };
      });
      assert(result.ids.length === result.unique, 'duplicate worker control action IDs found');
      return { count: result.ids.length };
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
