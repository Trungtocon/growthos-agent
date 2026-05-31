import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/organization-governance-smoke.json');

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
    const { clearWorkspaceGovernance } = await import('/src/runtime/workspace-governance-store.ts');
    const { clearOrganizationGovernance } = await import('/src/runtime/organization-store.ts');
    resetRuntimeState();
    resetWorkflowState();
    resetUsageLedgerStore();
    clearRunPlans();
    clearPolicyReports();
    clearAnalytics();
    clearCostReconciliation();
    clearWorkspaceGovernance();
    clearOrganizationGovernance();
    window.sessionStorage.removeItem('uikigai-demo-ui-state');
  });

  await page.evaluate(async () => {
    const { createPlanForTicket, startRunFromPlan, completeStreamingRun } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
    await startRunFromPlan(plan.id);
    await completeStreamingRun('run-demo-module-3');
  });

  await expectStep(rows, 'organization creation', async () => {
    const result = await page.evaluate(async () => {
      const { generateOrganizationGovernance } = await import('/src/runtime/organization-store.ts');
      return generateOrganizationGovernance();
    });
    assert(result.organization.name === 'GrowthOS Enterprise', 'organization name mismatch');
    assert(result.tenants.length === 3, 'expected three tenants');
    return { organization: result.organization.name, tenants: result.tenants.length, health: result.organizationHealth.overallStatus };
  });

  await expectStep(rows, 'tenant hierarchy', async () => {
    const result = await page.evaluate(async () => {
      const { getTenants } = await import('/src/runtime/organization-store.ts');
      return getTenants().map((tenant) => ({ id: tenant.id, name: tenant.name, workspaces: tenant.workspaceIds.length }));
    });
    assert(result.some((tenant) => tenant.name === 'Marketing'), 'marketing tenant missing');
    assert(result.some((tenant) => tenant.name === 'Operations'), 'operations tenant missing');
    assert(result.some((tenant) => tenant.name === 'Sales'), 'sales tenant missing');
    assert(result.every((tenant) => tenant.workspaces >= 1), 'tenant workspace ownership missing');
    return { tenants: result.map((tenant) => `${tenant.name}:${tenant.workspaces}`).join(',') };
  });

  await expectStep(rows, 'workspace references', async () => {
    const result = await page.evaluate(async () => {
      const { getWorkspaceReferences, getTenants } = await import('/src/runtime/organization-store.ts');
      const tenants = getTenants();
      const references = getWorkspaceReferences();
      return {
        references,
        valid: references.every((reference) => tenants.some((tenant) => tenant.id === reference.tenantId && tenant.organizationId === reference.organizationId)),
      };
    });
    assert(result.references.length >= 3, 'workspace references missing');
    assert(result.valid, 'invalid workspace reference mapping');
    return { references: result.references.length };
  });

  await expectStep(rows, 'budget aggregation and threshold', async () => {
    const result = await page.evaluate(async () => {
      const { setTenantGovernanceLimits, getOrganizationGovernanceSummary } = await import('/src/runtime/organization-store.ts');
      setTenantGovernanceLimits('tenant-sales', { monthlyLimit: 100, currentSpend: 140 });
      const summary = getOrganizationGovernanceSummary();
      const salesHealth = summary.tenantHealth.find((health) => health.tenantId === 'tenant-sales');
      return {
        orgBudget: summary.organizationHealth.budgetHealth,
        orgOverall: summary.organizationHealth.overallStatus,
        salesBudget: salesHealth?.budgetStatus,
      };
    });
    assert(result.salesBudget === 'CRITICAL', 'sales budget should be critical');
    assert(result.orgBudget === 'CRITICAL', 'organization budget health should aggregate critical');
    return result;
  });

  await expectStep(rows, 'quota aggregation and threshold', async () => {
    const result = await page.evaluate(async () => {
      const { setTenantGovernanceLimits, getOrganizationGovernanceSummary } = await import('/src/runtime/organization-store.ts');
      setTenantGovernanceLimits('tenant-marketing', { maxRuns: 10, currentRuns: 12 });
      const summary = getOrganizationGovernanceSummary();
      const marketingHealth = summary.tenantHealth.find((health) => health.tenantId === 'tenant-marketing');
      return {
        orgQuota: summary.organizationHealth.quotaHealth,
        orgOverall: summary.organizationHealth.overallStatus,
        marketingQuota: marketingHealth?.quotaStatus,
      };
    });
    assert(result.marketingQuota === 'CRITICAL', 'marketing quota should be critical');
    assert(result.orgQuota === 'CRITICAL', 'organization quota health should aggregate critical');
    return result;
  });

  await expectStep(rows, 'selectors expose organization summary', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      const vm = selectors.selectOrganizationGovernanceViewModel();
      return {
        tenants: selectors.selectTenantCount(),
        workspaces: selectors.selectWorkspaceCount(),
        kpis: vm.kpis.length,
        warnings: vm.warnings.length,
        health: selectors.selectOrganizationHealth()?.overallStatus,
        workspaceTenant: selectors.selectWorkspaceGovernanceViewModel().tenant?.name,
      };
    });
    assert(result.tenants === 3, 'tenant count selector mismatch');
    assert(result.workspaces >= 3, 'workspace count selector mismatch');
    assert(result.kpis >= 4, 'organization dashboard kpis missing');
    assert(result.warnings >= 1, 'organization warnings missing');
    assert(result.health === 'CRITICAL', 'organization health selector mismatch');
    assert(result.workspaceTenant, 'workspace tenant selector missing');
    return result;
  });

  await expectStep(rows, 'artifact generation', async () => {
    const result = await page.evaluate(async () => {
      const { exportOrganizationGovernanceArtifacts } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getRunArtifacts } = await import('/src/runtime-store/artifact-store.ts');
      exportOrganizationGovernanceArtifacts('run-demo-module-3');
      const artifacts = getRunArtifacts('run-demo-module-3');
      return {
        json: artifacts.find((artifact) => artifact.name === 'organization-governance.json')?.type,
        summary: artifacts.find((artifact) => artifact.name === 'organization-summary.md')?.type,
        health: artifacts.find((artifact) => artifact.name === 'tenant-health-report.md')?.type,
      };
    });
    assert(result.json === 'json', 'organization-governance.json missing');
    assert(result.summary === 'markdown', 'organization-summary.md missing');
    assert(result.health === 'markdown', 'tenant-health-report.md missing');
    return result;
  });

  await expectStep(rows, 'dashboard rendering', async () => {
    await page.goto(`${baseUrl}/organization`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Organization Governance' }).waitFor({ timeout: 10000 });
    await page.getByText('Tenant Registry').first().waitFor({ timeout: 10000 });
    await page.getByText('GrowthOS Enterprise').first().waitFor({ timeout: 10000 });
    return { route: '/organization' };
  });

  await expectStep(rows, 'workspace route shows parent hierarchy', async () => {
    await page.goto(`${baseUrl}/workspace`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Workspace Governance' }).waitFor({ timeout: 10000 });
    await page.getByText('GrowthOS Enterprise').first().waitFor({ timeout: 10000 });
    await page.getByText('Tenant').first().waitFor({ timeout: 10000 });
    return { route: '/workspace' };
  });

  await expectStep(rows, 'organization persists after reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const { getOrganizationGovernanceSummary } = await import('/src/runtime/organization-store.ts');
      const summary = getOrganizationGovernanceSummary();
      return { health: summary.organizationHealth.overallStatus, tenants: summary.tenants.length, warnings: summary.organizationHealth.warnings.length };
    });
    assert(result.health === 'CRITICAL', 'organization health did not persist');
    assert(result.tenants === 3, 'tenant hierarchy did not persist');
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

  console.log('| Organization governance | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nOrganization governance smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
