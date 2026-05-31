import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/authorization-audit-smoke.json');

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

  await expectStep(rows, 'authorization decisions are recorded', async () => {
    const result = await page.evaluate(async () => {
      const { canStartRun, canOverrideBudget, setCurrentRole } = await import('/src/runtime/rbac-store.ts');
      const { getAuthorizationAuditEvents } = await import('/src/runtime/authorization-audit-store.ts');
      const allowed = canStartRun('plan-demo').allowed;
      setCurrentRole('Viewer');
      const denied = canOverrideBudget('budget-demo');
      setCurrentRole('WorkspaceAdmin');
      return {
        allowed,
        denied: denied.allowed,
        events: getAuthorizationAuditEvents().length,
      };
    });
    assert(result.allowed, 'expected allowed start-run decision');
    assert(result.denied === false, 'expected denied budget override decision');
    assert(result.events >= 2, 'expected audit events to be recorded');
    return result;
  });

  await expectStep(rows, 'denied actions are recorded', async () => {
    const result = await page.evaluate(async () => {
      const { getAuthorizationDeniedActions } = await import('/src/runtime/authorization-audit-store.ts');
      const denied = getAuthorizationDeniedActions();
      return { denied: denied.length, first: denied[0]?.action, reason: denied[0]?.deniedReason };
    });
    assert(result.denied >= 1, 'expected at least one denied authorization event');
    assert(result.reason, 'denied event should include reason');
    return result;
  });

  await expectStep(rows, 'risk levels are calculated', async () => {
    const result = await page.evaluate(async () => {
      const { canApproveDeployment, canModifyPolicy, setCurrentRole } = await import('/src/runtime/rbac-store.ts');
      const { getAuthorizationRiskSummary, getHighRiskAuthorizationEvents } = await import('/src/runtime/authorization-audit-store.ts');
      setCurrentRole('Viewer');
      canApproveDeployment('deploy-production');
      canModifyPolicy('policy-runtime');
      setCurrentRole('WorkspaceAdmin');
      const risk = getAuthorizationRiskSummary();
      const highRisk = getHighRiskAuthorizationEvents();
      return {
        critical: risk.criticalEvents,
        high: risk.highRiskEvents,
        highRisk: highRisk.length,
        actions: highRisk.map((event) => event.action),
      };
    });
    assert(result.critical >= 1, 'deployment approval denial should be CRITICAL');
    assert(result.highRisk >= 2, 'expected high-risk authorization attempts');
    return result;
  });

  await expectStep(rows, 'repeated denied actions are detected', async () => {
    const result = await page.evaluate(async () => {
      const { canOverrideBudget, setCurrentRole } = await import('/src/runtime/rbac-store.ts');
      const { getDeniedActionSummary, getAuthorizationReviewItems } = await import('/src/runtime/authorization-audit-store.ts');
      setCurrentRole('Viewer');
      canOverrideBudget('budget-demo');
      canOverrideBudget('budget-demo');
      canOverrideBudget('budget-demo');
      setCurrentRole('WorkspaceAdmin');
      const summary = getDeniedActionSummary();
      const reviews = getAuthorizationReviewItems();
      return {
        repeated: summary.repeatedDenied,
        reviewItems: reviews.length,
        budgetCount: summary.byAction.find((item) => item.action === 'override_budget')?.count ?? 0,
      };
    });
    assert(result.repeated >= 3, 'expected repeated denied action detection');
    assert(result.reviewItems >= 1, 'expected review item creation');
    assert(result.budgetCount >= 4, 'expected budget override denials');
    return result;
  });

  await expectStep(rows, 'selectors return expected summaries', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      const vm = selectors.selectAccessControlViewModel();
      return {
        events: selectors.selectAuthorizationAuditEvents().length,
        denied: selectors.selectDeniedActionSummary().totalDenied,
        highRisk: selectors.selectHighRiskAuthorizationEvents().length,
        reviews: selectors.selectAuthorizationReviewQueue().length,
        actorRows: selectors.selectAuthorizationAuditByActor().length,
        workspaceRows: selectors.selectAuthorizationAuditByWorkspace().length,
        tenantRows: selectors.selectAuthorizationAuditByTenant().length,
        kpis: vm.kpis.length,
      };
    });
    assert(result.events >= 6, 'audit event selector missing events');
    assert(result.denied >= 5, 'denied action summary missing denials');
    assert(result.highRisk >= 2, 'high-risk selector missing events');
    assert(result.reviews >= 1, 'review queue selector missing items');
    assert(result.actorRows >= 1 && result.workspaceRows >= 1 && result.tenantRows >= 1, 'breakdown selectors missing rows');
    assert(result.kpis >= 6, 'access control KPIs missing audit metrics');
    return result;
  });

  await expectStep(rows, 'artifact exports are generated', async () => {
    const result = await page.evaluate(async () => {
      const { exportAuthorizationAuditArtifacts } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getRunArtifacts } = await import('/src/runtime-store/artifact-store.ts');
      exportAuthorizationAuditArtifacts('run-demo-module-3');
      const artifacts = getRunArtifacts('run-demo-module-3');
      return {
        summary: artifacts.find((artifact) => artifact.name === 'authorization-audit-summary.md')?.type,
        risk: artifacts.find((artifact) => artifact.name === 'authorization-risk-report.md')?.type,
        events: artifacts.find((artifact) => artifact.name === 'authorization-events.json')?.type,
        denied: artifacts.find((artifact) => artifact.name === 'denied-actions-report.md')?.type,
      };
    });
    assert(result.summary === 'markdown', 'authorization-audit-summary.md missing');
    assert(result.risk === 'markdown', 'authorization-risk-report.md missing');
    assert(result.events === 'json', 'authorization-events.json missing');
    assert(result.denied === 'markdown', 'denied-actions-report.md missing');
    return result;
  });

  await expectStep(rows, 'route renders authorization observability', async () => {
    await page.goto(`${baseUrl}/access`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Access Control' }).waitFor({ timeout: 10000 });
    await page.getByText('Authorization Events').first().waitFor({ timeout: 10000 });
    await page.getByText('High Risk Events').first().waitFor({ timeout: 10000 });
    await page.getByText('Review Queue').first().waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.getByText(/audit/i).first().waitFor({ timeout: 10000 });
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

  console.log('| Authorization audit smoke | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nAuthorization audit smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
