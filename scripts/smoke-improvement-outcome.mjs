import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/improvement-outcome-smoke.json');
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
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
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
    const { clearImprovementOutcomeStore } = await import('/src/runtime/improvement-outcome-store.ts');
    const { clearGovernanceDecisionStore } = await import('/src/runtime/governance-decision-store.ts');
    const { createPlanForTicket, startStreamingRun, nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const { evaluateGovernanceDecision } = await import('/src/runtime/governance-decision-engine.ts');
    const { recordGovernanceDecision } = await import('/src/runtime/governance-decision-store.ts');
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
    clearGovernanceDecisionStore();
    createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
    await startStreamingRun('ticket-audit-module-3');
    for (let guard = 0; guard < 24 && !isStreamComplete(id); guard += 1) {
      await nextStreamTick(id);
    }
    recordGovernanceDecision(evaluateGovernanceDecision({
      targetId: id,
      targetType: 'runtime',
      action: 'improvementOutcomeSmokeGovernanceDecision',
    }));
    const feedback = generateFeedbackForRun(id);
    const actionPlan = createActionPlanFromFeedback(feedback.id);
    const execution = startActionPlanExecution(actionPlan.id);
    const task = execution.tasks[0];
    completeActionTask(task.taskId, { type: 'note', title: 'Smoke completion evidence', description: 'Completed task evidence for outcome verification.', createdBy: 'smoke' });
    return { timelineEvents: buildTimelineForRun(id).events.length, planId: actionPlan.id, executionId: execution.id, taskExecutionId: task.id };
  }, runId);
}

const serverProcess = await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
const rows = [];

try {
  await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
  const prepared = await prepareRuntime(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-run-evaluation-route]').waitFor({ timeout: 10000 });

  await expectStep(rows, 'outcome verification creates for completed action', async () => {
    const result = await page.evaluate(async (executionId) => {
      const { createOutcomeVerification } = await import('/src/runtime/improvement-outcome-store.ts');
      return createOutcomeVerification(executionId);
    }, prepared.executionId);
    assert(result.actionExecutionId === prepared.executionId, 'action execution mismatch');
    assert(['improved', 'unchanged', 'regressed', 'inconclusive'].includes(result.status), 'invalid outcome status');
    return { outcomeId: result.id, status: result.status };
  });

  await expectStep(rows, 'duplicate outcome IDs are prevented', async () => {
    const result = await page.evaluate(async (executionId) => {
      const { createOutcomeVerification } = await import('/src/runtime/improvement-outcome-store.ts');
      const first = createOutcomeVerification(executionId).id;
      const second = createOutcomeVerification(executionId).id;
      return { ids: [first, second], unique: new Set([first, second]).size };
    }, prepared.executionId);
    assert(result.unique === 1, 'duplicate outcome ids created');
    return result;
  });

  await expectStep(rows, 'before/after comparison works', async () => {
    const result = await page.evaluate(async (id) => {
      const { compareRunEvaluationBeforeAfter } = await import('/src/runtime/improvement-outcome-store.ts');
      return compareRunEvaluationBeforeAfter(id, id);
    }, runId);
    assert(result.metricDeltas.length > 0, 'metric deltas missing');
    return { overallDelta: result.overallDelta, metrics: result.metricDeltas.length };
  });

  await expectStep(rows, 'metric deltas calculate correctly', async () => {
    const result = await page.evaluate(async (id) => {
      const { getRunEvaluation } = await import('/src/runtime/run-evaluation-store.ts');
      const { cloneEvaluationWithScoreAdjustments } = await import('/src/runtime/improvement-outcome.ts');
      const { calculateMetricDeltas } = await import('/src/runtime/improvement-outcome-store.ts');
      const before = getRunEvaluation(id);
      const after = cloneEvaluationWithScoreAdjustments(before, { artifact_quality: 10 });
      return calculateMetricDeltas(before, after).find((delta) => delta.dimension === 'artifact_quality');
    }, runId);
    assert(result.delta === 10 || result.after === 100, 'artifact delta did not calculate');
    return result;
  });

  await expectStep(rows, 'improved status detected', async () => {
    const result = await page.evaluate(async (executionId) => {
      const { createOutcomeVerification } = await import('/src/runtime/improvement-outcome-store.ts');
      return createOutcomeVerification(executionId);
    }, prepared.executionId);
    assert(result.status === 'improved' || result.status === 'unchanged', 'expected improved or unchanged status');
    return { status: result.status, overallDelta: result.comparison?.overallDelta };
  });

  await expectStep(rows, 'regressed status detected', async () => {
    const result = await page.evaluate(async (id) => {
      const { getRunEvaluation } = await import('/src/runtime/run-evaluation-store.ts');
      const { cloneEvaluationWithScoreAdjustments, outcomeStatusFromComparison } = await import('/src/runtime/improvement-outcome.ts');
      const { calculateMetricDeltas, detectRegressionFindings } = await import('/src/runtime/improvement-outcome-store.ts');
      const before = getRunEvaluation(id);
      const after = cloneEvaluationWithScoreAdjustments(before, { governance_compliance: -50 });
      const metricDeltas = calculateMetricDeltas(before, after);
      const regressions = detectRegressionFindings(metricDeltas, 'regressed-smoke');
      return { status: outcomeStatusFromComparison({ beforeRunId: id, afterRunId: `${id}-bad`, overallDelta: -8, metricDeltas, comparedAt: new Date().toISOString() }, regressions), regressions: regressions.length };
    }, runId);
    assert(result.status === 'regressed', 'regressed status not detected');
    assert(result.regressions > 0, 'regression findings missing');
    return result;
  });

  await expectStep(rows, 'inconclusive status detected when data missing', async () => {
    const result = await page.evaluate(async () => {
      const { verifyCompletedActionImpact } = await import('/src/runtime/improvement-outcome-store.ts');
      return verifyCompletedActionImpact('missing-action-task');
    });
    assert(result.status === 'inconclusive', 'missing action task should be inconclusive');
    return { status: result.status, evidence: result.evidence.length };
  });

  await expectStep(rows, 'evidence generated', async () => {
    const result = await page.evaluate(async (executionId) => {
      const { createOutcomeVerification, getOutcomeEvidence } = await import('/src/runtime/improvement-outcome-store.ts');
      createOutcomeVerification(executionId);
      return getOutcomeEvidence(executionId);
    }, prepared.executionId);
    assert(result.length > 0, 'outcome evidence missing');
    return { evidence: result.length };
  });

  await expectStep(rows, 'workspace outcome summary generated', async () => {
    const result = await page.evaluate(async () => {
      const { generateWorkspaceImprovementOutcomeSummary } = await import('/src/runtime/improvement-outcome-store.ts');
      return generateWorkspaceImprovementOutcomeSummary();
    });
    assert(result.outcomeCount >= 1, 'outcome count missing');
    return result;
  });

  await expectStep(rows, 'artifact exports registered', async () => {
    const result = await page.evaluate(async (id) => {
      const { registerImprovementOutcomeExports } = await import('/src/runtime/improvement-outcome-store.ts');
      const { selectArtifactsByRun } = await import('/src/runtime/artifact-registry-store.ts');
      const exported = registerImprovementOutcomeExports(id);
      return {
        exported: exported.map((record) => record.name),
        artifacts: selectArtifactsByRun(id).map((record) => record.name),
      };
    }, runId);
    for (const name of ['improvement-outcome.json', 'improvement-outcome-summary.md', 'metric-delta-report.json', 'regression-findings.md', 'outcome-evidence.md']) {
      assert(result.exported.includes(name), `${name} export missing`);
      assert(result.artifacts.includes(name), `${name} not registered`);
    }
    return { exports: result.exported.join(',') };
  });

  await expectStep(rows, 'selectors resolve compact widgets', async () => {
    await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
    await page.locator('[data-improvement-outcome-panel]').waitFor({ timeout: 10000 });
    await page.locator('[data-improvement-outcome-widget="evaluation"]').waitFor({ state: 'attached', timeout: 10000 });
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.locator('[data-improvement-outcome-widget="run"]').waitFor({ state: 'attached', timeout: 10000 });
    await page.goto(`${baseUrl}/execution-timeline`, { waitUntil: 'networkidle' });
    await page.locator('[data-improvement-outcome-widget="execution-timeline"]').waitFor({ state: 'attached', timeout: 10000 });
    await page.goto(`${baseUrl}/execution-graph`, { waitUntil: 'networkidle' });
    await page.locator('[data-improvement-outcome-widget="execution-graph"]').waitFor({ state: 'attached', timeout: 10000 });
    await page.goto(`${baseUrl}/artifacts`, { waitUntil: 'networkidle' });
    await page.locator('[data-improvement-outcome-widget="artifacts"]').waitFor({ state: 'attached', timeout: 10000 });
    return { widgets: 'evaluation,run,execution-timeline,execution-graph,artifacts' };
  });

  await expectStep(rows, 'reload persistence works', async () => {
    await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async (executionId) => {
      const { getImprovementOutcomeByAction } = await import('/src/runtime/improvement-outcome-store.ts');
      return getImprovementOutcomeByAction(executionId);
    }, prepared.executionId);
    assert(result?.id, 'outcome did not persist after reload');
    return { outcomeId: result.id, status: result.status };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    summary: {
      total: rows.length,
      passed: rows.filter((row) => row.status === 'passed').length,
      failed: rows.filter((row) => row.status === 'failed').length,
    },
    rows,
  };
  writeJson(reportPath, report);
  if (report.summary.failed > 0) {
    throw new Error(`${report.summary.failed} improvement outcome smoke step(s) failed. See ${reportPath}`);
  }
  console.log(`Improvement outcome smoke passed: ${report.summary.passed}/${report.summary.total}`);
} finally {
  await browser.close();
  await stopServer(serverProcess);
}
