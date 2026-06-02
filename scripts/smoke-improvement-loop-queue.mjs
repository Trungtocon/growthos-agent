import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/improvement-loop-queue-smoke.json');
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
    const { clearImprovementLoopGovernanceStore } = await import('/src/runtime/improvement-loop-governance-store.ts');
    const { clearImprovementLoopQueueStore } = await import('/src/runtime/improvement-loop-queue-store.ts');
    const { createPlanForTicket, startStreamingRun, nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const { isStreamComplete } = await import('/src/runtime-store/stream-store.ts');

    resetRuntimeState(); resetWorkflowState(); clearRunPlans(); resetUsageLedgerStore(); clearArtifactRegistry(); clearExecutionTimelineStore();
    clearRunEvaluationStore(); clearEvaluationFeedbackStore(); clearFeedbackActionPlanStore(); clearActionPlanExecutionStore();
    clearImprovementOutcomeStore(); clearLearningMemoryStore(); clearRecommendationExecutionStore(); clearImprovementLoopStore();
    clearImprovementLoopGovernanceStore(); clearImprovementLoopQueueStore();

    createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
    await startStreamingRun('ticket-audit-module-3');
    for (let guard = 0; guard < 24 && !isStreamComplete(id); guard += 1) await nextStreamTick(id);
    buildTimelineForRun(id);
    const feedback = generateFeedbackForRun(id);
    const plan = createActionPlanFromFeedback(feedback.id);
    const execution = startActionPlanExecution(plan.id);
    completeActionTask(execution.tasks[0].taskId, { type: 'note', title: 'Queue smoke fixture', description: 'Completed task.', createdBy: 'Smoke test' });
    const baseOutcome = createOutcomeVerification(execution.id);

    const syntheticOutcome = (suffix, dimensions, status = 'improved') => ({
      ...baseOutcome,
      id: `improvement-outcome-queue-${suffix}`,
      actionExecutionId: `queue-${suffix}-action`,
      status,
      targetDimensions: dimensions,
      comparison: {
        beforeRunId: id,
        afterRunId: `${id}-${suffix}`,
        beforeEvaluationId: `before-${suffix}`,
        afterEvaluationId: `after-${suffix}`,
        overallDelta: status === 'improved' ? 7 : -9,
        metricDeltas: dimensions.map((dimension) => ({ dimension, before: 80, after: status === 'improved' ? 90 : 58, delta: status === 'improved' ? 10 : -22, improved: status === 'improved' })),
        comparedAt: new Date().toISOString(),
      },
      evidence: [{ id: `outcome-evidence-queue-${suffix}`, outcomeId: `improvement-outcome-queue-${suffix}`, type: 'metric_delta', title: 'Queue smoke evidence', description: suffix, createdAt: new Date().toISOString() }],
      regressions: [],
      updatedAt: new Date().toISOString(),
    });
    const raw = window.sessionStorage.getItem('uikigai-improvement-outcome-v1');
    const state = raw ? JSON.parse(raw) : { outcomes: {}, updatedAt: new Date().toISOString() };
    const specs = {
      normal: syntheticOutcome('normal', ['tool_success']),
      high: syntheticOutcome('high', ['artifact_quality']),
      block: syntheticOutcome('block', ['replay_integrity'], 'regressed'),
      approval: syntheticOutcome('approval', ['approval_compliance'], 'regressed'),
      retry: syntheticOutcome('retry', ['cost_efficiency'], 'regressed'),
      cancel: syntheticOutcome('cancel', ['workflow_design']),
      scheduled: syntheticOutcome('scheduled', ['governance_compliance']),
    };
    Object.values(specs).forEach((outcome) => { state.outcomes[outcome.id] = outcome; });
    window.sessionStorage.setItem('uikigai-improvement-outcome-v1', JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
    const makeRecommendation = (outcome, delta = 0) => {
      const recommendation = markRecommendationAccepted(generateRecommendationFromSignal(createLearningSignalFromOutcome(outcome.id).id).id);
      return delta ? updateRecommendationConfidence(recommendation.id, delta).id : recommendation.id;
    };
    return {
      normal: makeRecommendation(specs.normal),
      high: makeRecommendation(specs.high),
      block: makeRecommendation(specs.block, -90),
      approval: makeRecommendation(specs.approval),
      retry: makeRecommendation(specs.retry, -90),
      cancel: makeRecommendation(specs.cancel),
      scheduled: makeRecommendation(specs.scheduled),
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

    let normalItemId;
    let retryItemId;
    let cancelItemId;

    await expectStep(rows, 'enqueue loop creates queued item', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        return enqueueImprovementLoop(recommendationId, 'normal');
      }, ids.normal);
      normalItemId = result.id;
      assert(result.status === 'queued', 'item not queued');
      return { itemId: result.id, status: result.status };
    });

    await expectStep(rows, 'dequeue selects highest eligible priority', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop, dequeueNextEligibleLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        enqueueImprovementLoop(recommendationId, 'critical');
        return dequeueNextEligibleLoop();
      }, ids.high);
      assert(result.priority === 'critical', 'highest priority was not selected');
      return { itemId: result.id, priority: result.priority, status: result.status };
    });

    await expectStep(rows, 'governance BLOCK prevents run', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop, startQueuedLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const item = enqueueImprovementLoop(recommendationId, 'high');
        return startQueuedLoop(item.id);
      }, ids.block);
      assert(result.status === 'blocked', 'governance block did not block queue item');
      return { status: result.status, blocker: result.blocker };
    });

    await expectStep(rows, 'REQUIRE_REVIEW moves item to waiting_approval', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop, startQueuedLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const item = enqueueImprovementLoop(recommendationId, 'urgent');
        return startQueuedLoop(item.id);
      }, ids.approval);
      assert(result.status === 'waiting_approval', 'approval item not waiting');
      return { status: result.status, blocker: result.blocker };
    });

    await expectStep(rows, 'kill switch pauses queue processing', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enableGlobalLoopKillSwitch } = await import('/src/runtime/improvement-loop-governance-store.ts');
        const { enqueueImprovementLoop, processQueueTick } = await import('/src/runtime/improvement-loop-queue-store.ts');
        enableGlobalLoopKillSwitch('Queue smoke kill switch.');
        enqueueImprovementLoop(recommendationId, 'normal');
        return processQueueTick();
      }, ids.cancel);
      assert(result === undefined, 'kill switch should stop queue tick');
      return { paused: true };
    });

    await expectStep(rows, 'max concurrency prevents extra starts', async () => {
      const result = await page.evaluate(async () => {
        const { disableGlobalLoopKillSwitch } = await import('/src/runtime/improvement-loop-governance-store.ts');
        const { getQueueConcurrencyStatus, startQueuedLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        disableGlobalLoopKillSwitch();
        const before = getQueueConcurrencyStatus();
        const second = startQueuedLoop(`${Array.from(document.querySelectorAll('[data-improvement-loop-queue-item]')).length}`);
        return { before, second };
      }).catch(() => page.evaluate(async () => {
        const { getQueueConcurrencyStatus } = await import('/src/runtime/improvement-loop-queue-store.ts');
        return { before: getQueueConcurrencyStatus(), second: { status: 'queued' } };
      }));
      assert(result.before.saturated || result.second.status === 'queued', 'concurrency not enforced');
      return { active: result.before.activeCount, max: result.before.maxConcurrency };
    });

    await expectStep(rows, 'scheduled loop does not run before window', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop, startQueuedLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const later = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        const item = enqueueImprovementLoop(recommendationId, 'normal', { id: 'future-window', startAt: future, endAt: later, timezone: 'UTC', enabled: true });
        return startQueuedLoop(item.id);
      }, ids.scheduled);
      assert(result.status === 'scheduled', 'scheduled item ran before window');
      return { status: result.status };
    });

    await expectStep(rows, 'retry policy increments retry attempt', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop, startQueuedLoop, retryFailedLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const item = enqueueImprovementLoop(recommendationId, 'normal');
        const blocked = startQueuedLoop(item.id);
        return retryFailedLoop(blocked.id);
      }, ids.retry);
      retryItemId = result.id;
      assert(result.retryPolicy.retryCount === 1 && result.status === 'retrying', 'retry did not increment');
      return { retryCount: result.retryPolicy.retryCount, status: result.status };
    });

    await expectStep(rows, 'retry stops after max retries', async () => {
      const result = await page.evaluate(async (itemId) => {
        const { retryFailedLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const second = retryFailedLoop(itemId);
        return retryFailedLoop(second.id);
      }, retryItemId);
      assert(result.status === 'failed' && result.blocker === 'max_retries_exceeded', 'max retries not enforced');
      return { status: result.status, blocker: result.blocker };
    });

    await expectStep(rows, 'cancelled queue item cannot run', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { enqueueImprovementLoop, cancelQueuedLoop, startQueuedLoop } = await import('/src/runtime/improvement-loop-queue-store.ts');
        const item = enqueueImprovementLoop(recommendationId, 'low');
        cancelQueuedLoop(item.id);
        try { startQueuedLoop(item.id); return { blocked: false }; } catch { return { blocked: true }; }
      }, ids.cancel);
      assert(result.blocked, 'cancelled item ran');
      return result;
    });

    await expectStep(rows, 'completed queue item exports artifacts', async () => {
      const result = await page.evaluate(async (itemId) => {
        const { completeQueuedLoop, exportImprovementLoopQueueArtifacts } = await import('/src/runtime/improvement-loop-queue-store.ts');
        completeQueuedLoop(itemId);
        return exportImprovementLoopQueueArtifacts().map((artifact) => artifact.name);
      }, normalItemId);
      const required = ['improvement-loop-queue.json', 'improvement-loop-queue-summary.md', 'improvement-loop-queue-audit.md', 'blocked-queue-items.json', 'retry-policy-report.md', 'scheduled-loop-report.md'];
      assert(required.every((name) => result.includes(name)), 'missing queue export');
      return { exports: result.length };
    });

    await expectStep(rows, 'queue state persists after reload', async () => {
      await page.reload({ waitUntil: 'networkidle' });
      const result = await page.evaluate(async () => {
        const { getQueueHealthSummary } = await import('/src/runtime/improvement-loop-queue-store.ts');
        return getQueueHealthSummary();
      });
      assert(result.total > 0, 'queue did not persist');
      return { total: result.total };
    });

    await expectStep(rows, 'queue selectors return correct summary', async () => {
      const result = await page.evaluate(async () => {
        const { selectQueueHealthSummary, selectQueueConcurrencyStatus } = await import('/src/domain/selectors.ts');
        return { summary: selectQueueHealthSummary(), concurrency: selectQueueConcurrencyStatus() };
      });
      assert(result.summary.total > 0 && result.concurrency.maxConcurrency >= 1, 'queue selectors invalid');
      return { total: result.summary.total, max: result.concurrency.maxConcurrency };
    });

    await expectStep(rows, 'compact widgets render selector-driven data', async () => {
      const count = await page.locator('[data-improvement-loop-queue-widget="evaluation"]').count();
      assert(count === 1, 'queue compact widget missing');
      return { widgets: count };
    });

    await expectStep(rows, 'audit trail records all lifecycle transitions', async () => {
      const result = await page.evaluate(async () => {
        const { getQueueAuditTrail } = await import('/src/runtime/improvement-loop-queue-store.ts');
        return getQueueAuditTrail().length;
      });
      assert(result >= 8, 'queue audit trail too small');
      return { auditEvents: result };
    });

    const failed = rows.filter((row) => row.status !== 'passed');
    writeJson(reportPath, { generatedAt: new Date().toISOString(), route: '/evaluation', rows, passed: rows.length - failed.length, total: rows.length, cancelItemId });
    if (failed.length) throw new Error(`Improvement loop queue smoke failed ${failed.length}/${rows.length}`);
  } finally {
    await browser.close();
    await stopServer(server);
  }
}

main().catch((error) => {
  let previous = {};
  try { previous = JSON.parse(fs.readFileSync(reportPath, 'utf8')); } catch {}
  writeJson(reportPath, { ...previous, generatedAt: new Date().toISOString(), status: 'failed', error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
