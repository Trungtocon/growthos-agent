import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/approval-execution-smoke.json');

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

async function createHold(page, targetId) {
  return page.evaluate(async (id) => {
    const { evaluateBudgetOverrideGovernance } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const { getPendingApprovalExecutions } = await import('/src/runtime/approval-execution-store.ts');
    evaluateBudgetOverrideGovernance(id);
    return getPendingApprovalExecutions()[0];
  }, targetId);
}

const serverProcess = await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
const rows = [];

try {
  await page.goto(`${baseUrl}/approvals`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { clearGovernanceDecisionStore } = await import('/src/runtime/governance-decision-store.ts');
    const { clearGovernanceEnforcementStore } = await import('/src/runtime/governance-enforcement-store.ts');
    const { clearApprovalExecutionStore } = await import('/src/runtime/approval-execution-store.ts');
    const { clearAuthorizationAudit } = await import('/src/runtime/authorization-audit-store.ts');
    const { clearRbac, setCurrentRole } = await import('/src/runtime/rbac-store.ts');
    clearGovernanceDecisionStore();
    clearGovernanceEnforcementStore();
    clearApprovalExecutionStore();
    clearAuthorizationAudit();
    clearRbac();
    setCurrentRole('OrganizationAdmin');
  });

  await expectStep(rows, 'approval hold creates approval request', async () => {
    const request = await createHold(page, 'budget-approval-exec-create');
    assert(request?.status === 'PENDING_REVIEW', `expected pending request, got ${request?.status}`);
    return { requestId: request.id, requestStatus: request.status };
  });

  await expectStep(rows, 'approve resumes execution', async () => {
    const result = await page.evaluate(async () => {
      const { getPendingApprovalExecutions, approveExecutionRequest, resumeApprovedExecution, getApprovalExecutionSummary } = await import('/src/runtime/approval-execution-store.ts');
      const request = getPendingApprovalExecutions()[0];
      approveExecutionRequest(request.id);
      const resumed = resumeApprovedExecution(request.id);
      return { requestStatus: resumed.status, summary: getApprovalExecutionSummary() };
    });
    assert(result.requestStatus === 'RESUMED', `expected RESUMED, got ${result.requestStatus}`);
    assert(result.summary.resumed > 0, 'resumed execution summary was not updated');
    return { requestStatus: result.requestStatus, resumed: result.summary.resumed };
  });

  await expectStep(rows, 'reject cancels execution', async () => {
    const request = await createHold(page, 'budget-approval-exec-reject');
    const result = await page.evaluate(async (requestId) => {
      const { rejectExecutionRequest, cancelRejectedExecution, getApprovalExecutionSummary } = await import('/src/runtime/approval-execution-store.ts');
      rejectExecutionRequest(requestId);
      const cancelled = cancelRejectedExecution(requestId);
      return { requestStatus: cancelled.status, summary: getApprovalExecutionSummary() };
    }, request.id);
    assert(result.requestStatus === 'CANCELLED', `expected CANCELLED, got ${result.requestStatus}`);
    assert(result.summary.cancelled > 0, 'cancelled execution summary was not updated');
    return { requestStatus: result.requestStatus, cancelled: result.summary.cancelled };
  });

  await expectStep(rows, 'request changes keeps hold', async () => {
    const request = await createHold(page, 'budget-approval-exec-changes');
    const result = await page.evaluate(async (requestId) => {
      const { requestExecutionChanges, getPendingApprovalExecutions } = await import('/src/runtime/approval-execution-store.ts');
      const changed = requestExecutionChanges(requestId);
      return { requestStatus: changed.status, pending: getPendingApprovalExecutions().length };
    }, request.id);
    assert(result.requestStatus === 'PENDING_REVIEW', `expected hold to remain pending, got ${result.requestStatus}`);
    assert(result.pending > 0, 'pending queue was emptied by request changes');
    return result;
  });

  await expectStep(rows, 'escalate creates high-risk review event', async () => {
    const request = await createHold(page, 'budget-approval-exec-escalate');
    const result = await page.evaluate(async (requestId) => {
      const { escalateExecutionRequest, getEscalatedApprovals, getApprovalExecutionEvents } = await import('/src/runtime/approval-execution-store.ts');
      const escalated = escalateExecutionRequest(requestId);
      return { priority: escalated.priority, escalated: getEscalatedApprovals().length, latestAction: getApprovalExecutionEvents()[0]?.action };
    }, request.id);
    assert(result.priority === 'high', `expected high priority, got ${result.priority}`);
    assert(result.escalated > 0, 'escalated approvals were not indexed');
    assert(result.latestAction === 'approval.escalate', `expected escalation event, got ${result.latestAction}`);
    return result;
  });

  await expectStep(rows, 'direct resume without approval is blocked', async () => {
    const request = await createHold(page, 'budget-approval-exec-direct-resume');
    const result = await page.evaluate(async (requestId) => {
      const { resumeApprovedExecution } = await import('/src/runtime/approval-execution-store.ts');
      let blocked = false;
      try { resumeApprovedExecution(requestId); } catch { blocked = true; }
      return { blocked };
    }, request.id);
    assert(result.blocked, 'direct resume was not blocked');
    return result;
  });

  await expectStep(rows, 'rejected execution cannot run', async () => {
    const request = await createHold(page, 'budget-approval-exec-block-runtime');
    const result = await page.evaluate(async (requestId) => {
      const { rejectExecutionRequest, cancelRejectedExecution, assertApprovalExecutionAllowsRuntime } = await import('/src/runtime/approval-execution-store.ts');
      const rejected = rejectExecutionRequest(requestId);
      cancelRejectedExecution(requestId);
      let blocked = false;
      try { assertApprovalExecutionAllowsRuntime(rejected.targetId); } catch { blocked = true; }
      return { blocked, targetId: rejected.targetId };
    }, request.id);
    assert(result.blocked, 'rejected execution target was allowed to run');
    return result;
  });

  await expectStep(rows, 'artifacts are generated', async () => {
    const result = await page.evaluate(async () => {
      const { exportApprovalExecutionArtifacts } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const artifacts = exportApprovalExecutionArtifacts('run-demo-module-3');
      return { names: artifacts.map((artifact) => artifact.name) };
    });
    for (const name of ['approval-execution-report.md', 'approval-decisions.json', 'approval-timeline.md', 'rejected-executions.json', 'resumed-executions.json']) {
      assert(result.names.includes(name), `missing artifact ${name}`);
    }
    return { artifacts: result.names.join(',') };
  });

  await expectStep(rows, 'selectors return expected summaries', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      return {
        requests: selectors.selectApprovalExecutionRequests().length,
        pending: selectors.selectPendingApprovalExecutions().length,
        approved: selectors.selectApprovedExecutions().length,
        rejected: selectors.selectRejectedApprovalExecutions().length,
        events: selectors.selectApprovalExecutionTimeline().length,
        escalated: selectors.selectEscalatedApprovals().length,
        vmPending: selectors.selectApprovalExecutionViewModel().summary.pending,
      };
    });
    assert(result.requests >= 6, 'approval execution request selector missing requests');
    assert(result.events >= 8, 'approval execution timeline selector missing events');
    assert(result.escalated > 0, 'escalated selector missing rows');
    return result;
  });

  await expectStep(rows, 'routes render approval execution widgets', async () => {
    const routes = ['/approvals', '/enforcement', '/governance', '/runs/demo-run', '/tickets/demo-ticket', '/access'];
    for (const route of routes) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      await page.locator('[data-parity-id="app-shell.main"]').waitFor({ state: 'visible', timeout: 5000 });
    }
    await page.goto(`${baseUrl}/approvals`, { waitUntil: 'networkidle' });
    await page.getByText(/Approval execution|Execution hold/i).first().waitFor({ timeout: 10000 });
    return { routes: routes.join(',') };
  });
} finally {
  await browser.close();
  await stopServer(serverProcess);
}

const passed = rows.filter((row) => row.status === 'passed').length;
const failed = rows.filter((row) => row.status === 'failed').length;
writeJson(reportPath, { passed, failed, rows, generatedAt: new Date().toISOString() });

console.log('| Approval execution smoke | Status | Details |');
console.log('|---|---|---|');
for (const row of rows) {
  const details = row.status === 'passed'
    ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`).join(', ')
    : row.error;
  console.log(`| ${row.name} | ${row.status} | ${details ?? ''} |`);
}
console.log(`\nApproval execution smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);

if (failed > 0) process.exit(1);
