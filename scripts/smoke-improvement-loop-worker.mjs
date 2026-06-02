import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/improvement-loop-worker-smoke.json');
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
    const { createPlanForTicket, startStreamingRun, nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const { isStreamComplete } = await import('/src/runtime-store/stream-store.ts');

    resetRuntimeState(); resetWorkflowState(); clearRunPlans(); resetUsageLedgerStore(); clearArtifactRegistry(); clearExecutionTimelineStore();
    clearRunEvaluationStore(); clearEvaluationFeedbackStore(); clearFeedbackActionPlanStore(); clearActionPlanExecutionStore();
    clearImprovementOutcomeStore(); clearLearningMemoryStore(); clearRecommendationExecutionStore(); clearImprovementLoopStore();
    clearImprovementLoopGovernanceStore(); clearImprovementLoopQueueStore(); clearImprovementLoopWorkerStore(); disableGlobalLoopKillSwitch();

    createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
    await startStreamingRun('ticket-audit-module-3');
    for (let guard = 0; guard < 24 && !isStreamComplete(id); guard += 1) await nextStreamTick(id);
    buildTimelineForRun(id);
    const feedback = generateFeedbackForRun(id);
    const plan = createActionPlanFromFeedback(feedback.id);
    const execution = startActionPlanExecution(plan.id);
    completeActionTask(execution.tasks[0].taskId, { type: 'note', title: 'Worker smoke fixture', description: 'Completed task.', createdBy: 'Smoke test' });
    const baseOutcome = createOutcomeVerification(execution.id);

    const syntheticOutcome = (suffix, dimensions, status = 'improved') => ({
      ...baseOutcome,
      id: `improvement-outcome-worker-${suffix}`,
      actionExecutionId: `worker-${suffix}-action`,
      status,
      targetDimensions: dimensions,
      comparison: {
        beforeRunId: id,
        afterRunId: `${id}-${suffix}`,
        beforeEvaluationId: `before-${suffix}`,
        afterEvaluationId: `after-${suffix}`,
        overallDelta: status === 'improved' ? 8 : -10,
        metricDeltas: dimensions.map((dimension) => ({ dimension, before: 79, after: status === 'improved' ? 91 : 56, delta: status === 'improved' ? 12 : -23, improved: status === 'improved' })),
        comparedAt: new Date().toISOString(),
      },
      evidence: [{ id: `outcome-evidence-worker-${suffix}`, outcomeId: `improvement-outcome-worker-${suffix}`, type: 'metric_delta', title: 'Worker smoke evidence', description: suffix, createdAt: new Date().toISOString() }],
      regressions: [],
      updatedAt: new Date().toISOString(),
    });
    const raw = window.sessionStorage.getItem('uikigai-improvement-outcome-v1');
    const state = raw ? JSON.parse(raw) : { outcomes: {}, updatedAt: new Date().toISOString() };
    const specs = {
      tick: syntheticOutcome('tick', ['tool_success']),
      block: syntheticOutcome('block', ['replay_integrity'], 'regressed'),
      approval: syntheticOutcome('approval', ['approval_compliance'], 'regressed'),
      allow: syntheticOutcome('allow', ['artifact_quality']),
      retry: syntheticOutcome('retry', ['cost_efficiency'], 'regressed'),
      complete: syntheticOutcome('complete', ['governance_compliance']),
      concurrency: syntheticOutcome('concurrency', ['overall_score']),
    };
    Object.values(specs).forEach((outcome) => { state.outcomes[outcome.id] = outcome; });
    window.sessionStorage.setItem('uikigai-improvement-outcome-v1', JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
    const makeRecommendation = (outcome, delta = 0) => {
      const recommendation = markRecommendationAccepted(generateRecommendationFromSignal(createLearningSignalFromOutcome(outcome.id).id).id);
      return delta ? updateRecommendationConfidence(recommendation.id, delta).id : recommendation.id;
    };
    return {
      tick: makeRecommendation(specs.tick),
      block: makeRecommendation(specs.block, -90),
      approval: makeRecommendation(specs.approval),
      allow: makeRecommendation(specs.allow),
      retry: makeRecommendation(specs.retry),
      complete: makeRecommendation(specs.complete),
      concurrency: makeRecommendation(specs.concurrency),
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
    await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
    await page.locator('[data-run-evaluation-route]').waitFor({ timeout: 10000 });
    let runningItemId;
    let retryItemId;

    await expectStep(rows, 'worker starts in idle state', async () => {
      const result = await page.evaluate(async () => {
        const { createImprovementLoopWorker, getImprovementLoopWorkerStatus } = await import('/src/runtime/improvement-loop-worker-store.ts');
        createImprovementLoopWorker();
        return getImprovementLoopWorkerStatus();
      });
      assert(result === 'idle', `expected idle, got ${result}`);
      return { status: result };
    });

    await expectStep(rows, 'worker tick reads next eligible queue item', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const { runWorkerTick, getActiveImprovementLoopWorker } = await import('/src/runtime/improvement-loop-worker-store.ts');
        enqueueImprovementLoop(recommendationId, 'normal');
        const tick = runWorkerTick();
        return { tick, worker: getActiveImprovementLoopWorker() };
      }, ids.tick);
      assert(result.worker?.status === 'executing', 'worker did not start executing eligible item');
      return { status: result.worker.status, item: result.worker.activeQueueItemId };
    });

    await expectStep(rows, 'kill switch prevents execution', async () => {
      const result = await page.evaluate(async () => {
        const { completeWorkerRun, runWorkerTick, getActiveImprovementLoopWorker } = await import('/src/runtime/improvement-loop-worker-store.ts');
        const { enableGlobalLoopKillSwitch } = await import('/src/runtime/improvement-loop-governance-store.ts');
        completeWorkerRun();
        enableGlobalLoopKillSwitch('Worker smoke kill switch.');
        runWorkerTick();
        return getActiveImprovementLoopWorker();
      });
      assert(result.status === 'paused' && result.blockedReason === 'kill_switch_enabled', 'kill switch did not pause worker');
      return { status: result.status, reason: result.blockedReason };
    });

    await expectStep(rows, 'governance BLOCK prevents execution', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { disableGlobalLoopKillSwitch } = await import('/src/runtime/improvement-loop-governance-store.ts');
        const { enqueueImprovementLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const { executeNextQueueItem } = await import('/src/runtime/improvement-loop-worker-store.ts');
        disableGlobalLoopKillSwitch();
        enqueueImprovementLoop(recommendationId, 'high');
        return executeNextQueueItem();
      }, ids.block);
      assert(result.status === 'blocked', 'governance block was not enforced');
      return { status: result.status, reason: result.reason };
    });

    await expectStep(rows, 'REQUIRE_REVIEW moves worker to waiting_approval', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const { executeNextQueueItem, getActiveImprovementLoopWorker } = await import('/src/runtime/improvement-loop-worker-store.ts');
        enqueueImprovementLoop(recommendationId, 'urgent');
        const execution = executeNextQueueItem();
        return { execution, worker: getActiveImprovementLoopWorker() };
      }, ids.approval);
      assert(result.execution.status === 'waiting_approval' && result.worker.status === 'waiting_approval', 'worker did not wait for approval');
      return { status: result.worker.status, reason: result.execution.reason };
    });

    await expectStep(rows, 'ALLOW starts queue item execution', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const { executeNextQueueItem, getActiveImprovementLoopWorker } = await import('/src/runtime/improvement-loop-worker-store.ts');
        enqueueImprovementLoop(recommendationId, 'normal');
        const execution = executeNextQueueItem();
        return { execution, worker: getActiveImprovementLoopWorker() };
      }, ids.allow);
      runningItemId = result.worker.activeQueueItemId;
      assert(result.execution.status === 'started' && result.worker.status === 'executing', 'allowed item did not execute');
      return { status: result.worker.status, item: runningItemId };
    });

    await expectStep(rows, 'worker respects max concurrency', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const { executeNextQueueItem } = await import('/src/runtime/improvement-loop-worker-store.ts');
        enqueueImprovementLoop(recommendationId, 'normal');
        return executeNextQueueItem();
      }, ids.concurrency);
      assert(result.status === 'skipped' && result.reason === 'concurrency_saturated', 'worker ignored max concurrency');
      return { status: result.status, reason: result.reason };
    });

    await expectStep(rows, 'worker records heartbeat', async () => {
      const result = await page.evaluate(async () => {
        const { recordWorkerHeartbeat, getWorkerHeartbeat } = await import('/src/runtime/improvement-loop-worker-store.ts');
        const heartbeat = recordWorkerHeartbeat();
        return { heartbeat, latest: getWorkerHeartbeat() };
      });
      assert(result.latest?.id === result.heartbeat.id, 'heartbeat was not persisted');
      return { heartbeat: result.heartbeat.id };
    });

    await expectStep(rows, 'worker detects stale heartbeat', async () => {
      const result = await page.evaluate(async () => {
        const { recoverStaleWorker, getStaleWorkerWarnings } = await import('/src/runtime/improvement-loop-worker-store.ts');
        const raw = window.sessionStorage.getItem('uikigai-improvement-loop-worker-v1');
        const state = raw ? JSON.parse(raw) : {};
        const workerId = state.activeWorkerId;
        state.workers[workerId].lastHeartbeatAt = new Date(Date.now() - 120000).toISOString();
        window.sessionStorage.setItem('uikigai-improvement-loop-worker-v1', JSON.stringify(state));
        recoverStaleWorker(workerId, 1);
        return getStaleWorkerWarnings();
      });
      assert(result.length > 0, 'stale heartbeat warning was not created');
      return { warnings: result.length };
    });

    await expectStep(rows, 'worker recovers stale worker state', async () => {
      const result = await page.evaluate(async () => {
        const { getActiveImprovementLoopWorker } = await import('/src/runtime/improvement-loop-worker-store.ts');
        return getActiveImprovementLoopWorker();
      });
      assert(result.status === 'paused' && result.blockedReason === 'stale_worker', 'stale worker not paused');
      return { status: result.status, reason: result.blockedReason };
    });

    await expectStep(rows, 'failed execution triggers retry', async () => {
      const result = await page.evaluate(async (itemId) => {
        const { failWorkerRun } = await import('/src/runtime/improvement-loop-worker-store.ts');
        return failWorkerRun(itemId, 'smoke_failure');
      }, runningItemId);
      retryItemId = result.queueItemId;
      assert(result.status === 'retrying', 'failed execution did not retry');
      return { status: result.status, reason: result.reason };
    });

    await expectStep(rows, 'retry exhaustion marks queue item failed', async () => {
      const result = await page.evaluate(async (itemId) => {
        const { failWorkerRun } = await import('/src/runtime/improvement-loop-worker-store.ts');
        failWorkerRun(itemId, 'smoke_failure_again');
        return failWorkerRun(itemId, 'smoke_failure_final');
      }, retryItemId);
      assert(result.status === 'failed' && result.reason === 'retry_exhausted', 'retry exhaustion did not fail item');
      return { status: result.status, reason: result.reason };
    });

    await expectStep(rows, 'completed execution marks queue item completed', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const { executeNextQueueItem, completeWorkerRun } = await import('/src/runtime/improvement-loop-worker-store.ts');
        const item = enqueueImprovementLoop(recommendationId, 'normal');
        executeNextQueueItem();
        return completeWorkerRun(item.id);
      }, ids.complete);
      assert(result.status === 'completed', 'worker completion did not complete queue item');
      return { status: result.status };
    });

    await expectStep(rows, 'worker exports status artifacts', async () => {
      const result = await page.evaluate(async () => {
        const { exportImprovementLoopWorkerArtifacts } = await import('/src/runtime/improvement-loop-worker-store.ts');
        return exportImprovementLoopWorkerArtifacts().map((artifact) => artifact.name);
      });
      const required = ['improvement-worker-status.json', 'improvement-worker-summary.md', 'improvement-worker-tick-log.json', 'improvement-worker-failure-report.md', 'improvement-worker-recovery-report.md'];
      assert(required.every((name) => result.includes(name)), 'missing worker export');
      return { exports: result.length };
    });

    await expectStep(rows, 'UI selectors expose worker summary', async () => {
      await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
      const widget = page.locator('[data-improvement-loop-worker-widget="evaluation"]');
      await widget.waitFor({ timeout: 5000 });
      const status = await widget.getAttribute('data-loop-worker-status');
      const results = Number(await widget.getAttribute('data-loop-worker-results'));
      assert(Boolean(status) && results > 0, 'worker compact widget did not expose summary');
      return { status, results };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const passed = rows.filter((row) => row.status === 'passed').length;
  writeJson(reportPath, { generatedAt: new Date().toISOString(), passed, total: rows.length, rows });
  if (passed !== rows.length) {
    console.table(rows);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
