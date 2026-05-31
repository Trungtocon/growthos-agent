import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/rbac-smoke.json');

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
  await page.goto(`${baseUrl}/access`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { resetRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
    const { resetWorkflowState } = await import('/src/state/workflow-engine.ts');
    const { clearRunPlans } = await import('/src/runtime-store/run-plan-store.ts');
    const { clearPolicyReports } = await import('/src/runtime-store/plan-policy-store.ts');
    const { clearRbac } = await import('/src/runtime/rbac-store.ts');
    resetRuntimeState();
    resetWorkflowState();
    clearRunPlans();
    clearPolicyReports();
    clearRbac();
  });

  await expectStep(rows, 'role loading', async () => {
    const result = await page.evaluate(async () => {
      const { getRoles, getCurrentRole } = await import('/src/runtime/rbac-store.ts');
      return { roles: getRoles().length, currentRole: getCurrentRole().id };
    });
    assert(result.roles >= 7, 'expected default roles');
    assert(result.currentRole === 'WorkspaceAdmin', 'default current user role mismatch');
    return result;
  });

  await expectStep(rows, 'permission resolution', async () => {
    const result = await page.evaluate(async () => {
      const { getEffectivePermissions, getPermissionMatrix } = await import('/src/runtime/rbac-store.ts');
      return { permissions: getEffectivePermissions().map((permission) => permission.id), matrix: getPermissionMatrix().length };
    });
    assert(result.permissions.includes('run.start'), 'WorkspaceAdmin should be able to start runs');
    assert(result.permissions.includes('artifact.export'), 'WorkspaceAdmin should export artifacts');
    assert(result.matrix >= 7, 'permission matrix missing roles');
    return { permissions: result.permissions.length, matrix: result.matrix };
  });

  await expectStep(rows, 'authorization decisions', async () => {
    const result = await page.evaluate(async () => {
      const { canStartRun, canOverrideBudget, setCurrentRole } = await import('/src/runtime/rbac-store.ts');
      const allowed = canStartRun('plan-demo').allowed;
      setCurrentRole('Viewer');
      const denied = canStartRun('plan-demo');
      const budgetDenied = canOverrideBudget('workspace-demo');
      setCurrentRole('WorkspaceAdmin');
      return {
        allowed,
        denied: denied.allowed,
        missing: denied.missingPermissions,
        budgetDenied: budgetDenied.allowed,
      };
    });
    assert(result.allowed, 'WorkspaceAdmin start run should be allowed');
    assert(result.denied === false, 'Viewer start run should be denied');
    assert(result.missing.includes('run.start'), 'run.start missing permission not reported');
    assert(result.budgetDenied === false, 'Viewer budget override should be denied');
    return result;
  });

  await expectStep(rows, 'runtime enforcement', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket, startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { setCurrentRole, getDeniedActions } = await import('/src/runtime/rbac-store.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
      setCurrentRole('Viewer');
      let blocked = false;
      try {
        await startRunFromPlan(plan.id);
      } catch {
        blocked = true;
      }
      const denied = getDeniedActions();
      setCurrentRole('WorkspaceAdmin');
      return { blocked, denied: denied.length, planId: plan.id };
    });
    assert(result.blocked, 'Viewer should not start run from plan');
    assert(result.denied >= 1, 'denied action should be recorded');
    return result;
  });

  await expectStep(rows, 'artifact export', async () => {
    const result = await page.evaluate(async () => {
      const { exportRbacArtifacts } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getRunArtifacts } = await import('/src/runtime-store/artifact-store.ts');
      exportRbacArtifacts('run-demo-module-3');
      const artifacts = getRunArtifacts('run-demo-module-3');
      return {
        summary: artifacts.find((artifact) => artifact.name === 'rbac-summary.md')?.type,
        matrix: artifacts.find((artifact) => artifact.name === 'permission-matrix.md')?.type,
        report: artifacts.find((artifact) => artifact.name === 'access-report.json')?.type,
        history: artifacts.find((artifact) => artifact.name === 'authorization-history.json')?.type,
      };
    });
    assert(result.summary === 'markdown', 'rbac-summary.md missing');
    assert(result.matrix === 'markdown', 'permission-matrix.md missing');
    assert(result.report === 'json', 'access-report.json missing');
    assert(result.history === 'json', 'authorization-history.json missing');
    return result;
  });

  await expectStep(rows, 'selectors expose RBAC', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      const vm = selectors.selectAccessControlViewModel();
      return {
        role: selectors.selectCurrentRole().id,
        permissions: selectors.selectEffectivePermissions().length,
        denied: selectors.selectDeniedActions().length,
        kpis: vm.kpis.length,
        ticketRole: selectors.selectTicketDetailViewModel().authorization.currentRole.id,
        runRole: selectors.selectRunConsoleViewModel().authorization.currentRole.id,
        approvalRole: selectors.selectApprovalCenterViewModel().authorization.currentRole.id,
      };
    });
    assert(result.role === 'WorkspaceAdmin', 'current role selector mismatch');
    assert(result.permissions > 0, 'effective permissions missing');
    assert(result.denied >= 1, 'denied actions selector missing');
    assert(result.kpis >= 4, 'access control kpis missing');
    assert(result.ticketRole && result.runRole && result.approvalRole, 'core route authorization state missing');
    return result;
  });

  await expectStep(rows, 'route rendering', async () => {
    await page.goto(`${baseUrl}/access`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Access Control' }).waitFor({ timeout: 10000 });
    await page.getByText('Role Matrix').first().waitFor({ timeout: 10000 });
    await page.getByText('Permission Matrix').first().waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.getByText('RBAC role').first().waitFor({ timeout: 10000 });
    return { route: '/access,/runs/demo-run' };
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

  console.log('| RBAC smoke | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nRBAC smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
