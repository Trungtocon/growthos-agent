import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/plan-policy-smoke.json');

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
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
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
    const { clearToolCalls } = await import('/src/runtime-store/tool-call-store.ts');
    const { clearStream } = await import('/src/runtime-store/stream-store.ts');
    clearRunPlans();
    clearPolicyReports();
    clearToolCalls('run-demo-module-3');
    clearStream('run-demo-module-3');
  });

  await expectStep(rows, 'ready plan passes policy', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getPolicyReport } = await import('/src/runtime-store/plan-policy-store.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
      const report = getPolicyReport(plan.id);
      return { planId: plan.id, planStatus: plan.status, policyStatus: report?.status, approvals: report?.approvalRequiredSteps.length ?? 0 };
    });
    assert(result.planStatus === 'ready', `expected ready plan, got ${result.planStatus}`);
    assert(result.policyStatus === 'allowed', `expected allowed policy, got ${result.policyStatus}`);
    assert(result.approvals > 0, 'artifact approval-required step missing');
    return result;
  });

  await expectStep(rows, 'deployment-readiness plan is blocked', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getPolicyReport } = await import('/src/runtime-store/plan-policy-store.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'deployment-readiness');
      const report = getPolicyReport(plan.id);
      return { planId: plan.id, planStatus: plan.status, policyStatus: report?.status, blocking: report?.blockingReasons.join('|') };
    });
    assert(result.planStatus === 'blocked', `expected blocked plan, got ${result.planStatus}`);
    assert(result.policyStatus === 'blocked', `expected blocked policy, got ${result.policyStatus}`);
    assert(result.blocking.includes('deployment') || result.blocking.includes('Missing'), `expected deployment block reason, got ${result.blocking}`);
    return result;
  });

  await expectStep(rows, 'approval-required artifact step creates approval gate', async () => {
    const result = await page.evaluate(async () => {
      const { startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getPendingApprovals } = await import('/src/runtime-store/approval-store.ts');
      const { getRunById } = await import('/src/runtime-store/run-store.ts');
      const started = await startRunFromPlan('run-plan-ticket-audit-module-3-demo-run-execution');
      const approvals = getPendingApprovals().filter((approval) => approval.id.startsWith('approval-policy-'));
      const run = getRunById(started.runId);
      return {
        runId: started.runId,
        lifecycle: run?.lifecycle,
        approvals: approvals.length,
        planId: approvals[0]?.planId,
        stepId: approvals[0]?.stepId,
      };
    });
    assert(result.approvals > 0, 'policy approval was not created');
    assert(result.planId === 'run-plan-ticket-audit-module-3-demo-run-execution', `unexpected policy plan id ${result.planId}`);
    assert(result.stepId, 'policy approval missing step id');
    assert(result.lifecycle === 'WAITING_APPROVAL', `expected WAITING_APPROVAL, got ${result.lifecycle}`);
    return result;
  });

  await expectStep(rows, 'blocked plan cannot start', async () => {
    const result = await page.evaluate(async () => {
      const { startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      try {
        await startRunFromPlan('run-plan-ticket-audit-module-3-deployment-readiness');
        return { blocked: false, error: '' };
      } catch (error) {
        return { blocked: true, error: error instanceof Error ? error.message : String(error) };
      }
    });
    assert(result.blocked, 'blocked plan started unexpectedly');
    assert(result.error.includes('blocked'), `unexpected error: ${result.error}`);
    return result;
  });

  await expectStep(rows, 'warning plan records warning', async () => {
    const result = await page.evaluate(async () => {
      const { getRunPlan, upsertRunPlan } = await import('/src/runtime-store/run-plan-store.ts');
      const { evaluatePlanPolicy } = await import('/src/integrations/growthos-runtime/plan-policy.ts');
      const { upsertPolicyReport } = await import('/src/runtime-store/plan-policy-store.ts');
      const source = getRunPlan('run-plan-ticket-audit-module-3-demo-run-execution');
      if (!source) return { status: 'missing-source', warnings: '' };
      const warningPlan = {
        ...source,
        id: 'run-plan-ticket-audit-module-3-warning-unknown-tool',
        workflowId: 'warning-unknown-tool',
        steps: source.steps.map((step, index) => index === 0 ? { ...step, toolId: 'unknown-runtime-tool', modelId: step.modelId ?? 'hermes-runtime-model', status: 'planned' } : step),
      };
      upsertRunPlan(warningPlan);
      const report = upsertPolicyReport(evaluatePlanPolicy(warningPlan.id));
      return { policyStatus: report.status, warnings: report.warnings.join('|'), blocking: report.blockingReasons.join('|') };
    });
    assert(result.policyStatus === 'warning', `expected warning policy, got ${result.policyStatus}; blocking=${result.blocking}`);
    assert(result.warnings.includes('unknown') || result.warnings.includes('review'), `missing unknown tool warning: ${result.warnings}`);
    return result;
  });

  await expectStep(rows, 'policy report persists after reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const { getPolicyReport } = await import('/src/runtime-store/plan-policy-store.ts');
      const report = getPolicyReport('run-plan-ticket-audit-module-3-deployment-readiness');
      return { policyStatus: report?.status, blocking: report?.blockingReasons.length ?? 0 };
    });
    assert(result.policyStatus === 'blocked', `persisted policy missing, got ${result.policyStatus}`);
    assert(result.blocking > 0, 'persisted blocking reasons missing');
    return result;
  });

  await expectStep(rows, 'selectors expose blocking reasons', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      return {
        canStart: selectors.selectCanStartPlan('run-plan-ticket-audit-module-3-deployment-readiness'),
        blocking: selectors.selectBlockingReasons('run-plan-ticket-audit-module-3-deployment-readiness').length,
        warnings: selectors.selectPlanWarnings('run-plan-ticket-audit-module-3-warning-unknown-tool').length,
      };
    });
    assert(result.canStart === false, 'blocked plan selector says start is allowed');
    assert(result.blocking > 0, 'blocking reason selector empty');
    assert(result.warnings > 0, 'warning selector empty');
    return result;
  });

  await expectStep(rows, 'startRunFromPlan respects policy in UI', async () => {
    await page.goto(`${baseUrl}/tickets/demo-ticket`, { waitUntil: 'networkidle' });
    await page.getByText('Policy').first().waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.getByText('Plan Status').first().waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/approvals`, { waitUntil: 'networkidle' });
    await page.getByText('Plan policy approval').first().waitFor({ timeout: 10000 });
    return { routes: '/tickets/demo-ticket,/runs/demo-run,/approvals' };
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

  console.log('| Plan policy | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nPlan policy smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
