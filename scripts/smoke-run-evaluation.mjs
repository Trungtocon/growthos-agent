import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/run-evaluation-smoke.json');
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
    clearGovernanceDecisionStore();
    createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
    await startStreamingRun('ticket-audit-module-3');
    for (let guard = 0; guard < 24 && !isStreamComplete(id); guard += 1) {
      await nextStreamTick(id);
    }
    recordGovernanceDecision(evaluateGovernanceDecision({
      targetId: id,
      targetType: 'runtime',
      action: 'runEvaluationSmokeGovernanceDecision',
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

  await expectStep(rows, 'evaluation builds for demo run', async () => {
    const result = await page.evaluate(async (id) => {
      const { evaluateRun } = await import('/src/runtime/run-evaluation-store.ts');
      const evaluation = evaluateRun(id);
      return { id: evaluation.id, score: evaluation.overallScore, status: evaluation.status };
    }, runId);
    assert(result.id === `run-evaluation-${runId}`, 'evaluation id mismatch');
    assert(result.score > 0, 'overall score missing');
    return result;
  });

  await expectStep(rows, 'all score dimensions exist', async () => {
    const result = await page.evaluate(async (id) => {
      const { getRunEvaluation } = await import('/src/runtime/run-evaluation-store.ts');
      return getRunEvaluation(id).scores.map((score) => score.dimension);
    }, runId);
    for (const dimension of ['task_completion', 'artifact_quality', 'tool_success', 'approval_compliance', 'governance_compliance', 'cost_efficiency', 'replay_integrity', 'overall_score']) {
      assert(result.includes(dimension), `${dimension} missing`);
    }
    return { dimensions: result.join(',') };
  });

  await expectStep(rows, 'overall_score is calculated', async () => {
    const result = await page.evaluate(async (id) => {
      const { getRunEvaluation } = await import('/src/runtime/run-evaluation-store.ts');
      const evaluation = getRunEvaluation(id);
      return { overall: evaluation.overallScore, scoreRows: evaluation.scores.length };
    }, runId);
    assert(result.overall >= 0 && result.overall <= 100, 'overall score is out of range');
    assert(result.scoreRows === 8, 'unexpected score row count');
    return result;
  });

  await expectStep(rows, 'artifact completeness is evaluated', async () => {
    const result = await page.evaluate(async (id) => {
      const { evaluateArtifactCompleteness } = await import('/src/runtime/run-evaluation-store.ts');
      return evaluateArtifactCompleteness(id);
    }, runId);
    assert(result.dimension === 'artifact_quality', 'artifact dimension mismatch');
    assert(result.value > 0, 'artifact score missing');
    return { score: result.value, evidence: result.evidence };
  });

  await expectStep(rows, 'tool failures are detected or marked clean', async () => {
    const result = await page.evaluate(async (id) => {
      const { evaluateToolFailures, getRunEvaluation } = await import('/src/runtime/run-evaluation-store.ts');
      return { score: evaluateToolFailures(id).value, failures: getRunEvaluation(id).toolFailureCount };
    }, runId);
    assert(result.failures >= 0, 'tool failure count missing');
    assert(result.score >= 0, 'tool score missing');
    return result;
  });

  await expectStep(rows, 'approval compliance is evaluated', async () => {
    const result = await page.evaluate(async (id) => {
      const { evaluateApprovalCompliance } = await import('/src/runtime/run-evaluation-store.ts');
      return evaluateApprovalCompliance(id);
    }, runId);
    assert(result.dimension === 'approval_compliance', 'approval dimension mismatch');
    return { score: result.value, evidence: result.evidence };
  });

  await expectStep(rows, 'governance compliance is evaluated', async () => {
    const result = await page.evaluate(async (id) => {
      const { evaluateGovernanceCompliance } = await import('/src/runtime/run-evaluation-store.ts');
      return evaluateGovernanceCompliance(id);
    }, runId);
    assert(result.dimension === 'governance_compliance', 'governance dimension mismatch');
    return { score: result.value, evidence: result.evidence };
  });

  await expectStep(rows, 'cost efficiency is evaluated', async () => {
    const result = await page.evaluate(async (id) => {
      const { evaluateCostEfficiency } = await import('/src/runtime/run-evaluation-store.ts');
      return evaluateCostEfficiency(id);
    }, runId);
    assert(result.dimension === 'cost_efficiency', 'cost dimension mismatch');
    return { score: result.value, evidence: result.evidence };
  });

  await expectStep(rows, 'replay integrity is evaluated', async () => {
    const result = await page.evaluate(async (id) => {
      const { evaluateReplayIntegrity } = await import('/src/runtime/run-evaluation-store.ts');
      return evaluateReplayIntegrity(id);
    }, runId);
    assert(result.dimension === 'replay_integrity', 'replay dimension mismatch');
    assert(result.value > 0, 'replay score missing');
    return { score: result.value, evidence: result.evidence };
  });

  await expectStep(rows, 'recommendations are generated', async () => {
    const result = await page.evaluate(async (id) => {
      const { getRunEvaluationRecommendations } = await import('/src/runtime/run-evaluation-store.ts');
      return getRunEvaluationRecommendations(id);
    }, runId);
    assert(Array.isArray(result), 'recommendations did not return an array');
    return { recommendations: result.length };
  });

  await expectStep(rows, 'evaluation persists after reload', async () => {
    const before = await page.evaluate(async (id) => {
      const { getRunEvaluation } = await import('/src/runtime/run-evaluation-store.ts');
      return getRunEvaluation(id).evaluatedAt;
    }, runId);
    await page.reload({ waitUntil: 'networkidle' });
    const after = await page.evaluate(async (id) => {
      const { getRunEvaluation } = await import('/src/runtime/run-evaluation-store.ts');
      return getRunEvaluation(id).evaluatedAt;
    }, runId);
    assert(before === after, 'evaluation timestamp changed after reload');
    return { evaluatedAt: after };
  });

  await expectStep(rows, 'artifact exports registered', async () => {
    const result = await page.evaluate(async (id) => {
      const { registerRunEvaluationExports } = await import('/src/runtime/run-evaluation-store.ts');
      const { selectArtifactsByRun } = await import('/src/runtime/artifact-registry-store.ts');
      const exported = registerRunEvaluationExports(id);
      return {
        exported: exported.map((record) => record.name),
        artifacts: selectArtifactsByRun(id).map((record) => record.name),
      };
    }, runId);
    for (const name of ['run-evaluation.json', 'run-evaluation-summary.md', 'run-quality-report.md', 'evaluation-issues.json']) {
      assert(result.exported.includes(name), `${name} export missing`);
      assert(result.artifacts.includes(name), `${name} not registered to run`);
    }
    return { exports: result.exported.join(',') };
  });

  await expectStep(rows, 'evaluation route and compact widgets render', async () => {
    await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
    await page.locator('[data-run-evaluation-route]').waitFor({ timeout: 10000 });
    await page.locator('[data-evaluation-score="overall_score"]').waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.locator('[data-run-evaluation-widget="run"]').waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/execution-timeline`, { waitUntil: 'networkidle' });
    await page.locator('[data-run-evaluation-widget="execution-timeline"]').waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/execution-graph`, { waitUntil: 'networkidle' });
    await page.locator('[data-run-evaluation-widget="execution-graph"]').waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/artifacts`, { waitUntil: 'networkidle' });
    await page.locator('[data-run-evaluation-widget="artifacts"]').waitFor({ timeout: 10000 });
    return { route: '/evaluation', widgets: 'run,execution-timeline,execution-graph,artifacts' };
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
    throw new Error(`${report.summary.failed} run evaluation smoke step(s) failed. See ${reportPath}`);
  }
  console.log(`Run evaluation smoke passed: ${report.summary.passed}/${report.summary.total}`);
} finally {
  await browser.close();
  await stopServer(serverProcess);
}
