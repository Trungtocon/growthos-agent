import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/workspace-analytics-smoke.json');

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
    resetRuntimeState();
    resetWorkflowState();
    resetUsageLedgerStore();
    clearRunPlans();
    clearPolicyReports();
    clearAnalytics();
    window.sessionStorage.removeItem('uikigai-demo-ui-state');
  });

  await page.evaluate(async () => {
    const { createPlanForTicket, startRunFromPlan, completeStreamingRun } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
    await startRunFromPlan(plan.id);
    await completeStreamingRun('run-demo-module-3');
  });

  await expectStep(rows, 'workspace analytics generated', async () => {
    const result = await page.evaluate(async () => {
      const { generateWorkspaceAnalytics } = await import('/src/runtime-store/workspace-analytics-store.ts');
      return generateWorkspaceAnalytics().workspace;
    });
    assert(result.totalRuns >= 1, 'workspace run total missing');
    assert(result.actualCost > 0, 'workspace actual cost missing');
    return { totalRuns: result.totalRuns, actualCost: result.actualCost };
  });

  await expectStep(rows, 'tool analytics generated', async () => {
    const result = await page.evaluate(async () => {
      const { getToolAnalytics } = await import('/src/runtime-store/workspace-analytics-store.ts');
      return getToolAnalytics();
    });
    assert(result.length >= 1, 'tool analytics missing');
    assert(result[0].totalCost > 0, 'tool cost missing');
    return { tools: result.length, topTool: result[0].toolId };
  });

  await expectStep(rows, 'model analytics generated', async () => {
    const result = await page.evaluate(async () => {
      const { getModelAnalytics } = await import('/src/runtime-store/workspace-analytics-store.ts');
      return getModelAnalytics();
    });
    assert(result.length >= 1, 'model analytics missing');
    return { models: result.length, topModel: result[0].modelId };
  });

  await expectStep(rows, 'workflow analytics generated', async () => {
    const result = await page.evaluate(async () => {
      const { getWorkflowAnalytics } = await import('/src/runtime-store/workspace-analytics-store.ts');
      return getWorkflowAnalytics();
    });
    assert(result.some((workflow) => workflow.workflowId === 'demo-run-execution'), 'demo workflow analytics missing');
    return { workflows: result.length, topWorkflow: result[0].workflowId };
  });

  await expectStep(rows, 'top rankings generated', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      return {
        tools: selectors.selectTopCostTools().length,
        models: selectors.selectTopCostModels().length,
        workflows: selectors.selectTopWorkflows().length,
      };
    });
    assert(result.tools > 0, 'top tools missing');
    assert(result.models > 0, 'top models missing');
    assert(result.workflows > 0, 'top workflows missing');
    return result;
  });

  await expectStep(rows, 'cost variance calculated', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      return selectors.selectWorkspaceCostSummary();
    });
    assert(typeof result.varianceCost === 'number', 'workspace variance missing');
    assert(result.actualCost > 0, 'workspace actual cost missing');
    return result;
  });

  await expectStep(rows, 'dashboard selectors work', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      const costVm = selectors.selectCostDashboardViewModel();
      const runVm = selectors.selectRunConsoleViewModel('run-demo-module-3');
      const ticketVm = selectors.selectTicketDetailViewModel('ticket-audit-module-3');
      return {
        kpis: costVm.kpis.length,
        runAnalyticsCost: runVm.workspaceAnalytics.actualCost,
        workflowCost: ticketVm.workflowAnalytics?.totalCost,
      };
    });
    assert(result.kpis >= 6, 'cost dashboard analytics kpis missing');
    assert(result.runAnalyticsCost > 0, 'run analytics missing');
    assert(result.workflowCost > 0, 'ticket workflow analytics missing');
    return result;
  });

  await expectStep(rows, 'export JSON generated', async () => {
    const result = await page.evaluate(async () => {
      const { exportWorkspaceAnalyticsArtifacts } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getRunArtifacts } = await import('/src/runtime-store/artifact-store.ts');
      exportWorkspaceAnalyticsArtifacts('run-demo-module-3');
      return getRunArtifacts('run-demo-module-3').find((artifact) => artifact.name === 'analytics.json');
    });
    assert(result?.type === 'json', 'analytics json artifact missing');
    return { artifact: result.name };
  });

  await expectStep(rows, 'export Markdown generated', async () => {
    const result = await page.evaluate(async () => {
      const { getRunArtifacts } = await import('/src/runtime-store/artifact-store.ts');
      return getRunArtifacts('run-demo-module-3').find((artifact) => artifact.name === 'workspace-summary.md');
    });
    assert(result?.type === 'markdown', 'workspace summary artifact missing');
    assert(result.contentText?.includes('Workspace Usage Summary'), 'workspace markdown content missing');
    return { artifact: result.name };
  });

  await expectStep(rows, 'analytics survives reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const { getWorkspaceAnalytics } = await import('/src/runtime-store/workspace-analytics-store.ts');
      const analytics = getWorkspaceAnalytics();
      return { totalRuns: analytics.totalRuns, actualCost: analytics.actualCost };
    });
    assert(result.totalRuns >= 1, 'analytics did not persist');
    assert(result.actualCost > 0, 'persisted actual cost missing');
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

  console.log('| Workspace analytics | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nWorkspace analytics smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
