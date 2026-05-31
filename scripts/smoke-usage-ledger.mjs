import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/usage-ledger-smoke.json');

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
    rows.push({ ...details, name, status: 'passed' });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

async function advanceUntil(page, eventType, maxTicks = 24) {
  return page.evaluate(async ({ eventType, maxTicks }) => {
    const { nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const { getStreamEvents } = await import('/src/runtime-store/stream-store.ts');
    for (let guard = 0; guard < maxTicks; guard += 1) {
      if (getStreamEvents('run-demo-module-3').some((event) => event.type === eventType)) break;
      await nextStreamTick('run-demo-module-3');
    }
    return getStreamEvents('run-demo-module-3');
  }, { eventType, maxTicks });
}

const serverProcess = await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
const rows = [];

try {
  await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { resetRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
    const { resetWorkflowState } = await import('/src/state/workflow-engine.ts');
    const { resetUsageLedgerStore } = await import('/src/runtime-store/usage-ledger-store.ts');
    resetRuntimeState();
    resetWorkflowState();
    resetUsageLedgerStore();
    window.sessionStorage.removeItem('uikigai-demo-ui-state');
  });

  await expectStep(rows, 'usage record created when run starts', async () => {
    const result = await page.evaluate(async () => {
      const { startStreamingRun } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getUsageByRun } = await import('/src/runtime-store/usage-ledger-store.ts');
      await startStreamingRun('ticket-audit-module-3');
      return getUsageByRun('run-demo-module-3').map((record) => record.type);
    });
    assert(result.includes('runtime_duration'), `start usage missing: ${result.join(',')}`);
    return { records: result.join(',') };
  });

  await expectStep(rows, 'tool call usage recorded', async () => {
    await advanceUntil(page, 'tool.started');
    const result = await page.evaluate(async () => {
      const { getUsageByRun } = await import('/src/runtime-store/usage-ledger-store.ts');
      return getUsageByRun('run-demo-module-3').filter((record) => record.type === 'tool_call');
    });
    assert(result.length >= 1, 'tool_call usage missing');
    return { toolCalls: result.length };
  });

  await expectStep(rows, 'token and duration usage recorded', async () => {
    await advanceUntil(page, 'tool.completed');
    const result = await page.evaluate(async () => {
      const { getUsageByRun } = await import('/src/runtime-store/usage-ledger-store.ts');
      return {
        tokens: getUsageByRun('run-demo-module-3').filter((record) => record.type === 'token').length,
        duration: getUsageByRun('run-demo-module-3').filter((record) => record.type === 'runtime_duration').length,
      };
    });
    assert(result.tokens >= 1, 'token usage missing');
    assert(result.duration >= 2, 'duration usage missing');
    return result;
  });

  await expectStep(rows, 'artifact usage recorded', async () => {
    await advanceUntil(page, 'artifact.created');
    const result = await page.evaluate(async () => {
      const { getUsageByRun } = await import('/src/runtime-store/usage-ledger-store.ts');
      return getUsageByRun('run-demo-module-3').filter((record) => record.type === 'artifact');
    });
    assert(result.length >= 1, 'artifact usage missing');
    return { artifacts: result.length };
  });

  await expectStep(rows, 'billing ledger finalized', async () => {
    const result = await page.evaluate(async () => {
      const { completeStreamingRun } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getBillingLedger } = await import('/src/runtime-store/usage-ledger-store.ts');
      await completeStreamingRun('run-demo-module-3');
      const ledger = getBillingLedger('run-demo-module-3');
      return { status: ledger.status, actualTotal: ledger.actualTotal, records: ledger.records.length };
    });
    assert(result.status === 'finalized', `ledger not finalized: ${result.status}`);
    assert(result.actualTotal > 0, 'actual total missing');
    assert(result.records >= 6, `ledger records too low: ${result.records}`);
    return result;
  });

  await expectStep(rows, 'estimated vs actual variance calculated', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      return selectors.selectEstimatedVsActualCost('run-demo-module-3');
    });
    assert(typeof result.variance === 'number', 'variance missing');
    assert(result.actualTotal > 0, 'actual cost missing');
    return result;
  });

  await expectStep(rows, 'quota warning works', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { estimateRunPlanBudget } = await import('/src/integrations/growthos-runtime/execution-budget.ts');
      const { evaluateQuotaBeforeRun } = await import('/src/integrations/growthos-runtime/usage-ledger.ts');
      const { setUsageQuotas } = await import('/src/runtime-store/usage-ledger-store.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
      const estimate = estimateRunPlanBudget(plan);
      setUsageQuotas([{ id: 'warning-cost', scope: 'workspace', limitType: 'cost', limit: Number((estimate.estimatedCost * 1.1).toFixed(4)), used: 0, remaining: 0, status: 'ok' }]);
      const report = evaluateQuotaBeforeRun(plan.id);
      return { status: report.status, warnings: report.warnings.length, cost: estimate.estimatedCost };
    });
    assert(result.status === 'warning', `expected warning, got ${result.status}`);
    assert(result.warnings > 0, 'quota warning missing');
    return result;
  });

  await expectStep(rows, 'quota block works', async () => {
    const result = await page.evaluate(async () => {
      const { estimateRunPlanBudget } = await import('/src/integrations/growthos-runtime/execution-budget.ts');
      const { evaluateQuotaBeforeRun } = await import('/src/integrations/growthos-runtime/usage-ledger.ts');
      const { startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getRunPlan } = await import('/src/runtime-store/run-plan-store.ts');
      const { setUsageQuotas } = await import('/src/runtime-store/usage-ledger-store.ts');
      const plan = getRunPlan('run-plan-ticket-audit-module-3-demo-run-execution');
      const estimate = estimateRunPlanBudget(plan);
      setUsageQuotas([{ id: 'block-cost', scope: 'workspace', limitType: 'cost', limit: Number((estimate.estimatedCost * 0.5).toFixed(4)), used: 0, remaining: 0, status: 'ok' }]);
      const report = evaluateQuotaBeforeRun(plan.id);
      let blocked = false;
      try {
        await startRunFromPlan(plan.id);
      } catch {
        blocked = true;
      }
      return { status: report.status, blocked, reasons: report.blockingReasons.length };
    });
    assert(result.status === 'exceeded', `expected exceeded, got ${result.status}`);
    assert(result.blocked, 'quota-blocked plan started');
    assert(result.reasons > 0, 'quota block reason missing');
    return result;
  });

  await expectStep(rows, 'ledger persists after reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      const ledger = selectors.selectUsageLedger('run-demo-module-3');
      return { status: ledger.status, actualTotal: ledger.actualTotal, records: ledger.records.length };
    });
    assert(result.status === 'finalized', `persisted ledger not finalized: ${result.status}`);
    assert(result.records >= 6, `persisted records too low: ${result.records}`);
    return result;
  });

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    summary: {
      checked: rows.length,
      passed: rows.filter((row) => row.status === 'passed').length,
      failed: rows.filter((row) => row.status !== 'passed').length,
    },
    rows,
  };
  writeJson(reportPath, report);

  console.log('| Usage ledger | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nUsage ledger smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
