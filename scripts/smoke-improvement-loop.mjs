import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/improvement-loop-smoke.json');
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
    const child = spawn(command, args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });
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
    const { clearLearningMemoryStore, createLearningSignalFromOutcome, generateRecommendationFromSignal, markRecommendationAccepted, markRecommendationRejected, updateRecommendationConfidence } = await import('/src/runtime/learning-memory-store.ts');
    const { clearRecommendationExecutionStore } = await import('/src/runtime/recommendation-execution-store.ts');
    const { clearImprovementLoopStore } = await import('/src/runtime/improvement-loop-store.ts');
    const { createPlanForTicket, startStreamingRun, nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const { isStreamComplete } = await import('/src/runtime-store/stream-store.ts');

    resetRuntimeState();
    resetWorkflowState();
    clearRunPlans();
    resetUsageLedgerStore();
    clearArtifactRegistry();
    clearExecutionTimelineStore();
    clearRunEvaluationStore();
    clearEvaluationFeedbackStore();
    clearFeedbackActionPlanStore();
    clearActionPlanExecutionStore();
    clearImprovementOutcomeStore();
    clearLearningMemoryStore();
    clearRecommendationExecutionStore();
    clearImprovementLoopStore();

    createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
    await startStreamingRun('ticket-audit-module-3');
    for (let guard = 0; guard < 24 && !isStreamComplete(id); guard += 1) {
      await nextStreamTick(id);
    }
    buildTimelineForRun(id);
    const feedback = generateFeedbackForRun(id);
    const actionPlan = createActionPlanFromFeedback(feedback.id);
    const actionExecution = startActionPlanExecution(actionPlan.id);
    completeActionTask(actionExecution.tasks[0].taskId, {
      type: 'note',
      title: 'Improvement loop smoke evidence',
      description: 'Completed action task for autonomous loop fixture.',
      createdBy: 'Smoke test',
    });
    const outcome = createOutcomeVerification(actionExecution.id);
    const acceptedRecommendation = markRecommendationAccepted(generateRecommendationFromSignal(createLearningSignalFromOutcome(outcome.id).id).id);

    const syntheticOutcome = (suffix, dimensions) => ({
      ...outcome,
      id: `improvement-outcome-loop-${suffix}`,
      actionExecutionId: `loop-${suffix}-action`,
      status: 'regressed',
      targetDimensions: dimensions,
      comparison: {
        beforeRunId: id,
        afterRunId: `${id}-${suffix}`,
        beforeEvaluationId: `before-${suffix}`,
        afterEvaluationId: `after-${suffix}`,
        overallDelta: -8,
        metricDeltas: dimensions.map((dimension) => ({ dimension, before: 84, after: 60, delta: -24, improved: false })),
        comparedAt: new Date().toISOString(),
      },
      evidence: [{
        id: `outcome-evidence-loop-${suffix}`,
        outcomeId: `improvement-outcome-loop-${suffix}`,
        type: 'metric_delta',
        title: 'Synthetic loop evidence',
        description: 'Smoke fixture creates a distinct autonomous loop context.',
        createdAt: new Date().toISOString(),
      }],
      regressions: [],
      updatedAt: new Date().toISOString(),
    });
    const raw = window.sessionStorage.getItem('uikigai-improvement-outcome-v1');
    const state = raw ? JSON.parse(raw) : { outcomes: {}, updatedAt: new Date().toISOString() };
    const rejectedOutcome = syntheticOutcome('rejected', ['replay_integrity']);
    const blockedOutcome = syntheticOutcome('blocked', ['governance_compliance']);
    const cancelOutcome = syntheticOutcome('cancel', ['artifact_quality']);
    const retryOutcome = syntheticOutcome('retry', ['cost_efficiency']);
    state.outcomes[rejectedOutcome.id] = rejectedOutcome;
    state.outcomes[blockedOutcome.id] = blockedOutcome;
    state.outcomes[cancelOutcome.id] = cancelOutcome;
    state.outcomes[retryOutcome.id] = retryOutcome;
    state.updatedAt = new Date().toISOString();
    window.sessionStorage.setItem('uikigai-improvement-outcome-v1', JSON.stringify(state));

    const rejectedRecommendation = markRecommendationRejected(generateRecommendationFromSignal(createLearningSignalFromOutcome(rejectedOutcome.id).id).id, 'Smoke rejected loop path.');
    const blockedRecommendation = markRecommendationAccepted(generateRecommendationFromSignal(createLearningSignalFromOutcome(blockedOutcome.id).id).id);
    updateRecommendationConfidence(blockedRecommendation.id, -90);
    const cancelRecommendation = markRecommendationAccepted(generateRecommendationFromSignal(createLearningSignalFromOutcome(cancelOutcome.id).id).id);
    const retryRecommendation = markRecommendationAccepted(generateRecommendationFromSignal(createLearningSignalFromOutcome(retryOutcome.id).id).id);

    return {
      acceptedRecommendationId: acceptedRecommendation.id,
      rejectedRecommendationId: rejectedRecommendation.id,
      blockedRecommendationId: blockedRecommendation.id,
      cancelRecommendationId: cancelRecommendation.id,
      retryRecommendationId: retryRecommendation.id,
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
    const prepared = await prepareRuntime(page);
    await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
    await page.locator('[data-run-evaluation-route]').waitFor({ timeout: 10000 });

    let loopId;
    let runIdForRetry;

    await expectStep(rows, 'create loop from accepted recommendation', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createImprovementLoop } = await import('/src/runtime/improvement-loop-store.ts');
        return createImprovementLoop(recommendationId);
      }, prepared.acceptedRecommendationId);
      loopId = result.id;
      assert(result.recommendationId === prepared.acceptedRecommendationId, 'loop recommendation mismatch');
      return { loopId: result.id, status: result.status };
    });

    await expectStep(rows, 'reject loop from rejected recommendation', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createImprovementLoop } = await import('/src/runtime/improvement-loop-store.ts');
        try {
          createImprovementLoop(recommendationId);
          return { blocked: false };
        } catch (error) {
          return { blocked: true, message: error instanceof Error ? error.message : String(error) };
        }
      }, prepared.rejectedRecommendationId);
      assert(result.blocked, 'rejected recommendation created loop');
      return result;
    });

    await expectStep(rows, 'schedule loop', async () => {
      const result = await page.evaluate(async (id) => {
        const { scheduleImprovementLoop } = await import('/src/runtime/improvement-loop-store.ts');
        return scheduleImprovementLoop(id, 'daily');
      }, loopId);
      assert(result.status === 'active', 'schedule not active');
      return { scheduleId: result.id, nextRunAt: result.nextRunAt };
    });

    await expectStep(rows, 'start manual loop', async () => {
      const result = await page.evaluate(async (id) => {
        const { startImprovementLoop } = await import('/src/runtime/improvement-loop-store.ts');
        return startImprovementLoop(id);
      }, loopId);
      assert(['running', 'waiting_review'].includes(result.status), 'loop did not start');
      return { runId: result.id, status: result.status };
    });

    await expectStep(rows, 'block start when governance blocker exists', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createImprovementLoop, startImprovementLoop, getLoopReadiness } = await import('/src/runtime/improvement-loop-store.ts');
        const loop = createImprovementLoop(recommendationId, 'governance_warning');
        try {
          startImprovementLoop(loop.id);
          return { blocked: false, readiness: getLoopReadiness(loop.id) };
        } catch {
          return { blocked: true, readiness: getLoopReadiness(loop.id) };
        }
      }, prepared.blockedRecommendationId);
      assert(result.blocked && result.readiness.status === 'blocked', 'governance blocker did not block');
      return { blockers: result.readiness.blockers.length };
    });

    await expectStep(rows, 'pause loop', async () => {
      const result = await page.evaluate(async (id) => {
        const { pauseImprovementLoop } = await import('/src/runtime/improvement-loop-store.ts');
        return pauseImprovementLoop(id);
      }, loopId);
      assert(result.status === 'paused', 'loop did not pause');
      return { status: result.status };
    });

    await expectStep(rows, 'resume loop', async () => {
      const result = await page.evaluate(async (id) => {
        const { resumeImprovementLoop } = await import('/src/runtime/improvement-loop-store.ts');
        return resumeImprovementLoop(id);
      }, loopId);
      assert(['running', 'waiting_review'].includes(result.status), 'loop did not resume');
      return { status: result.status };
    });

    await expectStep(rows, 'cancel loop', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createImprovementLoop, cancelImprovementLoop } = await import('/src/runtime/improvement-loop-store.ts');
        const loop = createImprovementLoop(recommendationId);
        return cancelImprovementLoop(loop.id);
      }, prepared.cancelRecommendationId);
      assert(result.status === 'cancelled', 'loop did not cancel');
      return { loopId: result.id, status: result.status };
    });

    await expectStep(rows, 'retry failed loop run', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createImprovementLoop, startImprovementLoop, failImprovementLoopRun, retryImprovementLoopRun } = await import('/src/runtime/improvement-loop-store.ts');
        const loop = createImprovementLoop(recommendationId);
        const run = startImprovementLoop(loop.id);
        failImprovementLoopRun(run.id, 'Smoke retry failure.');
        return retryImprovementLoopRun(run.id);
      }, prepared.retryRecommendationId);
      runIdForRetry = result.id;
      assert(result.attempt >= 2 && ['running', 'waiting_review'].includes(result.status), 'retry did not create second attempt');
      return { runId: result.id, attempt: result.attempt };
    });

    await expectStep(rows, 'complete loop run with evidence', async () => {
      const result = await page.evaluate(async (id) => {
        const { completeImprovementLoopRun } = await import('/src/runtime/improvement-loop-store.ts');
        return completeImprovementLoopRun(id, ['Smoke completion evidence.']);
      }, runIdForRetry);
      assert(result.status === 'completed' && result.outcomeId, 'loop run did not complete with outcome');
      return { runId: result.id, outcomeId: result.outcomeId };
    });

    await expectStep(rows, 'completed loop creates improvement outcome', async () => {
      const result = await page.evaluate(async () => {
        const { getLoopOutcomeSummary } = await import('/src/runtime/improvement-loop-store.ts');
        return getLoopOutcomeSummary();
      });
      assert(result.total > 0 && result.improved > 0, 'loop outcome not created');
      return result;
    });

    await expectStep(rows, 'verified outcome updates learning memory', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { getRecommendations } = await import('/src/runtime/learning-memory-store.ts');
        const recommendation = getRecommendations().find((item) => item.id === recommendationId);
        return { confidence: recommendation?.confidence ?? 0 };
      }, prepared.retryRecommendationId);
      assert(result.confidence > 0, 'recommendation confidence not available');
      return result;
    });

    await expectStep(rows, 'failed repeated loop lowers confidence', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { getRecommendations } = await import('/src/runtime/learning-memory-store.ts');
        const { createImprovementLoop, startImprovementLoop, failImprovementLoopRun } = await import('/src/runtime/improvement-loop-store.ts');
        const before = getRecommendations().find((item) => item.id === recommendationId)?.confidence ?? 0;
        const loop = createImprovementLoop(recommendationId);
        const run = startImprovementLoop(loop.id);
        failImprovementLoopRun(run.id, 'Repeated failure lowers confidence.');
        const after = getRecommendations().find((item) => item.id === recommendationId)?.confidence ?? 0;
        return { before, after };
      }, prepared.acceptedRecommendationId);
      assert(result.after < result.before, 'confidence did not lower after failure');
      return result;
    });

    await expectStep(rows, 'artifact exports registered', async () => {
      const result = await page.evaluate(async () => {
        const { exportImprovementLoopArtifacts } = await import('/src/runtime/improvement-loop-store.ts');
        return exportImprovementLoopArtifacts().map((artifact) => artifact.name);
      });
      const required = ['improvement-loop.json', 'improvement-loop-summary.md', 'improvement-loop-runs.json', 'improvement-loop-outcome.md', 'learning-loop-report.md'];
      assert(required.every((name) => result.includes(name)), 'missing improvement loop exports');
      return { exports: result.length };
    });

    await expectStep(rows, 'reload persistence works', async () => {
      await page.reload({ waitUntil: 'networkidle' });
      const result = await page.evaluate(async () => {
        const { getWorkspaceImprovementLoopSummary } = await import('/src/runtime/improvement-loop-store.ts');
        return getWorkspaceImprovementLoopSummary();
      });
      assert(result.total > 0, 'loops did not persist after reload');
      return { total: result.total, completed: result.completed };
    });

    const failed = rows.filter((row) => row.status !== 'passed');
    writeJson(reportPath, { generatedAt: new Date().toISOString(), route: '/evaluation', rows, passed: rows.length - failed.length, total: rows.length });
    if (failed.length) throw new Error(`Improvement loop smoke failed ${failed.length}/${rows.length}`);
  } finally {
    await browser.close();
    await stopServer(server);
  }
}

main().catch((error) => {
  let previous = {};
  try {
    previous = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    previous = {};
  }
  writeJson(reportPath, { ...previous, generatedAt: new Date().toISOString(), status: 'failed', error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
