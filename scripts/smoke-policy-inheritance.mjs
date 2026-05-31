import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/policy-inheritance-smoke.json');

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
  await page.goto(`${baseUrl}/policies`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { clearPolicyInheritance } = await import('/src/runtime/policy-inheritance-store.ts');
    clearPolicyInheritance();
  });

  await expectStep(rows, 'organization policy loads', async () => {
    const result = await page.evaluate(async () => {
      const { getPolicyInheritanceTree } = await import('/src/runtime/policy-inheritance-store.ts');
      const tree = getPolicyInheritanceTree();
      return { organization: tree.organization.length, first: tree.organization[0]?.id };
    });
    assert(result.organization >= 8, 'expected default organization policies');
    return result;
  });

  await expectStep(rows, 'tenant override works', async () => {
    const result = await page.evaluate(async () => {
      const { getEffectivePolicies } = await import('/src/runtime/policy-inheritance-store.ts');
      const policy = getEffectivePolicies().find((item) => item.category === 'budget' && item.key === 'maxCost');
      return { scope: policy?.scope, value: policy?.value, tenant: policy?.sourceTrace.tenantPolicyId };
    });
    assert(result.tenant, 'expected tenant policy trace for budget');
    assert(result.scope === 'WORKSPACE', 'workspace override should be effective above tenant');
    return result;
  });

  await expectStep(rows, 'workspace override works', async () => {
    const result = await page.evaluate(async () => {
      const { getEffectivePolicies } = await import('/src/runtime/policy-inheritance-store.ts');
      const policy = getEffectivePolicies().find((item) => item.category === 'execution' && item.key === 'maxConcurrentRuns');
      return { scope: policy?.scope, value: policy?.value, workspace: policy?.sourceTrace.workspacePolicyId };
    });
    assert(result.scope === 'WORKSPACE', 'expected workspace execution override');
    assert(result.workspace, 'expected workspace trace');
    return result;
  });

  await expectStep(rows, 'runtime override works only when allowed', async () => {
    const result = await page.evaluate(async () => {
      const { getEffectivePolicies, getPolicyConflicts } = await import('/src/runtime/policy-inheritance-store.ts');
      const quota = getEffectivePolicies().find((item) => item.category === 'quota' && item.key === 'maxToolCalls');
      const budgetConflict = getPolicyConflicts().find((item) => item.childPolicyId === 'runtime-budget-max-cost-conflict');
      return { quotaScope: quota?.scope, quotaValue: quota?.value, budgetConflict: budgetConflict?.reason };
    });
    assert(result.quotaScope === 'RUNTIME', 'runtime quota override should be effective');
    assert(result.budgetConflict, 'runtime budget override should be blocked by workspace runtimeOverride=false');
    return result;
  });

  await expectStep(rows, 'locked parent policy blocks child override', async () => {
    const result = await page.evaluate(async () => {
      const { getPolicyConflicts, getEffectivePolicies } = await import('/src/runtime/policy-inheritance-store.ts');
      const conflict = getPolicyConflicts().find((item) => item.childPolicyId === 'tenant-approval-artifact-conflict');
      const effective = getEffectivePolicies().find((item) => item.category === 'approval' && item.key === 'artifactRequiresApproval');
      return { conflict: conflict?.reason, effectiveValue: effective?.value, locked: effective?.locked };
    });
    assert(result.conflict, 'expected locked organization approval policy conflict');
    assert(result.effectiveValue === true && result.locked === true, 'locked organization approval policy should remain effective');
    return result;
  });

  await expectStep(rows, 'selectors return expected results', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      const vm = selectors.selectPolicyInheritanceViewModel();
      return {
        effective: selectors.selectEffectivePolicies().length,
        conflicts: selectors.selectPolicyConflicts().length,
        locked: selectors.selectLockedPolicies().length,
        overrides: selectors.selectPolicyOverrides().length,
        trace: selectors.selectPolicyTraceForRuntime().length,
        kpis: vm.kpis.length,
        ticketPolicy: selectors.selectTicketDetailViewModel().authorization.policyInheritance.summary.effectivePolicies,
        runPolicy: selectors.selectRunConsoleViewModel().authorization.policyInheritance.summary.effectivePolicies,
        approvalPolicy: selectors.selectApprovalCenterViewModel().authorization.policyInheritance.summary.effectivePolicies,
      };
    });
    assert(result.effective >= 8, 'effective policy selector missing policies');
    assert(result.conflicts >= 2, 'policy conflict selector missing conflicts');
    assert(result.locked >= 3, 'locked policies selector missing locked policies');
    assert(result.overrides >= 1, 'policy overrides selector missing rows');
    assert(result.trace >= 1, 'runtime trace selector missing rows');
    assert(result.kpis === 4, 'policy inheritance KPIs mismatch');
    assert(result.ticketPolicy && result.runPolicy && result.approvalPolicy, 'core route policy summaries missing');
    return result;
  });

  await expectStep(rows, 'policy artifacts generated', async () => {
    const result = await page.evaluate(async () => {
      const { exportPolicyInheritanceArtifacts } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getRunArtifacts } = await import('/src/runtime-store/artifact-store.ts');
      exportPolicyInheritanceArtifacts('run-demo-module-3');
      const artifacts = getRunArtifacts('run-demo-module-3');
      return {
        summary: artifacts.find((artifact) => artifact.name === 'policy-inheritance-summary.md')?.type,
        effective: artifacts.find((artifact) => artifact.name === 'effective-policy-report.md')?.type,
        conflicts: artifacts.find((artifact) => artifact.name === 'policy-conflicts.json')?.type,
        trace: artifacts.find((artifact) => artifact.name === 'policy-trace-report.md')?.type,
      };
    });
    assert(result.summary === 'markdown', 'policy-inheritance-summary.md missing');
    assert(result.effective === 'markdown', 'effective-policy-report.md missing');
    assert(result.conflicts === 'json', 'policy-conflicts.json missing');
    assert(result.trace === 'markdown', 'policy-trace-report.md missing');
    return result;
  });

  await expectStep(rows, 'route renders policy dashboard', async () => {
    await page.goto(`${baseUrl}/policies`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Policy Inheritance', exact: true }).waitFor({ timeout: 10000 });
    await page.getByText('Policy Inheritance Tree').first().waitFor({ timeout: 10000 });
    await page.getByText('Effective Policies').first().waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.getByText(/policy/i).first().waitFor({ timeout: 10000 });
    return { route: '/policies,/runs/demo-run' };
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

  console.log('| Policy inheritance smoke | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nPolicy inheritance smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
