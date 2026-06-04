import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/database-readiness-smoke.json');

const requiredFiles = [
  'src/runtime/database-config.ts',
  'src/runtime/database-client-factory.ts',
  'src/runtime/persistence-registry.ts',
  'src/runtime/audit-log-store.ts',
  'src/runtime/database-readiness.ts',
  'src/pages/DatabaseReadinessPage.tsx',
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

  await expectStep(rows, 'required Sprint 9C source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    const report = { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length };
    writeJson(reportPath, report);
    console.table(rows);
    console.log(`Database readiness smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  try {
    await page.goto(`${baseUrl}/database-readiness`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'database config exists', async () => {
      const configs = await page.evaluate(async () => {
        const { getDatabaseConfigs } = await import('/src/runtime/database-config.ts');
        return getDatabaseConfigs();
      });
      const modes = configs.map((config) => config.mode);
      for (const mode of ['mock', 'local', 'supabase', 'postgres', 'production']) assert(modes.includes(mode), `${mode} config missing`);
      return { configs: configs.length };
    });

    await expectStep(rows, 'database client factory exists', async () => {
      const clients = await page.evaluate(async () => {
        const { createDatabaseClient } = await import('/src/runtime/database-client-factory.ts');
        return Promise.all([
          createDatabaseClient('LOCAL').describe(),
          createDatabaseClient('SANDBOX').describe(),
          createDatabaseClient('STAGING').describe(),
          createDatabaseClient('PRODUCTION').describe(),
        ]);
      });
      assert(clients.every((client) => client.environmentId && client.mode), 'client description missing environment or mode');
      return { clients: clients.length };
    });

    await expectStep(rows, 'persistence registry exists', async () => {
      const domains = await page.evaluate(async () => {
        const { getPersistenceDomains } = await import('/src/runtime/persistence-registry.ts');
        return getPersistenceDomains();
      });
      for (const domainId of ['runtime_runs', 'artifacts', 'approvals', 'governance_decisions', 'workers', 'evaluation_results', 'feedback_actions', 'recommendations', 'audit_logs', 'usage_ledger', 'cost_reports', 'pre_golive_reports']) {
        assert(domains.some((domain) => domain.domainId === domainId), `${domainId} domain missing`);
      }
      return { domains: domains.length };
    });

    await expectStep(rows, 'audit log store exists', async () => {
      const summary = await page.evaluate(async () => {
        const { appendAuditEvent, selectAuditLogSummary } = await import('/src/runtime/audit-log-store.ts');
        appendAuditEvent({ actor: 'smoke', action: 'database.readiness.smoke', targetType: 'database', targetId: 'production', environment: 'PRODUCTION', status: 'success', metadata: { smoke: true } });
        return selectAuditLogSummary();
      });
      assert(summary.total >= 1, 'audit event was not recorded');
      assert(summary.writable === true, 'audit log should be writable in session storage');
      return { events: summary.total, writable: summary.writable };
    });

    await expectStep(rows, 'readiness engine exists', async () => {
      const report = await page.evaluate(async () => {
        const { evaluateDatabaseReadiness } = await import('/src/runtime/database-readiness.ts');
        return evaluateDatabaseReadiness('PRODUCTION');
      });
      assert(['READY', 'WARNING', 'BLOCKED'].includes(report.status), `unexpected status ${report.status}`);
      assert(report.blockers.length >= 1, 'missing production DB should create a blocker');
      return { status: report.status, score: report.readinessScore, blockers: report.blockers.length };
    });

    await expectStep(rows, 'route /database-readiness exists', async () => {
      await page.goto(`${baseUrl}/database-readiness`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-route="/database-readiness"]').count();
      const domainRows = await page.locator('[data-persistence-domain-row]').count();
      const actionButtons = await page.locator('[data-route="/database-readiness"] button[data-action]').count();
      assert(route === 1, 'database readiness route marker missing');
      assert(domainRows >= 12, `expected persistence domain rows, got ${domainRows}`);
      assert(actionButtons >= 2, `expected wired action buttons, got ${actionButtons}`);
      return { route, domains: domainRows, actionButtons };
    });

    await expectStep(rows, 'selectors work', async () => {
      const selectors = await page.evaluate(async () => {
        const selectorsModule = await import('/src/domain/selectors.ts');
        return {
          config: selectorsModule.selectDatabaseConfig(),
          health: selectorsModule.selectDatabaseHealth(),
          domains: selectorsModule.selectPersistenceDomains(),
          audit: selectorsModule.selectAuditLogSummary(),
          readiness: selectorsModule.selectDatabaseReadiness(),
          blockers: selectorsModule.selectDatabaseBlockers(),
          warnings: selectorsModule.selectDatabaseWarnings(),
          gate: selectorsModule.selectPreGoLiveDatabaseGate(),
        };
      });
      assert(selectors.config.mode === 'production', 'production database config selector missing');
      assert(selectors.domains.length >= 12, 'persistence domain selector missing rows');
      assert(selectors.readiness.status === 'BLOCKED', `expected BLOCKED readiness, got ${selectors.readiness.status}`);
      assert(selectors.gate?.gateId === 'database-readiness', 'pre go-live database gate selector missing');
      return { domains: selectors.domains.length, blockers: selectors.blockers.length };
    });

    await expectStep(rows, 'pre go-live has Database Readiness gate', async () => {
      const run = await page.evaluate(async () => {
        const { runFullPreGoLiveValidation } = await import('/src/runtime/pre-golive-validation-store.ts');
        return runFullPreGoLiveValidation();
      });
      assert(run.gates.some((gate) => gate.gateId === 'database-readiness'), 'Database Readiness gate missing');
      assert(run.finalVerdict === 'BLOCKED', `expected BLOCKED final verdict, got ${run.finalVerdict}`);
      return { gates: run.gates.length, verdict: run.finalVerdict };
    });

    await expectStep(rows, 'missing production DB keeps verdict BLOCKED', async () => {
      const summary = await page.evaluate(async () => {
        const { selectPreGoLiveValidationSummary } = await import('/src/runtime/pre-golive-validation-store.ts');
        return selectPreGoLiveValidationSummary();
      });
      assert(summary.blockers.some((blocker) => blocker.includes('Database Readiness') || blocker.includes('database')), 'database blocker missing from pre go-live summary');
      assert(summary.finalVerdict === 'BLOCKED', `expected BLOCKED, got ${summary.finalVerdict}`);
      return { blockers: summary.blockers.length };
    });

    await expectStep(rows, 'mock/local DB does not crash UI', async () => {
      const reports = await page.evaluate(async () => {
        const { evaluateDatabaseReadiness } = await import('/src/runtime/database-readiness.ts');
        return [evaluateDatabaseReadiness('LOCAL'), evaluateDatabaseReadiness('SANDBOX')];
      });
      assert(reports.every((report) => ['WARNING', 'READY'].includes(report.status)), `local/sandbox fallback should not block UI: ${reports.map((report) => report.status).join(',')}`);
      return { statuses: reports.map((report) => report.status).join(',') };
    });

    await expectStep(rows, 'artifact exports registered', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportDatabaseReadinessArtifacts } = await import('/src/runtime/database-readiness.ts');
        return exportDatabaseReadinessArtifacts('PRODUCTION');
      });
      const names = artifacts.map((artifact) => artifact.name);
      for (const name of ['database-readiness-report.md', 'database-config.json', 'persistence-domain-matrix.json', 'audit-log-summary.md', 'database-blockers.json', 'database-go-live-evidence.md']) {
        assert(names.includes(name), `${name} missing`);
      }
      return { artifacts: artifacts.length };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  const passed = rows.filter((row) => row.status === 'passed').length;
  const failed = rows.filter((row) => row.status === 'failed').length;
  writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed, failed });
  console.table(rows);
  console.log(`Database readiness smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), failed: 1, error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
