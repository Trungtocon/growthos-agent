import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/enterprise-governance-exit-smoke.json');

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
    rows.push({ name, ...details, status: 'passed' });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

const serverProcess = await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
const rows = [];

try {
  await page.goto(`${baseUrl}/governance-readiness`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { clearRunPlans } = await import('/src/runtime-store/run-plan-store.ts');
    const { clearPolicyReports } = await import('/src/runtime-store/plan-policy-store.ts');
    const { clearExecutionBudgetRegistry } = await import('/src/runtime-store/execution-budget-store.ts');
    const { resetUsageLedgerStore } = await import('/src/runtime-store/usage-ledger-store.ts');
    const { clearCostReconciliation } = await import('/src/runtime/cost-reconciliation-store.ts');
    const { clearRbac, setCurrentRole } = await import('/src/runtime/rbac-store.ts');
    const { clearAuthorizationAudit } = await import('/src/runtime/authorization-audit-store.ts');
    const { clearGovernanceDecisionStore } = await import('/src/runtime/governance-decision-store.ts');
    const { clearGovernanceEnforcementStore } = await import('/src/runtime/governance-enforcement-store.ts');
    const { clearApprovalExecutionStore } = await import('/src/runtime/approval-execution-store.ts');
    const { clearWorkspaceGovernance } = await import('/src/runtime/workspace-governance-store.ts');
    const { clearOrganizationGovernance } = await import('/src/runtime/organization-store.ts');
    const { clearGovernanceReadinessStore } = await import('/src/runtime/governance-readiness-store.ts');
    clearRunPlans();
    clearPolicyReports();
    clearExecutionBudgetRegistry();
    resetUsageLedgerStore();
    clearCostReconciliation();
    clearRbac();
    clearAuthorizationAudit();
    clearGovernanceDecisionStore();
    clearGovernanceEnforcementStore();
    clearApprovalExecutionStore();
    clearWorkspaceGovernance();
    clearOrganizationGovernance();
    clearGovernanceReadinessStore();
    setCurrentRole('WorkspaceAdmin');
  });

  await expectStep(rows, 'normal execution allowed', async () => {
    const result = await page.evaluate(async () => {
      const { startStreamingRun, nextStreamTick, completeStreamingRun } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { selectGovernanceEnforcementSummary } = await import('/src/domain/selectors.ts');
      const run = await startStreamingRun('ticket-audit-module-3');
      await nextStreamTick(run.runId);
      await nextStreamTick(run.runId);
      await completeStreamingRun(run.runId);
      const summary = selectGovernanceEnforcementSummary();
      return { runId: run.runId, executed: summary.executed, latestAction: summary.latestAction };
    });
    assert(result.executed > 0, 'allowed execution was not recorded by enforcement');
    return result;
  });

  await expectStep(rows, 'rbac denied rejected', async () => {
    const result = await page.evaluate(async () => {
      const { setCurrentRole } = await import('/src/runtime/rbac-store.ts');
      const { createPlanForTicket, startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { selectRejectedExecutions } = await import('/src/domain/selectors.ts');
      setCurrentRole('Viewer');
      const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
      let blocked = false;
      try { await startRunFromPlan(plan.id); } catch { blocked = true; }
      setCurrentRole('WorkspaceAdmin');
      return { blocked, rejected: selectRejectedExecutions().length };
    });
    assert(result.blocked, 'RBAC denial did not block runtime execution');
    assert(result.rejected > 0, 'RBAC denial did not record rejection');
    return result;
  });

  await expectStep(rows, 'policy blocked rejected', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket, startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { selectRejectedExecutions } = await import('/src/domain/selectors.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'deployment-readiness');
      let blocked = false;
      try { await startRunFromPlan(plan.id); } catch { blocked = true; }
      return { blocked, rejected: selectRejectedExecutions().length };
    });
    assert(result.blocked, 'policy blocked plan did not reject execution');
    return result;
  });

  await expectStep(rows, 'budget blocked rejected', async () => {
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
    assert(result.blocked, 'budget block did not reject execution');
    return result;
  });

  await expectStep(rows, 'quota blocked rejected', async () => {
    const result = await page.evaluate(async () => {
      const { clearExecutionBudgetRegistry } = await import('/src/runtime-store/execution-budget-store.ts');
      const { resetUsageLedgerStore, setUsageQuotas } = await import('/src/runtime-store/usage-ledger-store.ts');
      const { createPlanForTicket, startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { selectRejectedExecutions } = await import('/src/domain/selectors.ts');
      clearExecutionBudgetRegistry();
      resetUsageLedgerStore();
      setUsageQuotas([{ id: 'exit-quota-tool-calls', scope: 'run', limitType: 'tool_calls', limit: 1, used: 0, remaining: 1, status: 'ok' }]);
      const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
      let blocked = false;
      try { await startRunFromPlan(plan.id); } catch { blocked = true; }
      return { blocked, rejected: selectRejectedExecutions().length };
    });
    assert(result.blocked, 'quota block did not reject execution');
    return result;
  });

  await expectStep(rows, 'approval required held', async () => {
    const result = await page.evaluate(async () => {
      const { clearExecutionBudgetRegistry } = await import('/src/runtime-store/execution-budget-store.ts');
      const { resetUsageLedgerStore } = await import('/src/runtime-store/usage-ledger-store.ts');
      const { createPlanForTicket, startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getPendingApprovalExecutions } = await import('/src/runtime/approval-execution-store.ts');
      clearExecutionBudgetRegistry();
      resetUsageLedgerStore();
      const plan = createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
      await startRunFromPlan(plan.id);
      const request = getPendingApprovalExecutions()[0];
      return { planId: plan.id, requestId: request?.id, requestStatus: request?.status };
    });
    assert(result.requestStatus === 'PENDING_REVIEW', `expected PENDING_REVIEW, got ${result.requestStatus}`);
    return result;
  });

  await expectStep(rows, 'approval approved resumed', async () => {
    const result = await page.evaluate(async () => {
      const { getPendingApprovalExecutions, approveExecutionRequest, resumeApprovedExecution, getApprovalExecutionSummary } = await import('/src/runtime/approval-execution-store.ts');
      const request = getPendingApprovalExecutions()[0];
      approveExecutionRequest(request.id);
      const resumed = resumeApprovedExecution(request.id);
      return { requestStatus: resumed.status, summary: getApprovalExecutionSummary() };
    });
    assert(result.requestStatus === 'RESUMED', `expected RESUMED, got ${result.requestStatus}`);
    assert(result.summary.resumed > 0, 'approval resume was not summarized');
    return { requestStatus: result.requestStatus, resumed: result.summary.resumed };
  });

  await expectStep(rows, 'approval rejected cancelled', async () => {
    const result = await page.evaluate(async () => {
      const { setCurrentRole } = await import('/src/runtime/rbac-store.ts');
      const { evaluateBudgetOverrideGovernance } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getPendingApprovalExecutions, rejectExecutionRequest, cancelRejectedExecution, getApprovalExecutionSummary } = await import('/src/runtime/approval-execution-store.ts');
      setCurrentRole('OrganizationAdmin');
      evaluateBudgetOverrideGovernance('exit-reject-budget-override');
      const request = getPendingApprovalExecutions().find((item) => item.targetId === 'exit-reject-budget-override') ?? getPendingApprovalExecutions()[0];
      rejectExecutionRequest(request.id);
      const cancelled = cancelRejectedExecution(request.id);
      setCurrentRole('WorkspaceAdmin');
      return { requestStatus: cancelled.status, summary: getApprovalExecutionSummary() };
    });
    assert(result.requestStatus === 'CANCELLED', `expected CANCELLED, got ${result.requestStatus}`);
    assert(result.summary.cancelled > 0, 'approval cancellation was not summarized');
    return { requestStatus: result.requestStatus, cancelled: result.summary.cancelled };
  });

  await expectStep(rows, 'authorization audit recorded', async () => {
    const result = await page.evaluate(async () => {
      const { selectAuthorizationAuditEvents } = await import('/src/domain/selectors.ts');
      const events = selectAuthorizationAuditEvents();
      return { events: events.length, total: events.length };
    });
    assert(result.events > 0 && result.total > 0, 'authorization audit did not record events');
    return result;
  });

  await expectStep(rows, 'enforcement event recorded', async () => {
    const result = await page.evaluate(async () => {
      const { selectEnforcementEvents, selectGovernanceEnforcementSummary } = await import('/src/domain/selectors.ts');
      return { events: selectEnforcementEvents().length, total: selectGovernanceEnforcementSummary().total };
    });
    assert(result.events > 0 && result.total > 0, 'governance enforcement did not record events');
    return result;
  });

  await expectStep(rows, 'usage ledger recorded', async () => {
    const result = await page.evaluate(async () => {
      const { getAllUsageRecords, getBillingLedgers } = await import('/src/runtime-store/usage-ledger-store.ts');
      return { records: getAllUsageRecords().length, ledgers: getBillingLedgers().length };
    });
    assert(result.records > 0 && result.ledgers > 0, 'usage ledger missing records');
    return result;
  });

  await expectStep(rows, 'cost reconciliation updated', async () => {
    const result = await page.evaluate(async () => {
      const { generateCostReconciliationReport } = await import('/src/runtime/cost-reconciliation-store.ts');
      const report = generateCostReconciliationReport();
      return { records: report.records.length, providerCost: report.providerCost, variance: report.variance };
    });
    assert(result.records > 0, 'cost reconciliation has no records');
    return result;
  });

  await expectStep(rows, 'workspace governance summary updated', async () => {
    const result = await page.evaluate(async () => {
      const { generateWorkspaceGovernance } = await import('/src/runtime/workspace-governance-store.ts');
      const summary = generateWorkspaceGovernance();
      return { workspace: summary.workspace.id, members: summary.members.length, healthStatus: summary.health.overallStatus };
    });
    assert(Boolean(result.workspace), 'workspace governance summary missing workspace');
    return result;
  });

  await expectStep(rows, 'organization governance summary updated', async () => {
    const result = await page.evaluate(async () => {
      const { generateOrganizationGovernance } = await import('/src/runtime/organization-store.ts');
      const summary = generateOrganizationGovernance();
      return { organization: summary.organization.id, tenants: summary.tenants.length, healthStatus: summary.organizationHealth.overallStatus };
    });
    assert(Boolean(result.organization) && result.tenants > 0, 'organization governance summary missing organization or tenants');
    return result;
  });

  await expectStep(rows, 'artifact export generated', async () => {
    const result = await page.evaluate(async () => {
      const { runGovernanceExitGate, generateGovernanceReadinessArtifacts } = await import('/src/runtime/governance-readiness-store.ts');
      const gate = runGovernanceExitGate('run-demo-module-3');
      const artifacts = generateGovernanceReadinessArtifacts('run-demo-module-3');
      return { gateStatus: gate.report.status, names: artifacts.map((artifact) => artifact.name), blockers: gate.report.blockedReasons.length, warnings: gate.report.warnings.length };
    });
    for (const name of ['enterprise-governance-exit-report.md', 'governance-readiness.json', 'governance-blockers.json', 'governance-next-actions.md']) {
      assert(result.names.includes(name), `missing readiness artifact ${name}`);
    }
    assert(result.gateStatus !== 'BLOCKED', `governance exit gate blocked: ${result.blockers}`);
    return result;
  });

  await expectStep(rows, 'governance readiness route renders', async () => {
    await page.goto(`${baseUrl}/governance-readiness`, { waitUntil: 'networkidle' });
    await page.locator('[data-parity-id="app-shell.main"]').waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('heading', { name: /Enterprise Governance Exit Gate/i }).waitFor({ timeout: 5000 });
    const text = await page.locator('[data-parity-id="app-shell.main"]').innerText();
    assert(text.includes('Module Checklist'), 'readiness checklist was not rendered');
    return { route: '/governance-readiness' };
  });
} finally {
  await browser.close();
  await stopServer(serverProcess);
}

const passed = rows.filter((row) => row.status === 'passed').length;
const failed = rows.filter((row) => row.status === 'failed').length;
writeJson(reportPath, { passed, failed, rows, generatedAt: new Date().toISOString() });

console.log('| Enterprise governance exit smoke | Status | Details |');
console.log('|---|---|---|');
for (const row of rows) {
  const details = row.status === 'passed'
    ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('; ')
    : row.error;
  console.log(`| ${row.name} | ${row.status} | ${details ?? ''} |`);
}

if (failed > 0) {
  console.error(`Enterprise governance exit smoke failed: ${failed}/${rows.length}`);
  process.exit(1);
}

console.log(`Enterprise governance exit smoke passed: ${passed}/${rows.length}`);
