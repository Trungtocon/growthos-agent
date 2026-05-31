import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/run-planner-smoke.json');

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
    const { clearToolCalls } = await import('/src/runtime-store/tool-call-store.ts');
    const { clearStream } = await import('/src/runtime-store/stream-store.ts');
    clearRunPlans();
    clearToolCalls('run-demo-module-3');
    clearStream('run-demo-module-3');
  });

  await expectStep(rows, 'create ready plan for demo-run-execution', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'demo-run-execution');
      return { id: plan.id, planStatus: plan.status, steps: plan.steps.length, missing: plan.missingCapabilities.join(',') };
    });
    assert(result.planStatus === 'ready', `expected ready plan, got ${result.planStatus}: ${result.missing}`);
    assert(result.steps >= 3, 'ready plan missing ordered steps');
    return result;
  });

  await expectStep(rows, 'create ready plan for approval-gated-artifact', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'approval-gated-artifact');
      return { id: plan.id, planStatus: plan.status, approvals: plan.estimatedApprovals, missing: plan.missingCapabilities.join(',') };
    });
    assert(result.planStatus === 'ready', `approval-gated plan not ready: ${result.missing}`);
    assert(result.approvals >= 1, 'approval estimate missing');
    return result;
  });

  await expectStep(rows, 'create blocked plan for deployment-readiness', async () => {
    const result = await page.evaluate(async () => {
      const { createPlanForTicket } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const plan = createPlanForTicket('ticket-audit-module-3', 'deployment-readiness');
      return { id: plan.id, planStatus: plan.status, missing: plan.missingCapabilities.join(','), warnings: plan.warnings.join('|') };
    });
    assert(result.planStatus === 'blocked', `deployment plan should be blocked, got ${result.planStatus}`);
    assert(result.missing.includes('deployment'), 'deployment missing capability not detected');
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
    assert(result.error.includes('blocked'), `unexpected blocked error: ${result.error}`);
    return result;
  });

  await expectStep(rows, 'ready plan starts runtime run', async () => {
    const result = await page.evaluate(async () => {
      const { startRunFromPlan } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getRunById } = await import('/src/runtime-store/run-store.ts');
      const started = await startRunFromPlan('run-plan-ticket-audit-module-3-demo-run-execution');
      const run = getRunById(started.runId);
      return { runId: started.runId, runStatus: started.status, lifecycle: run?.lifecycle };
    });
    assert(result.runId === 'run-demo-module-3', `unexpected run id ${result.runId}`);
    assert(['QUEUED', 'WAITING_APPROVAL'].includes(result.lifecycle), `unexpected lifecycle ${result.lifecycle}`);
    return result;
  });

  await expectStep(rows, 'tool calls are generated from plan steps', async () => {
    const result = await page.evaluate(async () => {
      const { getToolCallsByRun } = await import('/src/runtime-store/tool-call-store.ts');
      const calls = getToolCallsByRun('run-demo-module-3');
      return {
        calls: calls.length,
        planCalls: calls.filter((call) => call.metadata?.sourcePlanId === 'run-plan-ticket-audit-module-3-demo-run-execution').length,
        firstTool: calls[0]?.toolName,
      };
    });
    assert(result.calls > 0, 'no tool calls generated');
    assert(result.planCalls > 0, 'plan-generated tool calls missing');
    return result;
  });

  await expectStep(rows, 'plan persists across reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const { getCurrentPlanForTicket } = await import('/src/runtime-store/run-plan-store.ts');
      const plan = getCurrentPlanForTicket('ticket-audit-module-3');
      return { id: plan?.id, planStatus: plan?.status, steps: plan?.steps.length ?? 0 };
    });
    assert(result.id === 'run-plan-ticket-audit-module-3-deployment-readiness', `expected latest persisted plan, got ${result.id}`);
    assert(result.steps > 0, 'persisted plan steps missing');
    return result;
  });

  await expectStep(rows, 'selectors expose plan status', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      const readyPlan = selectors.selectRunPlan('run-plan-ticket-audit-module-3-demo-run-execution');
      const blockedPlan = selectors.selectRunPlan('run-plan-ticket-audit-module-3-deployment-readiness');
      const ticketVm = selectors.selectTicketDetailViewModel('ticket-audit-module-3');
      return {
        readyStatus: readyPlan?.status,
        blockedStatus: blockedPlan?.status,
        currentStatus: ticketVm.currentPlan?.status,
        planCount: ticketVm.plans.length,
      };
    });
    assert(result.readyStatus === 'ready', 'ready plan selector failed');
    assert(result.blockedStatus === 'blocked', 'blocked plan selector failed');
    assert(result.currentStatus === 'blocked', 'current ticket plan selector failed');
    assert(result.planCount >= 3, 'plans by ticket selector incomplete');
    return result;
  });

  await expectStep(rows, 'ticket and run routes render plan data', async () => {
    await page.goto(`${baseUrl}/tickets/demo-ticket`, { waitUntil: 'networkidle' });
    await page.getByText('Run Plan').first().waitFor({ timeout: 10000 });
    await page.getByText('Create plan').first().waitFor({ timeout: 10000 });
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.getByText('Plan Status').first().waitFor({ timeout: 10000 });
    return { routes: '/tickets/demo-ticket,/runs/demo-run' };
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

  console.log('| Run planner | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nRun planner smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
