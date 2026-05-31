import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/cost-reconciliation-smoke.json');

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
    rows.push({ ...details, name, status: 'passed' });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
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
    const { clearRunPlans } = await import('/src/runtime-store/run-plan-store.ts');
    const { clearPolicyReports } = await import('/src/runtime-store/plan-policy-store.ts');
    const { clearAnalytics } = await import('/src/runtime-store/workspace-analytics-store.ts');
    const { clearCostReconciliation } = await import('/src/runtime/cost-reconciliation-store.ts');
    resetRuntimeState();
    resetWorkflowState();
    resetUsageLedgerStore();
    clearRunPlans();
    clearPolicyReports();
    clearAnalytics();
    clearCostReconciliation();
    window.sessionStorage.removeItem('uikigai-demo-ui-state');
  });

  await page.evaluate(async () => {
    const { createPlanForTicket, startRunFromPlan, completeStreamingRun } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
    await startRunFromPlan(plan.id);
    await completeStreamingRun('run-demo-module-3');
  });

  await expectStep(rows, 'report generation', async () => {
    const result = await page.evaluate(async () => {
      const { generateCostReconciliationReport } = await import('/src/runtime/cost-reconciliation-store.ts');
      return generateCostReconciliationReport();
    });
    assert(result.records.length >= 1, 'reconciliation records missing');
    assert(result.providerCost > 0, 'provider cost missing');
    return { records: result.records.length, providerCost: result.providerCost, severity: result.severity };
  });

  await expectStep(rows, 'variance calculations', async () => {
    const result = await page.evaluate(async () => {
      const { calculateVariance, calculateVariancePercent } = await import('/src/runtime/cost-reconciliation.ts');
      return {
        variance: calculateVariance(10, 11.2),
        percent: calculateVariancePercent(10, 11.2),
      };
    });
    assert(result.variance === 1.2, `unexpected variance ${result.variance}`);
    assert(result.percent === 12, `unexpected percent ${result.percent}`);
    return result;
  });

  await expectStep(rows, 'severity classification', async () => {
    const result = await page.evaluate(async () => {
      const { evaluateVarianceSeverity } = await import('/src/runtime/cost-reconciliation.ts');
      return {
        normal: evaluateVarianceSeverity(5),
        warning: evaluateVarianceSeverity(7),
        critical: evaluateVarianceSeverity(11),
      };
    });
    assert(result.normal === 'NORMAL', 'normal threshold failed');
    assert(result.warning === 'WARNING', 'warning threshold failed');
    assert(result.critical === 'CRITICAL', 'critical threshold failed');
    return result;
  });

  await expectStep(rows, 'dashboard selectors', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      const costVm = selectors.selectCostDashboardViewModel();
      const runVm = selectors.selectRunConsoleViewModel('run-demo-module-3');
      return {
        reportSeverity: selectors.selectVarianceSeverity(),
        costKpis: costVm.kpis.length,
        providerCost: costVm.providerCost,
        runProviderCost: runVm.providerCost,
        alerts: selectors.selectCostAlerts().length,
        history: selectors.selectVarianceHistory().length,
      };
    });
    assert(result.costKpis >= 8, 'cost dashboard reconciliation kpis missing');
    assert(result.providerCost > 0, 'provider selector cost missing');
    assert(result.runProviderCost > 0, 'run provider cost missing');
    assert(result.history >= 1, 'variance history missing');
    return result;
  });

  await expectStep(rows, 'artifact generation', async () => {
    const result = await page.evaluate(async () => {
      const { exportCostReconciliationArtifacts } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getRunArtifacts } = await import('/src/runtime-store/artifact-store.ts');
      exportCostReconciliationArtifacts('run-demo-module-3');
      const artifacts = getRunArtifacts('run-demo-module-3');
      return {
        json: artifacts.find((artifact) => artifact.name === 'cost-report.json')?.type,
        md: artifacts.find((artifact) => artifact.name === 'cost-report.md')?.type,
        reconciliation: artifacts.find((artifact) => artifact.name === 'reconciliation-report.md')?.type,
      };
    });
    assert(result.json === 'json', 'cost-report.json missing');
    assert(result.md === 'markdown', 'cost-report.md missing');
    assert(result.reconciliation === 'markdown', 'reconciliation-report.md missing');
    return result;
  });

  await expectStep(rows, 'cost dashboard renders', async () => {
    await page.goto(`${baseUrl}/cost`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Cost Dashboard' }).waitFor({ timeout: 10000 });
    await page.getByText('Provider Cost').first().waitFor({ timeout: 10000 });
    await page.getByText('Top cost runs').first().waitFor({ timeout: 10000 });
    return { route: '/cost' };
  });

  await expectStep(rows, 'run console renders reconciliation', async () => {
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.getByText('Cost Reconciliation').first().waitFor({ timeout: 10000 });
    await page.getByText('Est / Actual / Provider').first().waitFor({ timeout: 10000 });
    return { route: '/runs/demo-run' };
  });

  await expectStep(rows, 'reconciliation survives reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const { getReconciliationReport } = await import('/src/runtime/cost-reconciliation-store.ts');
      const report = getReconciliationReport();
      return { records: report.records.length, providerCost: report.providerCost, severity: report.severity };
    });
    assert(result.records >= 1, 'report did not persist');
    assert(result.providerCost > 0, 'persisted provider cost missing');
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

  console.log('| Cost reconciliation | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nCost reconciliation smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
