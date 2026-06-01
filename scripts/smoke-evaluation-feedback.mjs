import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/evaluation-feedback-smoke.json');
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
    const { clearEvaluationFeedbackStore } = await import('/src/runtime/evaluation-feedback-store.ts');
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
    clearGovernanceDecisionStore();
    createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
    await startStreamingRun('ticket-audit-module-3');
    for (let guard = 0; guard < 24 && !isStreamComplete(id); guard += 1) {
      await nextStreamTick(id);
    }
    recordGovernanceDecision(evaluateGovernanceDecision({
      targetId: id,
      targetType: 'runtime',
      action: 'evaluationFeedbackSmokeGovernanceDecision',
    }));
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

  await expectStep(rows, 'feedback builds for demo run', async () => {
    const result = await page.evaluate(async (id) => {
      const { generateFeedbackForRun } = await import('/src/runtime/evaluation-feedback-store.ts');
      const feedback = generateFeedbackForRun(id);
      return { id: feedback.id, runId: feedback.runId, suggestions: feedback.suggestions.length, version: feedback.version };
    }, runId);
    assert(result.id === `evaluation-feedback-${runId}`, 'feedback id mismatch');
    assert(result.suggestions >= 1, 'suggestions missing');
    return result;
  });

  await expectStep(rows, 'suggestions generated from evaluation issues', async () => {
    const result = await page.evaluate(async (id) => {
      const { getRunEvaluationIssues } = await import('/src/runtime/run-evaluation-store.ts');
      const { convertIssuesToSuggestions } = await import('/src/runtime/evaluation-feedback-store.ts');
      const issues = getRunEvaluationIssues(id);
      const suggestions = convertIssuesToSuggestions(issues);
      return { issues: issues.length, suggestions: suggestions.length, categories: suggestions.map((item) => item.category) };
    }, runId);
    assert(result.suggestions >= result.issues || result.issues === 0, 'issue conversion dropped suggestions unexpectedly');
    return result;
  });

  await expectStep(rows, 'priorities assigned correctly', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackSuggestions } = await import('/src/runtime/evaluation-feedback-store.ts');
      const suggestions = getFeedbackSuggestions(id);
      return { priorities: suggestions.map((item) => item.priority), count: suggestions.length };
    }, runId);
    assert(result.count > 0, 'no suggestions to check');
    assert(result.priorities.every((priority) => ['low', 'medium', 'high', 'critical'].includes(priority)), 'invalid priority present');
    return result;
  });

  await expectStep(rows, 'actions generated', async () => {
    const result = await page.evaluate(async (id) => {
      const { getFeedbackActions, getFeedbackSuggestions } = await import('/src/runtime/evaluation-feedback-store.ts');
      return { actions: getFeedbackActions(id).length, suggestions: getFeedbackSuggestions(id).length };
    }, runId);
    assert(result.actions === result.suggestions, 'action count does not match suggestions');
    return result;
  });

  await expectStep(rows, 'workspace summary generated', async () => {
    const result = await page.evaluate(async () => {
      const { generateWorkspaceFeedbackSummary } = await import('/src/runtime/evaluation-feedback-store.ts');
      return generateWorkspaceFeedbackSummary();
    });
    assert(result.feedbackCount >= 1, 'workspace feedback count missing');
    assert(result.suggestionCount >= 1, 'workspace suggestion count missing');
    return result;
  });

  await expectStep(rows, 'critical feedback selector works', async () => {
    const result = await page.evaluate(async (id) => {
      const { selectCriticalFeedbackItems } = await import('/src/domain/selectors.ts');
      return selectCriticalFeedbackItems(id);
    }, runId);
    assert(Array.isArray(result), 'critical feedback selector did not return an array');
    return { critical: result.length };
  });

  await expectStep(rows, 'top suggestions selector works', async () => {
    const result = await page.evaluate(async (id) => {
      const { selectTopImprovementSuggestions } = await import('/src/domain/selectors.ts');
      return selectTopImprovementSuggestions(3, id);
    }, runId);
    assert(result.length > 0 && result.length <= 3, 'top suggestions selector returned unexpected count');
    return { top: result.length, first: result[0]?.title };
  });

  await expectStep(rows, 'feedback persists after reload', async () => {
    const before = await page.evaluate(async (id) => {
      const { getEvaluationFeedbackByRun } = await import('/src/runtime/evaluation-feedback-store.ts');
      return getEvaluationFeedbackByRun(id).updatedAt;
    }, runId);
    await page.reload({ waitUntil: 'networkidle' });
    const after = await page.evaluate(async (id) => {
      const { getEvaluationFeedbackByRun } = await import('/src/runtime/evaluation-feedback-store.ts');
      return getEvaluationFeedbackByRun(id).updatedAt;
    }, runId);
    assert(before === after, 'feedback timestamp changed after reload');
    return { updatedAt: after };
  });

  await expectStep(rows, 'regenerate feedback updates timestamp/version', async () => {
    const result = await page.evaluate(async (id) => {
      const { getEvaluationFeedbackByRun, regenerateFeedbackForRun } = await import('/src/runtime/evaluation-feedback-store.ts');
      const before = getEvaluationFeedbackByRun(id);
      const after = regenerateFeedbackForRun(id);
      return { beforeVersion: before.version, afterVersion: after.version, beforeUpdatedAt: before.updatedAt, afterUpdatedAt: after.updatedAt };
    }, runId);
    assert(result.afterVersion === result.beforeVersion + 1, 'feedback version did not increment');
    assert(result.afterUpdatedAt >= result.beforeUpdatedAt, 'feedback timestamp did not update');
    return result;
  });

  await expectStep(rows, 'artifact exports registered', async () => {
    const result = await page.evaluate(async (id) => {
      const { registerEvaluationFeedbackExports } = await import('/src/runtime/evaluation-feedback-store.ts');
      const { selectArtifactsByRun } = await import('/src/runtime/artifact-registry-store.ts');
      const exported = registerEvaluationFeedbackExports(id);
      return {
        exported: exported.map((record) => record.name),
        artifacts: selectArtifactsByRun(id).map((record) => record.name),
      };
    }, runId);
    for (const name of ['evaluation-feedback.json', 'improvement-suggestions.md', 'feedback-actions.json', 'workspace-feedback-summary.md']) {
      assert(result.exported.includes(name), `${name} export missing`);
      assert(result.artifacts.includes(name), `${name} not registered to run`);
    }
    return { exports: result.exported.join(',') };
  });

  await expectStep(rows, 'no duplicate feedback IDs', async () => {
    const result = await page.evaluate(async (id) => {
      const { getEvaluationFeedbackByRun, regenerateFeedbackForRun } = await import('/src/runtime/evaluation-feedback-store.ts');
      const first = getEvaluationFeedbackByRun(id).id;
      const second = regenerateFeedbackForRun(id).id;
      const third = regenerateFeedbackForRun(id).id;
      return { ids: [first, second, third], unique: new Set([first, second, third]).size };
    }, runId);
    assert(result.unique === 1, 'duplicate feedback records created');
    return result;
  });

  await expectStep(rows, 'UI selectors resolve compact widgets', async () => {
    await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
    await page.locator('[data-evaluation-feedback-panel]').waitFor({ timeout: 10000 });
    await page.locator('[data-feedback-suggestion]').first().waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.locator('[data-evaluation-feedback-widget="run"]').waitFor({ state: 'attached', timeout: 10000 });
    await page.goto(`${baseUrl}/execution-timeline`, { waitUntil: 'networkidle' });
    await page.locator('[data-evaluation-feedback-widget="execution-timeline"]').waitFor({ state: 'attached', timeout: 10000 });
    await page.goto(`${baseUrl}/execution-graph`, { waitUntil: 'networkidle' });
    await page.locator('[data-evaluation-feedback-widget="execution-graph"]').waitFor({ state: 'attached', timeout: 10000 });
    await page.goto(`${baseUrl}/artifacts`, { waitUntil: 'networkidle' });
    await page.locator('[data-evaluation-feedback-widget="artifacts"]').waitFor({ state: 'attached', timeout: 10000 });
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
    throw new Error(`${report.summary.failed} evaluation feedback smoke step(s) failed. See ${reportPath}`);
  }
  console.log(`Evaluation feedback smoke passed: ${report.summary.passed}/${report.summary.total}`);
} finally {
  await browser.close();
  await stopServer(serverProcess);
}
