import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/governance-decision-smoke.json');

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
  await page.goto(`${baseUrl}/governance`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { clearRunPlans } = await import('/src/runtime-store/run-plan-store.ts');
    const { clearPolicyReports } = await import('/src/runtime-store/plan-policy-store.ts');
    const { clearExecutionBudgetRegistry } = await import('/src/runtime-store/execution-budget-store.ts');
    const { resetUsageLedgerStore } = await import('/src/runtime-store/usage-ledger-store.ts');
    const { clearRbac, setCurrentRole } = await import('/src/runtime/rbac-store.ts');
    const { clearGovernanceDecisionStore } = await import('/src/runtime/governance-decision-store.ts');
    clearRunPlans();
    clearPolicyReports();
    clearExecutionBudgetRegistry();
    resetUsageLedgerStore();
    clearRbac();
    clearGovernanceDecisionStore();
    setCurrentRole('WorkspaceAdmin');
  });

  await expectStep(rows, 'allow path', async () => {
    const result = await page.evaluate(async () => {
      const { evaluateArtifactExport } = await import('/src/runtime/governance-decision-engine.ts');
      const { recordGovernanceDecision } = await import('/src/runtime/governance-decision-store.ts');
      const report = recordGovernanceDecision(evaluateArtifactExport('run-demo-module-3'));
      return { decision: report.finalDecision, gates: report.gates.length };
    });
    assert(result.decision === 'ALLOW', `expected ALLOW, got ${result.decision}`);
    assert(result.gates === 6, 'expected six governance gates');
    return result;
  });

  await expectStep(rows, 'deny path', async () => {
    const result = await page.evaluate(async () => {
      const { evaluateGovernanceDecision } = await import('/src/runtime/governance-decision-engine.ts');
      const { recordGovernanceDecision } = await import('/src/runtime/governance-decision-store.ts');
      const report = recordGovernanceDecision(evaluateGovernanceDecision({
        targetId: 'manual-deny-demo',
        targetType: 'runtime',
        action: 'manualDeny',
        deniedReason: 'Operator denied execution during governance review.',
      }));
      return { decision: report.finalDecision, reasons: report.decisionReasons.length };
    });
    assert(result.decision === 'DENY', `expected DENY, got ${result.decision}`);
    assert(result.reasons > 0, 'deny decision reason missing');
    return result;
  });

  await expectStep(rows, 'approval path', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { evaluatePlanExecution } = await import('/src/runtime/governance-decision-engine.ts');
      const { recordGovernanceDecision } = await import('/src/runtime/governance-decision-store.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
      const report = recordGovernanceDecision(evaluatePlanExecution(plan.id));
      return { decision: report.finalDecision, warnings: report.warnings.length };
    });
    assert(result.decision === 'REQUIRE_APPROVAL', `expected REQUIRE_APPROVAL, got ${result.decision}`);
    assert(result.warnings > 0, 'approval warnings missing');
    return result;
  });

  await expectStep(rows, 'policy violation', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { evaluatePlanExecution } = await import('/src/runtime/governance-decision-engine.ts');
      const { recordGovernanceDecision } = await import('/src/runtime/governance-decision-store.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'deployment-readiness');
      const report = recordGovernanceDecision(evaluatePlanExecution(plan.id));
      return { decision: report.finalDecision, failed: report.failedGates.join(',') };
    });
    assert(result.decision === 'BLOCKED_BY_POLICY', `expected BLOCKED_BY_POLICY, got ${result.decision}`);
    assert(result.failed.includes('Policy Gate'), `policy gate not failed: ${result.failed}`);
    return result;
  });

  await expectStep(rows, 'budget violation', async () => {
    const result = await page.evaluate(async () => {
      const { cloneExecutionBudgetRegistry, setExecutionBudgetRegistry } = await import('/src/runtime-store/execution-budget-store.ts');
      const { createPlanForTicket } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { evaluatePlanExecution } = await import('/src/runtime/governance-decision-engine.ts');
      const { recordGovernanceDecision } = await import('/src/runtime/governance-decision-store.ts');
      const registry = cloneExecutionBudgetRegistry();
      setExecutionBudgetRegistry({ ...registry, budget: { ...registry.budget, maxCost: 0.001, warningCost: 0.001, approvalCost: 0.001 } });
      const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
      const report = recordGovernanceDecision(evaluatePlanExecution(plan.id));
      return { decision: report.finalDecision, failed: report.failedGates.join(',') };
    });
    assert(result.decision === 'BLOCKED_BY_BUDGET', `expected BLOCKED_BY_BUDGET, got ${result.decision}`);
    assert(result.failed.includes('Budget Gate'), `budget gate not failed: ${result.failed}`);
    return result;
  });

  await expectStep(rows, 'quota violation', async () => {
    const result = await page.evaluate(async () => {
      const { clearExecutionBudgetRegistry } = await import('/src/runtime-store/execution-budget-store.ts');
      const { setUsageQuotas } = await import('/src/runtime-store/usage-ledger-store.ts');
      const { createPlanForTicket } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { evaluatePlanExecution } = await import('/src/runtime/governance-decision-engine.ts');
      const { recordGovernanceDecision } = await import('/src/runtime/governance-decision-store.ts');
      clearExecutionBudgetRegistry();
      setUsageQuotas([{ id: 'quota-block-tool-calls', scope: 'run', limitType: 'tool_calls', limit: 1, used: 0, remaining: 1, status: 'ok' }]);
      const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
      const report = recordGovernanceDecision(evaluatePlanExecution(plan.id));
      return { decision: report.finalDecision, failed: report.failedGates.join(',') };
    });
    assert(result.decision === 'BLOCKED_BY_QUOTA', `expected BLOCKED_BY_QUOTA, got ${result.decision}`);
    assert(result.failed.includes('Quota Gate'), `quota gate not failed: ${result.failed}`);
    return result;
  });

  await expectStep(rows, 'rbac violation', async () => {
    const result = await page.evaluate(async () => {
      const { clearExecutionBudgetRegistry } = await import('/src/runtime-store/execution-budget-store.ts');
      const { resetUsageLedgerStore } = await import('/src/runtime-store/usage-ledger-store.ts');
      const { setCurrentRole } = await import('/src/runtime/rbac-store.ts');
      const { createPlanForTicket } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { evaluatePlanExecution } = await import('/src/runtime/governance-decision-engine.ts');
      const { recordGovernanceDecision } = await import('/src/runtime/governance-decision-store.ts');
      clearExecutionBudgetRegistry();
      resetUsageLedgerStore();
      setCurrentRole('Viewer');
      const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
      const report = recordGovernanceDecision(evaluatePlanExecution(plan.id));
      setCurrentRole('WorkspaceAdmin');
      return { decision: report.finalDecision, failed: report.failedGates.join(',') };
    });
    assert(result.decision === 'BLOCKED_BY_RBAC', `expected BLOCKED_BY_RBAC, got ${result.decision}`);
    assert(result.failed.includes('RBAC Gate'), `rbac gate not failed: ${result.failed}`);
    return result;
  });

  await expectStep(rows, 'decision reports and selectors', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      const vm = selectors.selectGovernanceDecisionViewModel();
      return {
        history: selectors.selectGovernanceDecisionHistory().length,
        blocked: selectors.selectBlockedExecutions().length,
        warnings: selectors.selectGovernanceWarnings().length,
        summaryTotal: selectors.selectGovernanceSummary().total,
        latest: vm.summary.latestDecision,
        kpis: vm.kpis.length,
        accessSummary: selectors.selectAccessControlViewModel().governanceDecision.summary.total,
      };
    });
    assert(result.history >= 7, `history missing decisions: ${result.history}`);
    assert(result.blocked >= 3, `blocked decisions missing: ${result.blocked}`);
    assert(result.summaryTotal === result.history, 'summary/history mismatch');
    assert(result.kpis === 4, 'governance KPI count mismatch');
    assert(result.accessSummary === result.history, 'access compact governance summary missing');
    return result;
  });

  await expectStep(rows, 'artifact exports', async () => {
    const result = await page.evaluate(async () => {
      const { exportGovernanceDecisionArtifacts } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getRunArtifacts } = await import('/src/runtime-store/artifact-store.ts');
      exportGovernanceDecisionArtifacts('run-demo-module-3');
      const artifacts = getRunArtifacts('run-demo-module-3');
      return {
        decision: artifacts.find((artifact) => artifact.name === 'governance-decision-report.md')?.type,
        violations: artifacts.find((artifact) => artifact.name === 'governance-violations.json')?.type,
        blocked: artifacts.find((artifact) => artifact.name === 'blocked-executions.json')?.type,
        approval: artifacts.find((artifact) => artifact.name === 'approval-required-report.md')?.type,
      };
    });
    assert(result.decision === 'markdown', 'governance-decision-report.md missing');
    assert(result.violations === 'json', 'governance-violations.json missing');
    assert(result.blocked === 'json', 'blocked-executions.json missing');
    assert(result.approval === 'markdown', 'approval-required-report.md missing');
    return result;
  });

  await expectStep(rows, 'route renders governance dashboard', async () => {
    await page.goto(`${baseUrl}/governance`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Governance Decision Engine', exact: true }).waitFor({ timeout: 10000 });
    await page.getByText('Decision History').first().waitFor({ timeout: 10000 });
    await page.getByText('Gate Results').first().waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.getByText(/governance/i).first().waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/tickets/demo-ticket`, { waitUntil: 'networkidle' });
    await page.getByText(/governance/i).first().waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/access`, { waitUntil: 'networkidle' });
    await page.getByText('Governance Status').first().waitFor({ timeout: 10000 });
    return { routes: '/governance,/runs/demo-run,/tickets/demo-ticket,/access' };
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

  console.log('| Governance decision smoke | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nGovernance decision smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
