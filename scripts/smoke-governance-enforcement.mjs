import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/governance-enforcement-smoke.json');

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
  await page.goto(`${baseUrl}/enforcement`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { clearRunPlans } = await import('/src/runtime-store/run-plan-store.ts');
    const { clearPolicyReports } = await import('/src/runtime-store/plan-policy-store.ts');
    const { clearExecutionBudgetRegistry } = await import('/src/runtime-store/execution-budget-store.ts');
    const { resetUsageLedgerStore } = await import('/src/runtime-store/usage-ledger-store.ts');
    const { clearRbac, setCurrentRole } = await import('/src/runtime/rbac-store.ts');
    const { clearGovernanceDecisionStore } = await import('/src/runtime/governance-decision-store.ts');
    const { clearGovernanceEnforcementStore } = await import('/src/runtime/governance-enforcement-store.ts');
    clearRunPlans();
    clearPolicyReports();
    clearExecutionBudgetRegistry();
    resetUsageLedgerStore();
    clearRbac();
    clearGovernanceDecisionStore();
    clearGovernanceEnforcementStore();
    setCurrentRole('WorkspaceAdmin');
  });

  await expectStep(rows, 'allow execution', async () => {
    const result = await page.evaluate(async () => {
      const { startStreamingRun } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { selectGovernanceEnforcementSummary } = await import('/src/domain/selectors.ts');
      const run = await startStreamingRun('ticket-audit-module-3');
      const summary = selectGovernanceEnforcementSummary();
      return { runId: run.runId, latestAction: summary.latestAction, executed: summary.executed };
    });
    assert(result.latestAction === 'EXECUTE', `expected EXECUTE, got ${result.latestAction}`);
    assert(result.executed > 0, 'execute event was not recorded');
    return result;
  });

  await expectStep(rows, 'approval hold', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket, startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { selectApprovalQueue, selectGovernanceEnforcementSummary } = await import('/src/domain/selectors.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
      await startRunFromPlan(plan.id);
      const holds = selectApprovalQueue();
      const summary = selectGovernanceEnforcementSummary();
      return { holds: holds.length, latestAction: summary.latestAction, planId: plan.id };
    });
    assert(result.holds > 0, 'approval hold not recorded');
    assert(result.latestAction === 'REQUIRE_APPROVAL' || result.latestAction === 'EXECUTE', `unexpected latest action ${result.latestAction}`);
    return result;
  });

  await expectStep(rows, 'policy block', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket, startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { selectRejectedExecutions } = await import('/src/domain/selectors.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'deployment-readiness');
      let blocked = false;
      try { await startRunFromPlan(plan.id); } catch { blocked = true; }
      return { blocked, rejected: selectRejectedExecutions().length };
    });
    assert(result.blocked, 'policy-blocked run was not rejected');
    assert(result.rejected > 0, 'policy rejection not recorded');
    return result;
  });

  await expectStep(rows, 'budget block', async () => {
    const result = await page.evaluate(async () => {
      const { cloneExecutionBudgetRegistry, setExecutionBudgetRegistry } = await import('/src/runtime-store/execution-budget-store.ts');
      const { createPlanForTicket, startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { selectRejectedExecutions } = await import('/src/domain/selectors.ts');
      const registry = cloneExecutionBudgetRegistry();
      setExecutionBudgetRegistry({ ...registry, budget: { ...registry.budget, maxCost: 0.001, warningCost: 0.001, approvalCost: 0.001 } });
      const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
      let blocked = false;
      try { await startRunFromPlan(plan.id); } catch { blocked = true; }
      return { blocked, rejected: selectRejectedExecutions().length };
    });
    assert(result.blocked, 'budget-blocked run was not rejected');
    assert(result.rejected > 0, 'budget rejection not recorded');
    return result;
  });

  await expectStep(rows, 'quota block', async () => {
    const result = await page.evaluate(async () => {
      const { clearExecutionBudgetRegistry } = await import('/src/runtime-store/execution-budget-store.ts');
      const { setUsageQuotas } = await import('/src/runtime-store/usage-ledger-store.ts');
      const { createPlanForTicket, startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { selectRejectedExecutions } = await import('/src/domain/selectors.ts');
      clearExecutionBudgetRegistry();
      setUsageQuotas([{ id: 'quota-block-tool-calls', scope: 'run', limitType: 'tool_calls', limit: 1, used: 0, remaining: 1, status: 'ok' }]);
      const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
      let blocked = false;
      try { await startRunFromPlan(plan.id); } catch { blocked = true; }
      return { blocked, rejected: selectRejectedExecutions().length };
    });
    assert(result.blocked, 'quota-blocked run was not rejected');
    assert(result.rejected > 0, 'quota rejection not recorded');
    return result;
  });

  await expectStep(rows, 'rbac block', async () => {
    const result = await page.evaluate(async () => {
      const { clearExecutionBudgetRegistry } = await import('/src/runtime-store/execution-budget-store.ts');
      const { resetUsageLedgerStore } = await import('/src/runtime-store/usage-ledger-store.ts');
      const { setCurrentRole } = await import('/src/runtime/rbac-store.ts');
      const { createPlanForTicket, startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { selectRejectedExecutions } = await import('/src/domain/selectors.ts');
      clearExecutionBudgetRegistry();
      resetUsageLedgerStore();
      setCurrentRole('Viewer');
      const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
      let blocked = false;
      try { await startRunFromPlan(plan.id); } catch { blocked = true; }
      setCurrentRole('WorkspaceAdmin');
      return { blocked, rejected: selectRejectedExecutions().length };
    });
    assert(result.blocked, 'rbac-blocked run was not rejected');
    assert(result.rejected > 0, 'rbac rejection not recorded');
    return result;
  });

  await expectStep(rows, 'runtime termination', async () => {
    const result = await page.evaluate(async () => {
      const { terminateRunByGovernance } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { selectTerminatedRuns } = await import('/src/domain/selectors.ts');
      const enforcement = terminateRunByGovernance('run-demo-module-3', 'Smoke test termination.');
      return { action: enforcement.enforcementAction, terminated: selectTerminatedRuns().length };
    });
    assert(result.action === 'TERMINATE', `expected TERMINATE, got ${result.action}`);
    assert(result.terminated > 0, 'termination was not recorded');
    return result;
  });

  await expectStep(rows, 'artifact export', async () => {
    const result = await page.evaluate(async () => {
      const { exportGovernanceEnforcementArtifacts } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const artifacts = exportGovernanceEnforcementArtifacts('run-demo-module-3');
      return { names: artifacts.map((artifact) => artifact.name) };
    });
    for (const name of ['enforcement-report.md', 'blocked-runs.json', 'approval-holds.json', 'terminated-runs.json']) {
      assert(result.names.includes(name), `missing artifact ${name}`);
    }
    return { artifacts: result.names.join(',') };
  });

  await expectStep(rows, 'route renders enforcement dashboard', async () => {
    const routes = ['/enforcement', '/governance', '/runs/demo-run', '/tickets/demo-ticket', '/policies', '/access'];
    for (const route of routes) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      await page.locator('[data-parity-id="app-shell.main"]').waitFor({ state: 'visible', timeout: 5000 });
    }
    await page.goto(`${baseUrl}/enforcement`, { waitUntil: 'networkidle' });
    const title = await page.locator('h1').first().textContent();
    assert(title?.includes('Governance Enforcement'), `unexpected title ${title}`);
    return { routes: routes.join(',') };
  });
} finally {
  await browser.close();
  await stopServer(serverProcess);
}

const passed = rows.filter((row) => row.status === 'passed').length;
const failed = rows.filter((row) => row.status === 'failed').length;
writeJson(reportPath, { passed, failed, rows, generatedAt: new Date().toISOString() });

console.log('| Governance enforcement smoke | Status | Details |');
console.log('|---|---|---|');
for (const row of rows) {
  const details = row.status === 'passed'
    ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
    : row.error;
  console.log(`| ${row.name} | ${row.status} | ${details ?? ''} |`);
}
console.log(`\nGovernance enforcement smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);

if (failed > 0) process.exit(1);
