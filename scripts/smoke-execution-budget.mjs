import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/execution-budget-smoke.json');

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
    rows.push({ name, status: 'passed', ...details });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

const serverProcess = await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
const rows = [];

try {
  await page.goto(`${baseUrl}/tickets/demo-ticket`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { clearRunPlans } = await import('/src/runtime-store/run-plan-store.ts');
    const { clearPolicyReports } = await import('/src/runtime-store/plan-policy-store.ts');
    const { clearExecutionBudgetRegistry } = await import('/src/runtime-store/execution-budget-store.ts');
    clearRunPlans();
    clearPolicyReports();
    clearExecutionBudgetRegistry();
  });

  await expectStep(rows, 'cost estimation', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { estimateRunPlanBudget } = await import('/src/integrations/growthos-runtime/execution-budget.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
      const estimate = estimateRunPlanBudget(plan);
      return { planId: plan.id, cost: estimate.estimatedCost, tools: estimate.toolCosts.length };
    });
    assert(result.cost > 0, 'estimated cost missing');
    assert(result.tools >= 3, 'tool cost profiles missing');
    return result;
  });

  await expectStep(rows, 'duration estimation', async () => {
    const result = await page.evaluate(async () => {
      const { getRunPlan } = await import('/src/runtime-store/run-plan-store.ts');
      const { estimateRunPlanBudget } = await import('/src/integrations/growthos-runtime/execution-budget.ts');
      const plan = getRunPlan('run-plan-ticket-audit-module-3-demo-run-execution');
      const estimate = estimateRunPlanBudget(plan);
      return { duration: estimate.estimatedDuration, tokens: estimate.estimatedTokens };
    });
    assert(result.duration > 0, 'estimated duration missing');
    assert(result.tokens > 0, 'estimated tokens missing');
    return result;
  });

  await expectStep(rows, 'risk estimation', async () => {
    const result = await page.evaluate(async () => {
      const { getRunPlan } = await import('/src/runtime-store/run-plan-store.ts');
      const { estimateRunPlanBudget } = await import('/src/integrations/growthos-runtime/execution-budget.ts');
      const plan = getRunPlan('run-plan-ticket-audit-module-3-demo-run-execution');
      const estimate = estimateRunPlanBudget(plan);
      return { risk: estimate.riskLevel };
    });
    assert(['low', 'medium', 'high', 'critical'].includes(result.risk), `unexpected risk ${result.risk}`);
    return result;
  });

  await expectStep(rows, 'budget policy', async () => {
    const result = await page.evaluate(async () => {
      const { evaluateBudget } = await import('/src/integrations/growthos-runtime/execution-budget.ts');
      const report = evaluateBudget('run-plan-ticket-audit-module-3-demo-run-execution');
      return { budgetStatus: report.status, approvalRequired: report.approvalRequired, cost: report.estimate.estimatedCost };
    });
    assert(['allowed', 'warning'].includes(result.budgetStatus), `unexpected budget status ${result.budgetStatus}`);
    assert(result.cost > 0, 'budget cost missing');
    return result;
  });

  await expectStep(rows, 'approval escalation', async () => {
    const result = await page.evaluate(async () => {
      const { evaluateBudget } = await import('/src/integrations/growthos-runtime/execution-budget.ts');
      const { startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getPendingApprovals } = await import('/src/runtime-store/approval-store.ts');
      const report = evaluateBudget('run-plan-ticket-audit-module-3-demo-run-execution');
      await startRunFromPlan('run-plan-ticket-audit-module-3-demo-run-execution');
      const approvals = getPendingApprovals().filter((approval) => approval.id.startsWith('approval-policy-'));
      return { approvalRequired: report.approvalRequired, approvals: approvals.length };
    });
    assert(result.approvalRequired, 'budget approval escalation not required for demo estimate');
    assert(result.approvals > 0, 'approval gate missing after start');
    return result;
  });

  await expectStep(rows, 'blocked expensive plan', async () => {
    const result = await page.evaluate(async () => {
      const { cloneExecutionBudgetRegistry, setExecutionBudgetRegistry } = await import('/src/runtime-store/execution-budget-store.ts');
      const { evaluateBudget } = await import('/src/integrations/growthos-runtime/execution-budget.ts');
      const { evaluatePlanPolicy } = await import('/src/integrations/growthos-runtime/plan-policy.ts');
      const registry = cloneExecutionBudgetRegistry();
      setExecutionBudgetRegistry({
        ...registry,
        budget: { ...registry.budget, maxCost: 0.001, warningCost: 0.001, approvalCost: 0.001 },
      });
      const budgetReport = evaluateBudget('run-plan-ticket-audit-module-3-demo-run-execution');
      const policyReport = evaluatePlanPolicy('run-plan-ticket-audit-module-3-demo-run-execution');
      return { budgetStatus: budgetReport.status, policyStatus: policyReport.status, blocking: policyReport.blockingReasons.join('|') };
    });
    assert(result.budgetStatus === 'blocked', `budget should be blocked, got ${result.budgetStatus}`);
    assert(result.policyStatus === 'blocked', `policy should be blocked, got ${result.policyStatus}`);
    assert(result.blocking.includes('Estimated cost'), `missing cost block reason: ${result.blocking}`);
    return result;
  });

  await expectStep(rows, 'persistence', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const { getBudgetReport } = await import('/src/runtime-store/execution-budget-store.ts');
      const report = getBudgetReport('run-plan-ticket-audit-module-3-demo-run-execution');
      return { budgetStatus: report?.status, cost: report?.estimate.estimatedCost };
    });
    assert(result.budgetStatus === 'blocked', `budget report did not persist: ${result.budgetStatus}`);
    assert(result.cost > 0, 'persisted budget estimate missing');
    return result;
  });

  await expectStep(rows, 'selectors', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      const estimate = selectors.selectExecutionCost('run-plan-ticket-audit-module-3-demo-run-execution');
      const budget = selectors.selectExecutionBudget();
      const ticketVm = selectors.selectTicketDetailViewModel('ticket-audit-module-3');
      return {
        cost: estimate?.estimatedCost,
        risk: selectors.selectExecutionRisk('run-plan-ticket-audit-module-3-demo-run-execution'),
        maxCost: budget.maxCost,
        vmCost: ticketVm.executionEstimate?.estimatedCost,
        budgetStatus: ticketVm.budgetPolicy?.status,
      };
    });
    assert(result.cost > 0, 'cost selector missing estimate');
    assert(result.vmCost > 0, 'ticket view model missing execution estimate');
    assert(result.budgetStatus === 'blocked', `ticket view model missing budget policy: ${result.budgetStatus}`);
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

  console.log('| Execution budget | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nExecution budget smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
