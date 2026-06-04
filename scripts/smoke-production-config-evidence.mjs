import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/production-config-evidence-smoke.json');

const requiredFiles = [
  'src/runtime/production-config-evidence.ts',
  'src/runtime/production-config-evidence-store.ts',
  'src/pages/ProductionConfigEvidencePage.tsx',
];

const requiredCategories = [
  'backend_endpoint',
  'database_config',
  'auth_config',
  'secret_presence',
  'secret_owner',
  'secret_scope',
  'secret_rotation',
  'schema_version',
  'migration_status',
  'rbac_binding',
  'tenant_workspace_binding',
  'production_endpoint_reachability',
];

const requiredArtifacts = [
  'production-config-evidence.json',
  'production-config-evidence-summary.md',
  'production-evidence-blockers.json',
  'production-evidence-redaction-report.md',
  'production-go-live-evidence-pack.md',
  'production-config-final-verdict.md',
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

  await expectStep(rows, 'required Sprint 9F source files exist', async () => {
    const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
    assert(missing.length === 0, `missing files: ${missing.join(', ')}`);
    return { files: requiredFiles.length };
  });

  if (rows.some((row) => row.status === 'failed')) {
    writeJson(reportPath, { generatedAt: new Date().toISOString(), rows, passed: 0, failed: rows.length });
    console.table(rows);
    console.log(`Production config evidence smoke summary: 0/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
    process.exit(1);
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });

  try {
    await page.goto(`${baseUrl}/production-config-evidence`, { waitUntil: 'networkidle' });

    await expectStep(rows, 'evidence store initializes', async () => {
      const state = await page.evaluate(async () => {
        const { getProductionConfigEvidenceState } = await import('/src/runtime/production-config-evidence-store.ts');
        return getProductionConfigEvidenceState();
      });
      assert(Array.isArray(state.evidence), 'evidence array missing');
      assert(Array.isArray(state.artifacts), 'artifact array missing');
      return { evidence: state.evidence.length, artifacts: state.artifacts.length };
    });

    await expectStep(rows, 'required categories exist', async () => {
      const categories = await page.evaluate(async () => {
        const { PRODUCTION_EVIDENCE_CATEGORIES } = await import('/src/runtime/production-config-evidence.ts');
        return PRODUCTION_EVIDENCE_CATEGORIES;
      });
      const missing = requiredCategories.filter((category) => !categories.includes(category));
      assert(missing.length === 0, `missing categories: ${missing.join(', ')}`);
      return { categories: categories.length };
    });

    await expectStep(rows, 'raw secrets are never stored', async () => {
      const result = await page.evaluate(async () => {
        const { clearProductionConfigEvidence, addEvidence } = await import('/src/runtime/production-config-evidence-store.ts');
        clearProductionConfigEvidence();
        return addEvidence({
          category: 'secret_presence',
          environment: 'PRODUCTION',
          evidenceType: 'attestation',
          description: 'Secret exists in the external vault.',
          source: 'vault',
          providedBy: 'security',
          rawValue: 'raw-secret-value-never-store',
          metadata: { presenceConfirmed: true },
        });
      });
      assert(!JSON.stringify(result).includes('raw-secret-value-never-store'), 'raw secret leaked into evidence record');
      assert(result.maskedValue && result.maskedValue.includes('***'), 'masked value missing');
      return { status: result.status, maskedValue: result.maskedValue };
    });

    await expectStep(rows, 'invalid localhost/mock/demo production endpoint is rejected', async () => {
      const record = await page.evaluate(async () => {
        const { clearProductionConfigEvidence, addEvidence } = await import('/src/runtime/production-config-evidence-store.ts');
        clearProductionConfigEvidence();
        return addEvidence({
          category: 'backend_endpoint',
          environment: 'PRODUCTION',
          evidenceType: 'endpoint',
          description: 'Unsafe endpoint evidence.',
          source: 'operator',
          providedBy: 'platform',
          rawValue: 'http://localhost:3000/demo',
        });
      });
      assert(record.status === 'rejected', `expected rejected, got ${record.status}`);
      return { status: record.status, warnings: record.warnings.length };
    });

    await expectStep(rows, 'verified backend endpoint evidence resolves related blocker', async () => {
      const dashboard = await page.evaluate(async () => {
        const { clearProductionConfigEvidence, addEvidence, verifyEvidence, selectProductionConfigEvidenceDashboard } = await import('/src/runtime/production-config-evidence-store.ts');
        clearProductionConfigEvidence();
        const record = addEvidence({
          category: 'backend_endpoint',
          environment: 'PRODUCTION',
          evidenceType: 'endpoint',
          description: 'Production backend endpoint is configured outside local/demo.',
          source: 'platform',
          providedBy: 'platform-owner',
          rawValue: 'https://api.uikigai.example.com',
        });
        verifyEvidence(record.id, 'endpoint_attestation');
        return selectProductionConfigEvidenceDashboard();
      });
      assert(dashboard.resolvedBlockers.some((entry) => /backend endpoint/i.test(entry)), 'backend endpoint blocker not resolved');
      return { resolved: dashboard.resolvedBlockers.length, remaining: dashboard.remainingBlockers.length };
    });

    await expectStep(rows, 'verified auth evidence resolves auth blocker', async () => {
      const dashboard = await page.evaluate(async () => {
        const { clearProductionConfigEvidence, addEvidence, verifyEvidence, selectProductionConfigEvidenceDashboard } = await import('/src/runtime/production-config-evidence-store.ts');
        clearProductionConfigEvidence();
        const record = addEvidence({
          category: 'auth_config',
          environment: 'PRODUCTION',
          evidenceType: 'config_attestation',
          description: 'Auth provider, issuer, audience, token and session modes are configured.',
          source: 'identity',
          providedBy: 'security',
          rawValue: 'auth0-production-config',
          metadata: { provider: 'auth0', issuer: 'https://issuer.example.com', audience: 'growthos', tokenMode: 'jwt', sessionMode: 'cookie' },
        });
        verifyEvidence(record.id, 'identity_attestation');
        return selectProductionConfigEvidenceDashboard();
      });
      assert(dashboard.resolvedBlockers.some((entry) => /auth config/i.test(entry)), 'auth blocker not resolved');
      return { resolved: dashboard.resolvedBlockers.length };
    });

    await expectStep(rows, 'verified database evidence resolves database blocker', async () => {
      const dashboard = await page.evaluate(async () => {
        const { clearProductionConfigEvidence, addEvidence, verifyEvidence, selectProductionConfigEvidenceDashboard } = await import('/src/runtime/production-config-evidence-store.ts');
        clearProductionConfigEvidence();
        const record = addEvidence({
          category: 'database_config',
          environment: 'PRODUCTION',
          evidenceType: 'config_attestation',
          description: 'Postgres production connection exists in managed secret store.',
          source: 'database',
          providedBy: 'data-platform',
          rawValue: 'postgres://prod-user:prod-password@db.example.com/growthos',
          metadata: { provider: 'postgres' },
        });
        verifyEvidence(record.id, 'database_attestation');
        return selectProductionConfigEvidenceDashboard();
      });
      assert(dashboard.resolvedBlockers.some((entry) => /database config/i.test(entry)), 'database blocker not resolved');
      return { resolved: dashboard.resolvedBlockers.length };
    });

    await expectStep(rows, 'missing rotation evidence remains blocker', async () => {
      const dashboard = await page.evaluate(async () => {
        const { clearProductionConfigEvidence, addEvidence, verifyEvidence, selectProductionConfigEvidenceDashboard } = await import('/src/runtime/production-config-evidence-store.ts');
        clearProductionConfigEvidence();
        for (const category of ['backend_endpoint', 'database_config', 'auth_config', 'secret_presence', 'secret_owner', 'secret_scope']) {
          const record = addEvidence({
            category,
            environment: 'PRODUCTION',
            evidenceType: 'attestation',
            description: `${category} evidence`,
            source: 'operator',
            providedBy: 'platform',
            rawValue: category === 'backend_endpoint' ? 'https://api.uikigai.example.com' : `${category}-proof`,
            metadata: category === 'database_config'
              ? { provider: 'postgres' }
              : category === 'auth_config'
                ? { provider: 'auth0', issuer: 'https://issuer.example.com', audience: 'growthos', tokenMode: 'jwt', sessionMode: 'cookie' }
                : category === 'secret_presence'
                  ? { presenceConfirmed: true }
                  : {},
          });
          verifyEvidence(record.id, 'manual');
        }
        return selectProductionConfigEvidenceDashboard();
      });
      assert(dashboard.remainingBlockers.some((entry) => /secret rotation/i.test(entry)), 'secret rotation blocker should remain');
      return { remaining: dashboard.remainingBlockers.length };
    });

    await expectStep(rows, 'expired evidence re-blocks gate', async () => {
      const dashboard = await page.evaluate(async () => {
        const { clearProductionConfigEvidence, addEvidence, verifyEvidence, expireEvidence, selectProductionConfigEvidenceDashboard } = await import('/src/runtime/production-config-evidence-store.ts');
        clearProductionConfigEvidence();
        const record = addEvidence({
          category: 'backend_endpoint',
          environment: 'PRODUCTION',
          evidenceType: 'endpoint',
          description: 'Production backend endpoint evidence.',
          source: 'platform',
          providedBy: 'platform',
          rawValue: 'https://api.uikigai.example.com',
        });
        verifyEvidence(record.id, 'endpoint_attestation');
        expireEvidence(record.id);
        return selectProductionConfigEvidenceDashboard();
      });
      assert(dashboard.expired.length === 1, 'expired evidence not tracked');
      assert(dashboard.remainingBlockers.some((entry) => /backend endpoint/i.test(entry)), 'expired backend evidence should re-block');
      return { expired: dashboard.expired.length, verdict: dashboard.verdict };
    });

    await expectStep(rows, 'pre-golive reads evidence gate', async () => {
      const run = await page.evaluate(async () => {
        const { runFullPreGoLiveValidation } = await import('/src/runtime/pre-golive-validation-store.ts');
        return runFullPreGoLiveValidation();
      });
      assert(run.gates.some((gate) => gate.gateId === 'production-config-evidence'), 'production config evidence gate missing');
      return { gates: run.gates.length, verdict: run.finalVerdict };
    });

    await expectStep(rows, 'route /production-config-evidence exists', async () => {
      await page.goto(`${baseUrl}/production-config-evidence`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-route="/production-config-evidence"]').count();
      const buttons = await page.locator('[data-route="/production-config-evidence"] button[data-action]').count();
      assert(route === 1, 'route marker missing');
      assert(buttons >= 6, `expected 6 wired buttons, got ${buttons}`);
      return { route, buttons };
    });

    await expectStep(rows, 'all visible buttons are wired', async () => {
      await page.goto(`${baseUrl}/production-config-evidence`, { waitUntil: 'networkidle' });
      const silent = await page.locator('[data-route="/production-config-evidence"] button:visible').evaluateAll((buttons) => buttons.filter((button) => {
        const hasAction = button.hasAttribute('data-action');
        const reason = button.disabled ? button.getAttribute('data-disabled-reason') || button.getAttribute('title') : '';
        return button.disabled ? !reason : !hasAction;
      }).length);
      assert(silent === 0, `silent buttons=${silent}`);
      return { silentButtons: silent };
    });

    await expectStep(rows, 'artifacts are registered', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportProductionConfigEvidencePack } = await import('/src/runtime/production-config-evidence-store.ts');
        return exportProductionConfigEvidencePack();
      });
      const names = artifacts.map((artifact) => artifact.name);
      for (const name of requiredArtifacts) assert(names.includes(name), `${name} missing`);
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
  console.log(`Production config evidence smoke summary: ${passed}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  writeJson(reportPath, { generatedAt: new Date().toISOString(), failed: 1, error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exit(1);
});
