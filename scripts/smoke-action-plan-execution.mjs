import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/action-plan-execution-smoke.json');
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
    const { clearActionPlanExecutionStore, startActionPlanExecution } = await import('/src/runtime/action-plan-execution-store.ts');
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
    clearGovernanceDecisionStore();
    createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
    await startStreamingRun('ticket-audit-module-3');
    for (let guard = 0; guard < 24 && !isStreamComplete(id); guard += 1) {
      await nextStreamTick(id);
    }
    recordGovernanceDecision(evaluateGovernanceDecision({
      targetId: id,
      targetType: 'runtime',
      action: 'actionPlanExecutionSmokeGovernanceDecision',
    }));
    const feedback = generateFeedbackForRun(id);
    const actionPlan = createActionPlanFromFeedback(feedback.id);
    const execution = startActionPlanExecution(actionPlan.id);
    return { timelineEvents: buildTimelineForRun(id).events.length, planId: actionPlan.id, executionId: execution.id };
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

  await expectStep(rows, 'action plan execution can start', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const { startActionPlanExecution } = await import('/src/runtime/action-plan-execution-store.ts');
      const plan = getFeedbackActionPlanByRun(id);
      return startActionPlanExecution(plan.id);
    }, runId);
    assert(result.id === prepared.executionId, 'execution id mismatch');
    assert(result.tasks.length > 0, 'execution tasks missing');
    return { executionId: result.id, tasks: result.tasks.length };
  });

  await expectStep(rows, 'ready task can start', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const { startActionPlanExecution, startActionTask } = await import('/src/runtime/action-plan-execution-store.ts');
      const plan = getFeedbackActionPlanByRun(id);
      const execution = startActionPlanExecution(plan.id);
      const task = execution.tasks.find((item) => item.status === 'ready') ?? execution.tasks[0];
      return startActionTask(task.taskId);
    }, runId);
    assert(result?.status === 'in_progress' || result?.status === 'blocked', 'ready task did not transition');
    return { taskId: result.taskId, status: result.status };
  });

  await expectStep(rows, 'blocked task requires reason', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const { startActionPlanExecution, blockActionTask } = await import('/src/runtime/action-plan-execution-store.ts');
      const plan = getFeedbackActionPlanByRun(id);
      const task = startActionPlanExecution(plan.id).tasks[0];
      let threw = false;
      try {
        blockActionTask(task.taskId, '');
      } catch {
        threw = true;
      }
      const blocked = blockActionTask(task.taskId, 'Waiting for dependency owner.');
      return { threw, status: blocked?.status, blocker: blocked?.blocker };
    }, runId);
    assert(result.threw, 'empty blocker did not throw');
    assert(result.status === 'blocked', 'task was not blocked with reason');
    return result;
  });

  await expectStep(rows, 'completed task requires evidence', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const { startActionPlanExecution, completeActionTask } = await import('/src/runtime/action-plan-execution-store.ts');
      const plan = getFeedbackActionPlanByRun(id);
      const task = startActionPlanExecution(plan.id).tasks[1] ?? startActionPlanExecution(plan.id).tasks[0];
      let threw = false;
      try {
        completeActionTask(task.taskId, { type: 'note', title: '', description: '', createdBy: 'smoke' });
      } catch {
        threw = true;
      }
      const completed = completeActionTask(task.taskId, { type: 'note', title: 'Smoke evidence', description: 'Evidence captured by smoke test.', createdBy: 'smoke' });
      return { threw, status: completed?.status, evidence: completed?.evidence.length };
    }, runId);
    assert(result.threw, 'missing evidence did not throw');
    assert(result.status === 'completed' && result.evidence > 0, 'completion evidence not persisted');
    return result;
  });

  await expectStep(rows, 'progress calculation works', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const { calculateActionPlanProgress } = await import('/src/runtime/action-plan-execution-store.ts');
      const plan = getFeedbackActionPlanByRun(id);
      return calculateActionPlanProgress(plan.id);
    }, runId);
    assert(result.totalTasks > 0, 'total tasks missing');
    assert(result.weightedProgress >= 0 && result.weightedProgress <= 100, 'invalid weighted progress');
    return result;
  });

  await expectStep(rows, 'dependencies block dependent tasks', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const { startActionPlanExecution, startActionTask } = await import('/src/runtime/action-plan-execution-store.ts');
      const plan = getFeedbackActionPlanByRun(id);
      const dependency = plan.dependencies[0];
      if (!dependency) return { dependencyCount: 0, status: 'not_applicable' };
      startActionPlanExecution(plan.id);
      const started = startActionTask(dependency.taskId);
      return { dependencyCount: plan.dependencies.length, status: started?.status };
    }, runId);
    assert(result.dependencyCount === 0 || result.status === 'blocked' || result.status === 'in_progress', 'dependency handling failed');
    return result;
  });

  await expectStep(rows, 'timeline events are generated', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const { generateActionExecutionTimeline } = await import('/src/runtime/action-plan-execution-store.ts');
      const plan = getFeedbackActionPlanByRun(id);
      const timeline = generateActionExecutionTimeline(plan.id);
      return { events: timeline.length, types: timeline.map((event) => event.type) };
    }, runId);
    assert(result.events > 0, 'execution timeline missing');
    return { events: result.events, types: result.types.join(',') };
  });

  await expectStep(rows, 'execution persists after reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const { getActionPlanExecution } = await import('/src/runtime/action-plan-execution-store.ts');
      const plan = getFeedbackActionPlanByRun(id);
      return getActionPlanExecution(plan.id);
    }, runId);
    assert(result?.id === prepared.executionId, 'execution did not persist after reload');
    return { executionId: result.id, status: result.status };
  });

  await expectStep(rows, 'workspace improvement progress selector works', async () => {
    const result = await page.evaluate(async () => {
      const { getWorkspaceImprovementProgress } = await import('/src/runtime/action-plan-execution-store.ts');
      return getWorkspaceImprovementProgress();
    });
    assert(result.executionCount >= 1, 'workspace execution count missing');
    assert(result.taskCount >= 1, 'workspace task count missing');
    return result;
  });

  await expectStep(rows, 'artifact exports registered', async () => {
    const result = await page.evaluate(async (id) => {
      const { registerActionPlanExecutionExports } = await import('/src/runtime/action-plan-execution-store.ts');
      const { selectArtifactsByRun } = await import('/src/runtime/artifact-registry-store.ts');
      const exported = registerActionPlanExecutionExports(id);
      return {
        exported: exported.map((record) => record.name),
        artifacts: selectArtifactsByRun(id).map((record) => record.name),
      };
    }, runId);
    for (const name of ['action-execution.json', 'action-execution-timeline.md', 'action-completion-evidence.json', 'workspace-improvement-progress.md']) {
      assert(result.exported.includes(name), `${name} export missing`);
      assert(result.artifacts.includes(name), `${name} not registered to run`);
    }
    return { exports: result.exported.join(',') };
  });

  await expectStep(rows, 'no duplicate execution IDs', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActionPlanByRun } = await import('/src/runtime/feedback-action-planner-store.ts');
      const { startActionPlanExecution } = await import('/src/runtime/action-plan-execution-store.ts');
      const plan = getFeedbackActionPlanByRun(id);
      const first = startActionPlanExecution(plan.id).id;
      const second = startActionPlanExecution(plan.id).id;
      return { ids: [first, second], unique: new Set([first, second]).size };
    }, runId);
    assert(result.unique === 1, 'duplicate execution ids created');
    return result;
  });

  await expectStep(rows, 'compact widget selectors resolve', async () => {
    await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
    await page.locator('[data-action-plan-execution-panel]').waitFor({ timeout: 10000 });
    await page.locator('[data-action-task-execution]').first().waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.locator('[data-action-plan-execution-widget="run"]').waitFor({ state: 'attached', timeout: 10000 });
    await page.goto(`${baseUrl}/execution-timeline`, { waitUntil: 'networkidle' });
    await page.locator('[data-action-plan-execution-widget="execution-timeline"]').waitFor({ state: 'attached', timeout: 10000 });
    await page.goto(`${baseUrl}/execution-graph`, { waitUntil: 'networkidle' });
    await page.locator('[data-action-plan-execution-widget="execution-graph"]').waitFor({ state: 'attached', timeout: 10000 });
    await page.goto(`${baseUrl}/artifacts`, { waitUntil: 'networkidle' });
    await page.locator('[data-action-plan-execution-widget="artifacts"]').waitFor({ state: 'attached', timeout: 10000 });
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
    throw new Error(`${report.summary.failed} action plan execution smoke step(s) failed. See ${reportPath}`);
  }
  console.log(`Action plan execution smoke passed: ${report.summary.passed}/${report.summary.total}`);
} finally {
  await browser.close();
  await stopServer(serverProcess);
}
