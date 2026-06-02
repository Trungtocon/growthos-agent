import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/chaos-simulation-smoke.json');

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
    rows.push({ name, ...(await action()), status: 'passed' });
  } catch (error) {
    rows.push({ name, status: 'failed', error: error instanceof Error ? error.message : String(error) });
  }
}

async function reset(page) {
  await page.evaluate(async () => {
    const { clearWorkerObservabilityStore } = await import('/src/runtime/worker-observability-store.ts');
    const { clearWorkerRecoveryStore } = await import('/src/runtime/worker-recovery-store.ts');
    const { clearImprovementLoopGovernanceStore, disableGlobalLoopKillSwitch } = await import('/src/runtime/improvement-loop-governance-store.ts');
    const { clearArtifactRegistry } = await import('/src/runtime/artifact-registry-store.ts');
    const { clearChaosSimulationStore } = await import('/src/runtime/chaos-simulation-store.ts');
    clearWorkerObservabilityStore();
    clearWorkerRecoveryStore();
    clearImprovementLoopGovernanceStore();
    disableGlobalLoopKillSwitch();
    clearArtifactRegistry();
    clearChaosSimulationStore();
  });
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const rows = [];
  try {
    await page.goto(`${baseUrl}/chaos`, { waitUntil: 'networkidle' });
    await reset(page);
    let staleScenarioId;
    let staleRunId;
    let highRiskRunId;

    await expectStep(rows, 'create chaos scenario', async () => {
      const scenario = await page.evaluate(async () => {
        const { createChaosScenario } = await import('/src/runtime/chaos-simulation-store.ts');
        return createChaosScenario({ type: 'worker_stale', name: 'Stale worker smoke', description: 'Inject a controlled stale worker incident.' });
      });
      staleScenarioId = scenario.id;
      assert(scenario.type === 'worker_stale', 'scenario type mismatch');
      return { scenarioId: scenario.id };
    });

    await expectStep(rows, 'start chaos run', async () => {
      const run = await page.evaluate(async (scenarioId) => {
        const { startChaosRun } = await import('/src/runtime/chaos-simulation-store.ts');
        return startChaosRun(scenarioId);
      }, staleScenarioId);
      staleRunId = run.id;
      assert(run.status === 'running', 'chaos run did not start');
      return { runId: run.id };
    });

    await expectStep(rows, 'inject stale worker event', async () => {
      const event = await page.evaluate(async (runId) => {
        const { injectChaosEvent } = await import('/src/runtime/chaos-simulation-store.ts');
        return injectChaosEvent(runId);
      }, staleRunId);
      assert(event.type === 'worker_stale', 'stale worker event not injected');
      return { eventId: event.id };
    });

    await expectStep(rows, 'generate worker incident', async () => {
      const incidents = await page.evaluate(async () => {
        const { getWorkerIncidents } = await import('/src/runtime/worker-observability-store.ts');
        return getWorkerIncidents();
      });
      assert(incidents.some((incident) => incident.reason === 'stale_worker'), 'stale worker incident missing');
      return { incidents: incidents.length };
    });

    await expectStep(rows, 'create recovery plan', async () => {
      const dashboard = await page.evaluate(async () => {
        const { getWorkerRecoveryDashboard } = await import('/src/runtime/worker-recovery-store.ts');
        return getWorkerRecoveryDashboard();
      });
      assert(dashboard.plans.some((plan) => plan.incidentReason === 'stale_worker'), 'recovery plan missing');
      return { plans: dashboard.plans.length };
    });

    await expectStep(rows, 'auto-healing handles low-risk retry', async () => {
      const result = await page.evaluate(async (runId) => {
        const { evaluateRecoveryResponse } = await import('/src/runtime/chaos-simulation-store.ts');
        return evaluateRecoveryResponse(runId);
      }, staleRunId);
      assert(result.autoHealingDecision === 'AUTO_EXECUTE', `expected AUTO_EXECUTE, got ${result.autoHealingDecision}`);
      return { decision: result.autoHealingDecision };
    });

    await expectStep(rows, 'governance blocks high-risk rollback', async () => {
      const result = await page.evaluate(async () => {
        const { createChaosScenario, startChaosRun, injectChaosEvent, evaluateRecoveryResponse } = await import('/src/runtime/chaos-simulation-store.ts');
        const scenario = createChaosScenario({ type: 'recovery_loop_failure', name: 'High risk rollback', description: 'Force retry exhaustion and rollback review.' });
        const run = startChaosRun(scenario.id);
        injectChaosEvent(run.id);
        return { run, result: evaluateRecoveryResponse(run.id) };
      });
      highRiskRunId = result.run.id;
      assert(result.result.autoHealingDecision === 'REQUIRE_APPROVAL', 'high risk rollback did not require approval');
      return { runId: highRiskRunId, decision: result.result.autoHealingDecision };
    });

    await expectStep(rows, 'approval timeout produces waiting state', async () => {
      const result = await page.evaluate(async () => {
        const { createChaosScenario, startChaosRun, injectChaosEvent } = await import('/src/runtime/chaos-simulation-store.ts');
        const scenario = createChaosScenario({ type: 'approval_timeout', name: 'Approval timeout', description: 'Force approval timeout state.' });
        const run = startChaosRun(scenario.id);
        injectChaosEvent(run.id);
        return run.id;
      });
      const run = await page.evaluate(async (runId) => {
        const { getChaosRun } = await import('/src/runtime/chaos-simulation-store.ts');
        return getChaosRun(runId);
      }, result);
      assert(run.status === 'waiting_approval', `expected waiting_approval, got ${run.status}`);
      return { status: run.status };
    });

    await expectStep(rows, 'kill switch blocks new worker execution', async () => {
      const enabled = await page.evaluate(async () => {
        const { createChaosScenario, startChaosRun, injectChaosEvent } = await import('/src/runtime/chaos-simulation-store.ts');
        const { getGlobalLoopKillSwitch } = await import('/src/runtime/improvement-loop-governance-store.ts');
        const scenario = createChaosScenario({ type: 'kill_switch_triggered', name: 'Kill switch', description: 'Enable global loop kill switch.' });
        const run = startChaosRun(scenario.id);
        injectChaosEvent(run.id);
        return getGlobalLoopKillSwitch().enabled;
      });
      assert(enabled, 'kill switch was not enabled');
      return { enabled };
    });

    await expectStep(rows, 'sandbox offline does not call real endpoint', async () => {
      const result = await page.evaluate(async () => {
        const { createChaosScenario, startChaosRun, injectChaosEvent, getChaosRun } = await import('/src/runtime/chaos-simulation-store.ts');
        const scenario = createChaosScenario({ type: 'sandbox_offline', name: 'Sandbox offline', description: 'Exercise mock-only sandbox outage.' });
        const run = startChaosRun(scenario.id);
        injectChaosEvent(run.id);
        return getChaosRun(run.id);
      });
      assert(result.runtimeMode === 'chaos_mock', 'chaos run escaped demo runtime mode');
      assert(result.realEndpointCalls === 0, 'chaos run called a real endpoint');
      return { mode: result.runtimeMode, calls: result.realEndpointCalls };
    });

    await expectStep(rows, 'recovery result is scored', async () => {
      const scorecard = await page.evaluate(async (runId) => {
        const { completeChaosRun } = await import('/src/runtime/chaos-simulation-store.ts');
        return completeChaosRun(runId).scorecard;
      }, staleRunId);
      assert(scorecard.score >= 0 && scorecard.score <= 100, 'scorecard score invalid');
      return { score: scorecard.score };
    });

    await expectStep(rows, 'chaos artifacts are registered', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportChaosReport } = await import('/src/runtime/chaos-simulation-store.ts');
        return exportChaosReport();
      });
      assert(artifacts.length >= 5, 'chaos artifacts missing');
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'selectors return dashboard data', async () => {
      const dashboard = await page.evaluate(async () => {
        const { selectChaosDashboard } = await import('/src/domain/selectors.ts');
        return selectChaosDashboard();
      });
      assert(dashboard.scenarios.length >= 4, 'chaos dashboard missing scenarios');
      return { scenarios: dashboard.scenarios.length, runs: dashboard.runs.length };
    });

    await expectStep(rows, 'compact widgets render safely', async () => {
      await page.goto(`${baseUrl}/evaluation`, { waitUntil: 'networkidle' });
      const evaluation = await page.locator('[data-chaos-simulation-widget="evaluation"]').count();
      await page.goto(`${baseUrl}/worker-recovery`, { waitUntil: 'networkidle' });
      const recovery = await page.locator('[data-chaos-simulation-widget="worker-recovery"]').count();
      await page.goto(`${baseUrl}/agents/demo-agent`, { waitUntil: 'networkidle' });
      const agent = await page.locator('[data-chaos-simulation-widget="agent"]').count();
      assert(evaluation > 0 && recovery > 0 && agent > 0, 'compact chaos widgets missing');
      return { evaluation, recovery, agent };
    });

    await expectStep(rows, 'chaos run can complete', async () => {
      const run = await page.evaluate(async (runId) => {
        const { getChaosRun } = await import('/src/runtime/chaos-simulation-store.ts');
        return getChaosRun(runId);
      }, staleRunId);
      assert(run.status === 'completed', 'chaos run did not complete');
      return { status: run.status };
    });

    await expectStep(rows, 'chaos run can fail safely', async () => {
      const run = await page.evaluate(async (runId) => {
        const { failChaosRun } = await import('/src/runtime/chaos-simulation-store.ts');
        return failChaosRun(runId, 'Controlled smoke failure.');
      }, highRiskRunId);
      assert(run.status === 'failed', 'chaos run did not fail safely');
      return { status: run.status };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const failed = rows.filter((row) => row.status !== 'passed');
  const report = { generatedAt: new Date().toISOString(), baseUrl, rows, passed: rows.length - failed.length, failed: failed.length };
  writeJson(reportPath, report);
  if (failed.length) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), status: 'failed', error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
