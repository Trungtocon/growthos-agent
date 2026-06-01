import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/learning-memory-smoke.json');
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
    const { clearLearningMemoryStore } = await import('/src/runtime/learning-memory-store.ts');
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
    createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
    await startStreamingRun('ticket-audit-module-3');
    for (let guard = 0; guard < 24 && !isStreamComplete(id); guard += 1) {
      await nextStreamTick(id);
    }
    buildTimelineForRun(id);
    const feedback = generateFeedbackForRun(id);
    const actionPlan = createActionPlanFromFeedback(feedback.id);
    const execution = startActionPlanExecution(actionPlan.id);
    completeActionTask(execution.tasks[0].taskId, {
      type: 'note',
      title: 'Learning smoke evidence',
      description: 'Completed task for learning memory smoke.',
      createdBy: 'Smoke test',
    });
    const improvedOutcome = createOutcomeVerification(execution.id);
    const regressedOutcome = {
      ...improvedOutcome,
      id: 'improvement-outcome-regressed-smoke',
      actionExecutionId: 'regressed-smoke-action',
      status: 'regressed',
      targetDimensions: ['cost_efficiency', 'governance_compliance'],
      comparison: {
        beforeRunId: id,
        afterRunId: `${id}-regressed`,
        beforeEvaluationId: 'before-regressed',
        afterEvaluationId: 'after-regressed',
        overallDelta: -8,
        metricDeltas: [
          { dimension: 'overall_score', before: 82, after: 74, delta: -8, improved: false },
          { dimension: 'cost_efficiency', before: 86, after: 64, delta: -22, improved: false },
          { dimension: 'governance_compliance', before: 91, after: 58, delta: -33, improved: false },
        ],
        comparedAt: new Date().toISOString(),
      },
      evidence: [{
        id: 'outcome-evidence-regressed-smoke',
        outcomeId: 'improvement-outcome-regressed-smoke',
        type: 'governance',
        title: 'Synthetic regression evidence',
        description: 'Smoke fixture validates regressed learning signal mapping.',
        createdAt: new Date().toISOString(),
      }],
      regressions: [{
        id: 'regression-smoke-governance',
        outcomeId: 'improvement-outcome-regressed-smoke',
        dimension: 'governance_compliance',
        severity: 'critical',
        description: 'Governance compliance regressed in smoke fixture.',
        before: 91,
        after: 58,
      }],
      updatedAt: new Date().toISOString(),
    };
    const raw = window.sessionStorage.getItem('uikigai-improvement-outcome-v1');
    const state = raw ? JSON.parse(raw) : { outcomes: {}, updatedAt: new Date().toISOString() };
    state.outcomes[regressedOutcome.id] = regressedOutcome;
    state.updatedAt = new Date().toISOString();
    window.sessionStorage.setItem('uikigai-improvement-outcome-v1', JSON.stringify(state));
    return { improvedOutcomeId: improvedOutcome.id, regressedOutcomeId: regressedOutcome.id, actionExecutionId: execution.id };
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

    await expectStep(rows, 'creates learning signal from improved outcome', async () => {
      const result = await page.evaluate(async (outcomeId) => {
        const { createLearningSignalFromOutcome } = await import('/src/runtime/learning-memory-store.ts');
        return createLearningSignalFromOutcome(outcomeId);
      }, prepared.improvedOutcomeId);
      assert(result.type === 'improved_outcome', 'expected improved signal');
      return { signalId: result.id, type: result.type };
    });

    await expectStep(rows, 'creates learning signal from regressed outcome', async () => {
      const result = await page.evaluate(async (outcomeId) => {
        const { createLearningSignalFromOutcome } = await import('/src/runtime/learning-memory-store.ts');
        return createLearningSignalFromOutcome(outcomeId);
      }, prepared.regressedOutcomeId);
      assert(result.type === 'regressed_outcome', 'expected regressed signal');
      return { signalId: result.id, type: result.type };
    });

    await expectStep(rows, 'prevents duplicate signals', async () => {
      const result = await page.evaluate(async (outcomeId) => {
        const { createLearningSignalFromOutcome, getLearningSignals } = await import('/src/runtime/learning-memory-store.ts');
        const first = createLearningSignalFromOutcome(outcomeId).id;
        const second = createLearningSignalFromOutcome(outcomeId).id;
        return { first, second, count: getLearningSignals().filter((signal) => signal.outcomeId === outcomeId).length };
      }, prepared.improvedOutcomeId);
      assert(result.first === result.second, 'duplicate signal id mismatch');
      assert(result.count === 1, 'duplicate signal persisted');
      return result;
    });

    await expectStep(rows, 'generates recommendation from signal', async () => {
      const result = await page.evaluate(async (outcomeId) => {
        const { createLearningSignalFromOutcome, generateRecommendationFromSignal } = await import('/src/runtime/learning-memory-store.ts');
        const signal = createLearningSignalFromOutcome(outcomeId);
        return generateRecommendationFromSignal(signal.id);
      }, prepared.improvedOutcomeId);
      assert(result.id && result.confidence > 0, 'recommendation missing confidence');
      return { recommendationId: result.id, type: result.type, confidence: result.confidence };
    });

    await expectStep(rows, 'prevents duplicate recommendations', async () => {
      const result = await page.evaluate(async (outcomeId) => {
        const { createLearningSignalFromOutcome, generateRecommendationFromSignal, getRecommendationsForRun } = await import('/src/runtime/learning-memory-store.ts');
        const signal = createLearningSignalFromOutcome(outcomeId);
        const first = generateRecommendationFromSignal(signal.id).id;
        const second = generateRecommendationFromSignal(signal.id).id;
        return { first, second, count: getRecommendationsForRun('run-demo-module-3').filter((item) => item.id === first).length };
      }, prepared.improvedOutcomeId);
      assert(result.first === result.second, 'duplicate recommendation id mismatch');
      assert(result.count === 1, 'duplicate recommendation persisted');
      return result;
    });

    await expectStep(rows, 'ranks recommendations by confidence', async () => {
      const result = await page.evaluate(async (regressedOutcomeId) => {
        const { createLearningSignalFromOutcome, generateRecommendationFromSignal, rankRecommendations } = await import('/src/runtime/learning-memory-store.ts');
        const signal = createLearningSignalFromOutcome(regressedOutcomeId);
        generateRecommendationFromSignal(signal.id);
        return rankRecommendations({ runId: 'run-demo-module-3' }).map((item) => ({ id: item.id, confidence: item.confidence, priority: item.impact.priority }));
      }, prepared.regressedOutcomeId);
      assert(result.length >= 2, 'expected at least two recommendations');
      assert(result[0].confidence >= result[result.length - 1].confidence || result[0].priority === 'critical', 'recommendations not ranked');
      return { top: result[0].id, count: result.length };
    });

    await expectStep(rows, 'accepts recommendation', async () => {
      const result = await page.evaluate(async () => {
        const { getRecommendationsForRun, markRecommendationAccepted } = await import('/src/runtime/learning-memory-store.ts');
        const recommendation = getRecommendationsForRun('run-demo-module-3')[0];
        return markRecommendationAccepted(recommendation.id);
      });
      assert(result.status === 'accepted', 'recommendation not accepted');
      return { recommendationId: result.id, status: result.status };
    });

    await expectStep(rows, 'rejects recommendation with reason', async () => {
      const result = await page.evaluate(async () => {
        const { getRecommendationsForRun, markRecommendationRejected } = await import('/src/runtime/learning-memory-store.ts');
        const recommendation = getRecommendationsForRun('run-demo-module-3').find((item) => item.status !== 'accepted') ?? getRecommendationsForRun('run-demo-module-3')[0];
        return markRecommendationRejected(recommendation.id, 'Smoke rejection reason.');
      });
      assert(result.status === 'rejected' && result.rejectionReason, 'recommendation not rejected with reason');
      return { recommendationId: result.id, reason: result.rejectionReason };
    });

    await expectStep(rows, 'selectors resolve run/agent/workflow recommendations', async () => {
      const result = await page.evaluate(async () => {
        const selectors = await import('/src/domain/selectors.ts');
        return {
          run: selectors.selectRecommendationsByRun('run-demo-module-3').length,
          agent: selectors.selectRecommendationsByAgent('agent-hermes-qa').length,
          workflow: selectors.selectRecommendationsByWorkflow('demo-run-execution').length,
        };
      });
      assert(result.run > 0 && result.agent > 0 && result.workflow > 0, 'selector recommendation lookup failed');
      return result;
    });

    await expectStep(rows, 'learning memory summary generated', async () => {
      const result = await page.evaluate(async () => {
        const { getLearningMemorySummary } = await import('/src/runtime/learning-memory-store.ts');
        return getLearningMemorySummary();
      });
      assert(result.signalCount >= 2 && result.recommendationCount >= 2, 'summary missing learning data');
      return result;
    });

    await expectStep(rows, 'artifact exports registered', async () => {
      const result = await page.evaluate(async () => {
        const { registerLearningMemoryExports } = await import('/src/runtime/learning-memory-store.ts');
        return registerLearningMemoryExports('run-demo-module-3').map((artifact) => artifact.name);
      });
      for (const name of ['learning-memory.json', 'recommendations.json', 'recommendation-summary.md', 'recommendation-evidence.md', 'learning-signal-report.json']) {
        assert(result.includes(name), `missing export ${name}`);
      }
      return { exports: result.join(', ') };
    });

    await expectStep(rows, 'reload persistence works', async () => {
      const before = await page.evaluate(async () => {
        const { getLearningMemorySummary } = await import('/src/runtime/learning-memory-store.ts');
        return getLearningMemorySummary().recommendationCount;
      });
      await page.reload({ waitUntil: 'networkidle' });
      const after = await page.evaluate(async () => {
        const { getLearningMemorySummary } = await import('/src/runtime/learning-memory-store.ts');
        return getLearningMemorySummary().recommendationCount;
      });
      assert(before === after && after > 0, 'learning memory did not persist after reload');
      await page.locator('[data-learning-recommendation-widget="evaluation"]').waitFor({ timeout: 10000 });
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
    throw new Error(`${report.summary.failed} learning memory smoke step(s) failed. See ${reportPath}`);
  }
  console.log(`Learning memory smoke passed: ${report.summary.passed}/${report.summary.total}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
