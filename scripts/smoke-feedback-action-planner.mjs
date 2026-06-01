import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/feedback-action-planner-smoke.json');
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
    const { clearFeedbackActionPlanStore } = await import('/src/runtime/feedback-action-planner-store.ts');
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
    clearGovernanceDecisionStore();
    createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
    await startStreamingRun('ticket-audit-module-3');
    for (let guard = 0; guard < 24 && !isStreamComplete(id); guard += 1) {
      await nextStreamTick(id);
    }
    recordGovernanceDecision(evaluateGovernanceDecision({
      targetId: id,
      targetType: 'runtime',
      action: 'feedbackActionPlannerSmokeGovernanceDecision',
    }));
    generateFeedbackForRun(id);
    return buildTimelineForRun(id).events.length;
  }, runId);
}

const serverProcess = await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
const rows = [];

try {
  await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
  await prepareRuntime(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-run-evaluation-route]').waitFor({ timeout: 10000 });

  await expectStep(rows, 'action plan builds from feedback', async () => {
    const result = await page.evaluate(async (id) => {
      const { getEvaluationFeedbackByRun } = await import('/src/runtime/evaluation-feedback-store.ts');
      const { createActionPlanFromFeedback } = await import('/src/runtime/feedback-action-planner-store.ts');
      const feedback = getEvaluationFeedbackByRun(id);
      const plan = createActionPlanFromFeedback(feedback.id);
      return { planId: plan.id, feedbackId: plan.feedbackId, tasks: plan.tasks.length, status: plan.status };
    }, runId);
    assert(result.feedbackId === `evaluation-feedback-${runId}`, 'feedback id mismatch');
    assert(result.tasks > 0, 'plan tasks missing');
    return result;
  });

  await expectStep(rows, 'suggestions convert into tasks', async () => {
    const result = await page.evaluate(async (id) => {
      const { getEvaluationFeedbackByRun } = await import('/src/runtime/evaluation-feedback-store.ts');
      const { getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const feedback = getEvaluationFeedbackByRun(id);
      const plan = getFeedbackActionPlanByRun(id);
      return { suggestions: feedback.suggestions.length, tasks: plan.tasks.length };
    }, runId);
    assert(result.tasks === result.suggestions, 'task count does not match suggestions');
    return result;
  });

  await expectStep(rows, 'priorities preserved', async () => {
    const result = await page.evaluate(async (id) => {
      const { getEvaluationFeedbackByRun } = await import('/src/runtime/evaluation-feedback-store.ts');
      const { getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const suggestions = getEvaluationFeedbackByRun(id).suggestions.map((item) => item.priority).sort();
      const tasks = getFeedbackActionPlanByRun(id).tasks.map((item) => item.priority).sort();
      return { suggestions, tasks };
    }, runId);
    assert(JSON.stringify(result.suggestions) === JSON.stringify(result.tasks), 'priorities were not preserved');
    return { priorities: result.tasks.join(',') };
  });

  await expectStep(rows, 'dependencies detected', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const plan = getFeedbackActionPlanByRun(id);
      return { dependencies: plan.dependencies.length, blocking: plan.dependencies.filter((item) => item.blocking).length };
    }, runId);
    assert(result.dependencies >= 0, 'dependency count missing');
    return result;
  });

  await expectStep(rows, 'readiness calculated', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActionPlanByRun, getActionPlanReadiness } = await import('/src/runtime/feedback-action-planner-store.ts');
      const plan = getFeedbackActionPlanByRun(id);
      return getActionPlanReadiness(plan.id);
    }, runId);
    assert(['ready', 'blocked', 'draft'].includes(result.readiness), 'invalid readiness');
    return result;
  });

  await expectStep(rows, 'critical tasks become ready', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const critical = getFeedbackActionPlanByRun(id).tasks.filter((task) => task.priority === 'critical');
      return { critical: critical.length, readyOrBlocked: critical.filter((task) => ['ready', 'blocked'].includes(task.status)).length };
    }, runId);
    assert(result.readyOrBlocked === result.critical, 'critical tasks were not actionable');
    return result;
  });

  await expectStep(rows, 'blocked tasks are detected', async () => {
    const result = await page.evaluate(async (id) => {
      const { getBlockedActionTasks, getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const blocked = getBlockedActionTasks(id);
      return { blocked: blocked.length, dependencyCount: getFeedbackActionPlanByRun(id).dependencies.length };
    }, runId);
    assert(result.blocked >= 0, 'blocked task selector failed');
    return result;
  });

  await expectStep(rows, 'task status update persists', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActionPlanByRun, markActionTaskStatus } = await import('/src/runtime/feedback-action-planner-store.ts');
      const task = getFeedbackActionPlanByRun(id).tasks[0];
      markActionTaskStatus(task.id, 'in_progress');
      return getFeedbackActionPlanByRun(id).tasks.find((item) => item.id === task.id);
    }, runId);
    assert(result?.status === 'in_progress', 'task status did not persist');
    return { taskId: result.id, status: result.status };
  });

  await expectStep(rows, 'acceptance criteria generated', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const criteria = getFeedbackActionPlanByRun(id).tasks.flatMap((task) => task.acceptanceCriteria);
      return { criteria: criteria.length, required: criteria.filter((item) => item.required).length };
    }, runId);
    assert(result.criteria > 0 && result.required === result.criteria, 'acceptance criteria missing');
    return result;
  });

  await expectStep(rows, 'workspace summary generated', async () => {
    const result = await page.evaluate(async () => {
      const { getWorkspaceActionPlanSummary } = await import('/src/runtime/feedback-action-planner-store.ts');
      return getWorkspaceActionPlanSummary();
    });
    assert(result.planCount >= 1, 'plan count missing');
    assert(result.taskCount >= 1, 'task count missing');
    return result;
  });

  await expectStep(rows, 'artifact exports registered', async () => {
    const result = await page.evaluate(async (id) => {
      const { registerFeedbackActionPlanExports } = await import('/src/runtime/feedback-action-planner-store.ts');
      const { selectArtifactsByRun } = await import('/src/runtime/artifact-registry-store.ts');
      const exported = registerFeedbackActionPlanExports(id);
      return {
        exported: exported.map((record) => record.name),
        artifacts: selectArtifactsByRun(id).map((record) => record.name),
      };
    }, runId);
    for (const name of ['feedback-action-plan.json', 'feedback-action-plan.md', 'feedback-action-tasks.json', 'improvement-roadmap.md']) {
      assert(result.exported.includes(name), `${name} export missing`);
      assert(result.artifacts.includes(name), `${name} not registered to run`);
    }
    return { exports: result.exported.join(',') };
  });

  await expectStep(rows, 'no duplicate plan IDs', async () => {
    const result = await page.evaluate(async (id) => {
      const { getEvaluationFeedbackByRun } = await import('/src/runtime/evaluation-feedback-store.ts');
      const { createActionPlanFromFeedback } = await import('/src/runtime/feedback-action-planner-store.ts');
      const feedback = getEvaluationFeedbackByRun(id);
      const first = createActionPlanFromFeedback(feedback.id).id;
      const second = createActionPlanFromFeedback(feedback.id).id;
      return { ids: [first, second], unique: new Set([first, second]).size };
    }, runId);
    assert(result.unique === 1, 'duplicate plan ids created');
    return result;
  });

  await expectStep(rows, 'UI action plan widgets render', async () => {
    await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
    await page.locator('[data-feedback-action-plan-panel]').waitFor({ timeout: 10000 });
    await page.locator('[data-feedback-action-task]').first().waitFor({ timeout: 10000 });
    await page.locator('[data-action-acceptance-criteria]').first().waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.locator('[data-feedback-action-plan-widget="run"]').waitFor({ state: 'attached', timeout: 10000 });
    await page.goto(`${baseUrl}/execution-timeline`, { waitUntil: 'networkidle' });
    await page.locator('[data-feedback-action-plan-widget="execution-timeline"]').waitFor({ state: 'attached', timeout: 10000 });
    await page.goto(`${baseUrl}/execution-graph`, { waitUntil: 'networkidle' });
    await page.locator('[data-feedback-action-plan-widget="execution-graph"]').waitFor({ state: 'attached', timeout: 10000 });
    await page.goto(`${baseUrl}/artifacts`, { waitUntil: 'networkidle' });
    await page.locator('[data-feedback-action-plan-widget="artifacts"]').waitFor({ state: 'attached', timeout: 10000 });
    return { widgets: 'run,execution-timeline,execution-graph,artifacts' };
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
    throw new Error(`${report.summary.failed} feedback action planner smoke step(s) failed. See ${reportPath}`);
  }
  console.log(`Feedback action planner smoke passed: ${report.summary.passed}/${report.summary.total}`);
} finally {
  await browser.close();
  await stopServer(serverProcess);
}
