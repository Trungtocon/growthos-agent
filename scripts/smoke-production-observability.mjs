import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/production-observability-smoke.json');

const requiredFiles = [
  'src/runtime/production-observability.ts',
  'src/runtime/production-observability-store.ts',
  'src/pages/ProductionObservabilityPage.tsx',
];

const requiredArtifacts = [
  'production-observability-report.md',
  'production-observability.json',
  'production-alert-readiness.md',
  'production-incident-runbook.md',
  'production-slo-sla-report.md',
  'production-rto-rpo-report.md',
  'production-observability-blockers.json',
];

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
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

async function main() {
  const rows = [];

  await expectStep(rows, 'required Sprint 9G source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length });
    console.table(rows);
    console.log(`Production observability smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });

  try {
    await page.goto(`${baseUrl}/production-observability`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'store initializes', async () => {
      const state = await page.evaluate(async () => {
        const { getProductionObservabilityState } = await import('/src/runtime/production-observability-store.ts');
        return getProductionObservabilityState();
      });
      assert(Array.isArray(state.checks), 'checks missing');
      assert(Array.isArray(state.artifacts), 'artifacts missing');
      return { checks: state.checks.length, artifacts: state.artifacts.length };
    });

    await expectStep(rows, 'missing observability keeps gate BLOCKED', async () => {
      const dashboard = await page.evaluate(async () => {
        const { clearProductionObservability, selectObservabilityDashboard } = await import('/src/runtime/production-observability-store.ts');
        clearProductionObservability();
        return selectObservabilityDashboard();
      });
      assert(dashboard.verdict === 'BLOCKED', `expected BLOCKED, got ${dashboard.verdict}`);
      assert(dashboard.blockers.length >= 7, 'required blockers missing');
      return { verdict: dashboard.verdict, blockers: dashboard.blockers.length };
    });

    await expectStep(rows, 'valid health monitor improves readiness', async () => {
      const dashboard = await page.evaluate(async () => {
        const { clearProductionObservability, addMonitorEvidence, verifyMonitorEvidence, selectObservabilityDashboard } = await import('/src/runtime/production-observability-store.ts');
        clearProductionObservability();
        const monitor = addMonitorEvidence({ name: 'Production API monitor', endpoint: 'https://api.uikigai.example.com/health', uptimePercent: 99.95, latencyMs: 180, errorRatePercent: 0.05 });
        verifyMonitorEvidence(monitor.id, 'synthetic_check');
        return selectObservabilityDashboard();
      });
      assert(dashboard.healthMatrix.some((entry) => entry.status === 'verified'), 'verified health monitor missing');
      assert(dashboard.readinessScore > 0, 'readiness score did not improve');
      return { score: dashboard.readinessScore, health: dashboard.healthMatrix.length };
    });

    await expectStep(rows, 'missing alert channel remains blocker', async () => {
      const dashboard = await page.evaluate(async () => {
        const { selectObservabilityDashboard } = await import('/src/runtime/production-observability-store.ts');
        return selectObservabilityDashboard();
      });
      assert(dashboard.blockers.some((entry) => /alert channel/i.test(entry)), 'alert channel blocker missing');
      return { blockers: dashboard.blockers.length };
    });

    await expectStep(rows, 'valid alert channel resolves alert blocker', async () => {
      const dashboard = await page.evaluate(async () => {
        const { addAlertChannel, testAlertChannel, selectObservabilityDashboard } = await import('/src/runtime/production-observability-store.ts');
        const channel = addAlertChannel({ name: 'PagerDuty primary', channelType: 'pagerduty', target: 'pd-prod-escalation' });
        testAlertChannel(channel.id);
        return selectObservabilityDashboard();
      });
      assert(!dashboard.blockers.some((entry) => /alert channel/i.test(entry)), 'alert channel blocker still present');
      return { alerts: dashboard.alertChannels.length };
    });

    await expectStep(rows, 'missing incident owner remains blocker', async () => {
      const dashboard = await page.evaluate(async () => {
        const { clearProductionObservability, addAlertChannel, testAlertChannel, selectObservabilityDashboard } = await import('/src/runtime/production-observability-store.ts');
        clearProductionObservability();
        const channel = addAlertChannel({ name: 'PagerDuty primary', channelType: 'pagerduty', target: 'pd-prod-escalation' });
        testAlertChannel(channel.id);
        return selectObservabilityDashboard();
      });
      assert(dashboard.blockers.some((entry) => /incident owner/i.test(entry)), 'incident owner blocker missing');
      return { blockers: dashboard.blockers.length };
    });

    await expectStep(rows, 'valid incident owner resolves owner blocker', async () => {
      const dashboard = await page.evaluate(async () => {
        const { addIncidentOwner, selectObservabilityDashboard } = await import('/src/runtime/production-observability-store.ts');
        addIncidentOwner({ name: 'Platform on-call', team: 'SRE', escalationPolicy: 'sev1-primary-secondary' });
        return selectObservabilityDashboard();
      });
      assert(!dashboard.blockers.some((entry) => /incident owner/i.test(entry)), 'incident owner blocker still present');
      return { owners: dashboard.incidentOwners.length };
    });

    await expectStep(rows, 'runbook evidence required', async () => {
      const dashboard = await page.evaluate(async () => {
        const { selectObservabilityDashboard } = await import('/src/runtime/production-observability-store.ts');
        return selectObservabilityDashboard();
      });
      assert(dashboard.blockers.some((entry) => /runbook|rollback/i.test(entry)), 'runbook blocker missing');
      return { blockers: dashboard.blockers.length };
    });

    await expectStep(rows, 'SLO/SLA thresholds required', async () => {
      const dashboard = await page.evaluate(async () => {
        const { selectObservabilityDashboard } = await import('/src/runtime/production-observability-store.ts');
        return selectObservabilityDashboard();
      });
      assert(dashboard.blockers.some((entry) => /SLO|SLA/i.test(entry)), 'SLO/SLA blocker missing');
      return { blockers: dashboard.blockers.length };
    });

    await expectStep(rows, 'RTO/RPO evidence required', async () => {
      const dashboard = await page.evaluate(async () => {
        const { selectObservabilityDashboard } = await import('/src/runtime/production-observability-store.ts');
        return selectObservabilityDashboard();
      });
      assert(dashboard.blockers.some((entry) => /RTO|RPO/i.test(entry)), 'RTO/RPO blocker missing');
      return { blockers: dashboard.blockers.length };
    });

    await expectStep(rows, 'Pre-Go-Live reads production-observability gate', async () => {
      const run = await page.evaluate(async () => {
        const { runFullPreGoLiveValidation } = await import('/src/runtime/pre-golive-validation-store.ts');
        return runFullPreGoLiveValidation();
      });
      const gate = run.gates.find((entry) => entry.gateId === 'production-observability');
      assert(gate, 'production-observability gate missing');
      assert(gate.status === 'blocked', `expected blocked gate, got ${gate.status}`);
      return { gates: run.gates.length, status: gate.status };
    });

    await expectStep(rows, 'route /production-observability exists', async () => {
      await page.goto(`${baseUrl}/production-observability`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-route="/production-observability"]').count();
      const buttons = await page.locator('[data-route="/production-observability"] button[data-action]').count();
      assert(route === 1, 'route marker missing');
      assert(buttons >= 8, `expected 8 wired buttons, got ${buttons}`);
      return { route, buttons };
    });

    await expectStep(rows, 'all visible buttons are wired', async () => {
      await page.goto(`${baseUrl}/production-observability`, { waitUntil: 'networkidle' });
      const silent = await page.locator('[data-route="/production-observability"] button:visible').evaluateAll((buttons) => buttons.filter((button) => {
        const hasAction = button.hasAttribute('data-action');
        const reason = button.disabled ? button.getAttribute('data-disabled-reason') || button.getAttribute('title') : '';
        return button.disabled ? !reason : !hasAction;
      }).length);
      assert(silent === 0, `silent buttons=${silent}`);
      return { silentButtons: silent };
    });

    await expectStep(rows, 'artifacts are registered', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportObservabilityPack } = await import('/src/runtime/production-observability-store.ts');
        return exportObservabilityPack();
      });
      const names = artifacts.map((artifact) => artifact.name);
      for (const name of requiredArtifacts) assert(names.includes(name), `${name} missing`);
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, 'no raw secret values are displayed or logged', async () => {
      await page.goto(`${baseUrl}/production-observability`, { waitUntil: 'networkidle' });
      const text = await page.locator('[data-route="/production-observability"]').innerText();
      assert(!/raw-secret|prod-password|api-key-secret/i.test(text), 'raw secret marker displayed');
      return { leaked: false };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const passed = rows.filter((row) => row.status === 'passed').length;
  const failed = rows.filter((row) => row.status === 'failed').length;
  writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed, failed });
  console.table(rows);
  console.log(`Production observability smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), failed: 1, error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
