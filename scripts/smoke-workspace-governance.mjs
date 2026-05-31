import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/workspace-governance-smoke.json');

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
    resetRuntimeState();
    resetWorkflowState();
    resetUsageLedgerStore();
    clearRunPlans();
    clearPolicyReports();
    clearAnalytics();
    clearCostReconciliation();
    clearWorkspaceGovernance();
    window.sessionStorage.removeItem('uikigai-demo-ui-state');
  });

  await page.evaluate(async () => {
    const { createPlanForTicket, startRunFromPlan, completeStreamingRun } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
    const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
    await startRunFromPlan(plan.id);
    await completeStreamingRun('run-demo-module-3');
  });

  await expectStep(rows, 'workspace governance generated', async () => {
    const result = await page.evaluate(async () => {
      const { generateWorkspaceGovernance } = await import('/src/runtime/workspace-governance-store.ts');
      return generateWorkspaceGovernance();
    });
    assert(result.workspace.id, 'workspace missing');
    assert(result.teams.length >= 3, 'teams missing');
    assert(result.members.length >= 5, 'members missing');
    return { workspace: result.workspace.name, teams: result.teams.length, members: result.members.length, health: result.health.overallStatus };
  });

  await expectStep(rows, 'role and team mapping', async () => {
    const result = await page.evaluate(async () => {
      const { getWorkspaceMembers, getWorkspaceRoles, getWorkspaceTeams } = await import('/src/runtime/workspace-governance-store.ts');
      const members = getWorkspaceMembers();
      const roles = getWorkspaceRoles();
      const teamIds = new Set(getWorkspaceTeams().map((team) => team.id));
      return {
        roles,
        validTeams: members.every((member) => teamIds.has(member.teamId)),
        validRoles: members.every((member) => roles.includes(member.roleId)),
      };
    });
    assert(result.roles.includes('ADMIN') && result.roles.includes('VIEWER'), 'role set incomplete');
    assert(result.validTeams, 'member team assignment invalid');
    assert(result.validRoles, 'member role assignment invalid');
    return { roles: result.roles.join(','), validTeams: result.validTeams };
  });

  await expectStep(rows, 'budget governance thresholds', async () => {
    const result = await page.evaluate(async () => {
      const { setWorkspaceGovernanceLimits } = await import('/src/runtime/workspace-governance-store.ts');
      const summary = setWorkspaceGovernanceLimits({ budgetLimit: 0.001 });
      return summary.health;
    });
    assert(result.budgetStatus === 'CRITICAL', `expected critical budget, got ${result.budgetStatus}`);
    assert(result.overallStatus === 'CRITICAL' || result.overallStatus === 'BLOCKED', `unexpected overall ${result.overallStatus}`);
    return result;
  });

  await expectStep(rows, 'quota governance thresholds', async () => {
    const result = await page.evaluate(async () => {
      const { setWorkspaceGovernanceLimits } = await import('/src/runtime/workspace-governance-store.ts');
      const summary = setWorkspaceGovernanceLimits({ maxRuns: 0 });
      return summary.health;
    });
    assert(result.quotaStatus === 'BLOCKED', `expected blocked quota, got ${result.quotaStatus}`);
    assert(result.overallStatus === 'BLOCKED', `expected blocked overall, got ${result.overallStatus}`);
    return result;
  });

  await expectStep(rows, 'governance selectors expose dashboard model', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      const vm = selectors.selectWorkspaceGovernanceViewModel();
      return {
        kpis: vm.kpis.length,
        warnings: vm.warnings.length,
        usageRuns: vm.usage.runs,
        health: vm.health.overallStatus,
        budget: selectors.selectWorkspaceBudget().monthlyLimit,
      };
    });
    assert(result.kpis >= 4, 'governance kpis missing');
    assert(result.warnings >= 1, 'governance warnings missing');
    assert(result.health === 'BLOCKED', `selector health mismatch ${result.health}`);
    return result;
  });

  await expectStep(rows, 'governance artifact export', async () => {
    const result = await page.evaluate(async () => {
      const { exportWorkspaceGovernanceArtifacts } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getRunArtifacts } = await import('/src/runtime-store/artifact-store.ts');
      exportWorkspaceGovernanceArtifacts('run-demo-module-3');
      const artifacts = getRunArtifacts('run-demo-module-3');
      return {
        json: artifacts.find((artifact) => artifact.name === 'workspace-governance.json')?.type,
        summary: artifacts.find((artifact) => artifact.name === 'workspace-summary.md')?.type,
        health: artifacts.find((artifact) => artifact.name === 'workspace-health-report.md')?.type,
      };
    });
    assert(result.json === 'json', 'workspace-governance.json missing');
    assert(result.summary === 'markdown', 'workspace-summary.md missing');
    assert(result.health === 'markdown', 'workspace-health-report.md missing');
    return result;
  });

  await expectStep(rows, 'workspace dashboard renders', async () => {
    await page.goto(`${baseUrl}/workspace`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Workspace Governance' }).waitFor({ timeout: 10000 });
    await page.getByText('Budget Governance').first().waitFor({ timeout: 10000 });
    await page.getByText('Quota Governance').first().waitFor({ timeout: 10000 });
    return { route: '/workspace' };
  });

  await expectStep(rows, 'governance survives reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const { getWorkspaceHealth, getWorkspaceWarnings } = await import('/src/runtime/workspace-governance-store.ts');
      return { health: getWorkspaceHealth().overallStatus, warnings: getWorkspaceWarnings().length };
    });
    assert(result.health === 'BLOCKED', 'governance health did not persist');
    assert(result.warnings >= 1, 'governance warnings did not persist');
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

  console.log('| Workspace governance | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nWorkspace governance smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
