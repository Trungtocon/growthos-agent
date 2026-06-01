import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/recommendation-execution-smoke.json');
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
    const { clearLearningMemoryStore, createLearningSignalFromOutcome, generateRecommendationFromSignal, markRecommendationAccepted, markRecommendationRejected } = await import('/src/runtime/learning-memory-store.ts');
    const { clearRecommendationExecutionStore } = await import('/src/runtime/recommendation-execution-store.ts');
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
      title: 'Recommendation execution smoke evidence',
      description: 'Completed action task for recommendation execution smoke.',
      createdBy: 'Smoke test',
    });
    const outcome = createOutcomeVerification(actionExecution.id);
    const signal = createLearningSignalFromOutcome(outcome.id);
    const acceptedRecommendation = markRecommendationAccepted(generateRecommendationFromSignal(signal.id).id);
    const syntheticOutcome = (suffix, dimensions) => ({
      ...outcome,
      id: `improvement-outcome-${suffix}`,
      actionExecutionId: `${suffix}-action`,
      status: 'regressed',
      targetDimensions: dimensions,
      comparison: {
        beforeRunId: id,
        afterRunId: `${id}-${suffix}`,
        beforeEvaluationId: `before-${suffix}`,
        afterEvaluationId: `after-${suffix}`,
        overallDelta: -6,
        metricDeltas: dimensions.map((dimension) => ({ dimension, before: 84, after: 62, delta: -22, improved: false })),
        comparedAt: new Date().toISOString(),
      },
      evidence: [{
        id: `outcome-evidence-${suffix}`,
        outcomeId: `improvement-outcome-${suffix}`,
        type: 'metric_delta',
        title: 'Synthetic recommendation execution evidence',
        description: 'Smoke fixture creates a distinct recommendation context.',
        createdAt: new Date().toISOString(),
      }],
      regressions: [],
      updatedAt: new Date().toISOString(),
    });
    const raw = window.sessionStorage.getItem('uikigai-improvement-outcome-v1');
    const state = raw ? JSON.parse(raw) : { outcomes: {}, updatedAt: new Date().toISOString() };
    const rejectedOutcome = syntheticOutcome('recommendation-rejected-smoke', ['governance_compliance']);
    const alternateOutcome = syntheticOutcome('recommendation-alternate-smoke', ['cost_efficiency']);
    state.outcomes[rejectedOutcome.id] = rejectedOutcome;
    state.outcomes[alternateOutcome.id] = alternateOutcome;
    state.updatedAt = new Date().toISOString();
    window.sessionStorage.setItem('uikigai-improvement-outcome-v1', JSON.stringify(state));
    const rejectedSignal = createLearningSignalFromOutcome(rejectedOutcome.id);
    const rejectedRecommendation = markRecommendationRejected(generateRecommendationFromSignal(rejectedSignal.id).id, 'Smoke rejected duplicate path.');
    const secondSignal = createLearningSignalFromOutcome(alternateOutcome.id);
    const secondRecommendation = markRecommendationAccepted(generateRecommendationFromSignal(secondSignal.id).id);
    return {
      acceptedRecommendationId: acceptedRecommendation.id,
      rejectedRecommendationId: rejectedRecommendation.id,
      alternateRecommendationId: secondRecommendation.id,
      actionPlanId: actionPlan.id,
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

    await expectStep(rows, 'accepted recommendation creates execution', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createExecutionFromRecommendation } = await import('/src/runtime/recommendation-execution-store.ts');
        return createExecutionFromRecommendation(recommendationId);
      }, prepared.acceptedRecommendationId);
      assert(result.recommendationId === prepared.acceptedRecommendationId, 'execution recommendation mismatch');
      return { executionId: result.id, status: result.status };
    });

    await expectStep(rows, 'rejected recommendation cannot create execution', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createExecutionFromRecommendation } = await import('/src/runtime/recommendation-execution-store.ts');
        try {
          createExecutionFromRecommendation(recommendationId);
          return { blocked: false };
        } catch (error) {
          return { blocked: true, message: error instanceof Error ? error.message : String(error) };
        }
      }, prepared.rejectedRecommendationId);
      assert(result.blocked, 'rejected recommendation executed');
      return result;
    });

    await expectStep(rows, 'duplicate execution is blocked', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createExecutionFromRecommendation, getRecommendationExecutions } = await import('/src/runtime/recommendation-execution-store.ts');
        const first = createExecutionFromRecommendation(recommendationId).id;
        const second = createExecutionFromRecommendation(recommendationId).id;
        return { first, second, count: getRecommendationExecutions().filter((execution) => execution.recommendationId === recommendationId).length };
      }, prepared.acceptedRecommendationId);
      assert(result.first === result.second, 'duplicate execution id mismatch');
      assert(result.count === 1, 'duplicate execution persisted');
      return result;
    });

    await expectStep(rows, 'execution can start', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createExecutionFromRecommendation, startRecommendationExecution } = await import('/src/runtime/recommendation-execution-store.ts');
        const execution = createExecutionFromRecommendation(recommendationId);
        return startRecommendationExecution(execution.id);
      }, prepared.acceptedRecommendationId);
      assert(result.status === 'in_progress', 'execution did not start');
      return { executionId: result.id, status: result.status };
    });

    await expectStep(rows, 'execution can complete with evidence', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createExecutionFromRecommendation, completeRecommendationExecution } = await import('/src/runtime/recommendation-execution-store.ts');
        const execution = createExecutionFromRecommendation(recommendationId);
        return completeRecommendationExecution(execution.id, {
          type: 'note',
          title: 'Recommendation completed',
          description: 'Smoke completion evidence.',
          createdBy: 'Smoke test',
        });
      }, prepared.acceptedRecommendationId);
      assert(result.status === 'completed' && result.evidence.length > 0, 'execution completion failed');
      return { executionId: result.id, evidence: result.evidence.length };
    });

    await expectStep(rows, 'execution can fail with reason', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createExecutionFromRecommendation, failRecommendationExecution } = await import('/src/runtime/recommendation-execution-store.ts');
        const execution = createExecutionFromRecommendation(recommendationId);
        return failRecommendationExecution(execution.id, 'Smoke failure reason.');
      }, prepared.alternateRecommendationId);
      assert(result.status === 'failed' && result.failureReason, 'execution failure not recorded');
      return { executionId: result.id, reason: result.failureReason };
    });

    await expectStep(rows, 'execution can cancel', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createExecutionFromRecommendation, cancelRecommendationExecution } = await import('/src/runtime/recommendation-execution-store.ts');
        const execution = createExecutionFromRecommendation(recommendationId);
        return cancelRecommendationExecution(execution.id);
      }, prepared.alternateRecommendationId);
      assert(result.status === 'cancelled', 'execution did not cancel');
      return { executionId: result.id, status: result.status };
    });

    await expectStep(rows, 'completed execution creates/verifies impact', async () => {
      const result = await page.evaluate(async (recommendationId) => {
        const { createExecutionFromRecommendation, completeRecommendationExecution, verifyRecommendationImpact } = await import('/src/runtime/recommendation-execution-store.ts');
        const execution = createExecutionFromRecommendation(recommendationId);
        completeRecommendationExecution(execution.id, {
          type: 'metric',
          title: 'Impact metric',
          description: 'Score delta captured.',
          createdBy: 'Smoke test',
        });
        return verifyRecommendationImpact(execution.id);
      }, prepared.acceptedRecommendationId);
      assert(result.status === 'verified' && result.impactResult?.outcomeId, 'impact verification failed');
      return { executionId: result.id, outcomeId: result.impactResult.outcomeId };
    });

    await expectStep(rows, 'verified execution updates recommendation confidence', async () => {
      const result = await page.evaluate(async (executionRecommendationId) => {
        const { getExecutionByRecommendation } = await import('/src/runtime/recommendation-execution-store.ts');
        const { calculateRecommendationConfidence } = await import('/src/runtime/learning-memory-store.ts');
        const execution = getExecutionByRecommendation(executionRecommendationId);
        return {
          confidence: calculateRecommendationConfidence(executionRecommendationId),
          before: execution?.impactResult?.confidenceBefore ?? 0,
          after: execution?.impactResult?.confidenceAfter ?? 0,
        };
      }, prepared.acceptedRecommendationId);
      assert(result.after >= result.before, 'confidence did not increase after verification');
      return result;
    });

    await expectStep(rows, 'selectors resolve execution summary', async () => {
      const result = await page.evaluate(async () => {
        const selectors = await import('/src/domain/selectors.ts');
        return {
          total: selectors.selectRecommendationExecutions().length,
          pending: selectors.selectPendingRecommendationExecutions().length,
          completed: selectors.selectCompletedRecommendationExecutions().length,
          verified: selectors.selectVerifiedRecommendationExecutions().length,
          summary: selectors.selectRecommendationExecutionSummary(),
        };
      });
      assert(result.total > 0 && result.summary.total === result.total, 'selector summary mismatch');
      return result;
    });

    await expectStep(rows, 'artifact exports registered', async () => {
      const result = await page.evaluate(async () => {
        const { generateRecommendationExecutionArtifacts } = await import('/src/runtime/recommendation-execution-store.ts');
        return generateRecommendationExecutionArtifacts().map((artifact) => artifact.name);
      });
      for (const name of ['recommendation-execution.json', 'recommendation-execution-summary.md', 'recommendation-impact-result.json', 'recommendation-execution-evidence.md']) {
        assert(result.includes(name), `missing export ${name}`);
      }
      return { exports: result.join(', ') };
    });

    await expectStep(rows, 'reload persistence works', async () => {
      const before = await page.evaluate(async () => {
        const { getRecommendationExecutionSummary } = await import('/src/runtime/recommendation-execution-store.ts');
        return getRecommendationExecutionSummary().total;
      });
      await page.reload({ waitUntil: 'networkidle' });
      const after = await page.evaluate(async () => {
        const { getRecommendationExecutionSummary } = await import('/src/runtime/recommendation-execution-store.ts');
        return getRecommendationExecutionSummary().total;
      });
      assert(before === after && after > 0, 'execution state did not persist after reload');
      await page.locator('[data-recommendation-execution-widget="evaluation"]').waitFor({ timeout: 10000 });
      return { before, after };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: rows.length,
      passed: rows.filter((row) => row.status === 'passed').length,
      failed: rows.filter((row) => row.status === 'failed').length,
    },
    rows,
  };
  writeJson(reportPath, report);
  if (report.summary.failed) {
    console.error(JSON.stringify(report, null, 2));
    throw new Error(`${report.summary.failed} recommendation execution smoke step(s) failed. See ${reportPath}`);
  }
  console.log(`Recommendation execution smoke passed: ${report.summary.passed}/${report.summary.total}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
