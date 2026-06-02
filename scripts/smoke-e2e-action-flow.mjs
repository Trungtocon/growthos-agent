import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/e2e-action-flow-smoke.json');

const requiredFlows = [
  'start-run-flow',
  'approval-required-flow',
  'approve-and-resume-flow',
  'reject-and-cancel-flow',
  'worker-lifecycle-flow',
  'artifact-export-flow',
  'governance-blocked-flow',
  'production-readiness-check-flow',
  'certified-sandbox-run-flow',
];

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
  await page.evaluate(() => window.sessionStorage.clear());
}

function scanUiForDirectFetch() {
  const roots = ['src/pages', 'src/components'];
  const findings = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(filePath);
      if (!entry.isFile() || !/\.(tsx?|jsx?)$/.test(entry.name)) continue;
      const text = fs.readFileSync(filePath, 'utf8');
      if (/\bfetch\s*\(/.test(text)) findings.push(`${path.relative(root, filePath)} uses fetch()`);
      if (/from ['"].*integrations\/(hermes|paperclip)/.test(text)) findings.push(`${path.relative(root, filePath)} imports integration client`);
    }
  };
  for (const dir of roots) walk(path.join(root, dir));
  return findings;
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const rows = [];
  try {
    await page.goto(`${baseUrl}/e2e-action-flow`, { waitUntil: 'networkidle' });
    await reset(page);

    await expectStep(rows, 'build flow registry', async () => {
      const flows = await page.evaluate(async () => {
        const { getE2EActionFlows } = await import('/src/runtime/e2e-action-flow-store.ts');
        return getE2EActionFlows();
      });
      const ids = flows.map((flow) => flow.flowId);
      for (const flowId of requiredFlows) assert(ids.includes(flowId), `${flowId} missing`);
      return { flows: flows.length };
    });

    await expectStep(rows, 'validate all flow contract sequences', async () => {
      const validation = await page.evaluate(async () => {
        const { validateE2EFlowContracts } = await import('/src/runtime/e2e-action-flow-store.ts');
        return validateE2EFlowContracts();
      });
      assert(validation.invalid.length === 0, `invalid flows: ${validation.invalid.join(', ')}`);
      return { valid: validation.valid.length };
    });

    await expectStep(rows, 'run mock Start Run Flow', async () => {
      const flow = await page.evaluate(async () => {
        const { runE2EActionFlow } = await import('/src/runtime/e2e-action-flow-store.ts');
        return runE2EActionFlow('start-run-flow', 'mock');
      });
      assert(flow.status === 'completed', `expected completed, got ${flow.status}`);
      assert(flow.finalVerdict.includes('MOCK'), `mock verdict missing: ${flow.finalVerdict}`);
      return { status: flow.status, steps: flow.auditTimeline.length };
    });

    await expectStep(rows, 'run Approval Required Flow', async () => {
      const flow = await page.evaluate(async () => {
        const { runE2EActionFlow } = await import('/src/runtime/e2e-action-flow-store.ts');
        return runE2EActionFlow('approval-required-flow', 'mock');
      });
      assert(['waiting_approval', 'completed'].includes(flow.status), `unexpected status ${flow.status}`);
      assert(flow.contractSequence.includes('approval.submit'), 'approval contract missing');
      return { status: flow.status };
    });

    await expectStep(rows, 'approve and resume flow', async () => {
      const flow = await page.evaluate(async () => {
        const { runE2EActionFlow } = await import('/src/runtime/e2e-action-flow-store.ts');
        return runE2EActionFlow('approve-and-resume-flow', 'mock');
      });
      assert(flow.status === 'completed', `expected completed, got ${flow.status}`);
      assert(flow.contractSequence.includes('runtime.run.approve'), 'approve contract missing');
      return { status: flow.status };
    });

    await expectStep(rows, 'reject and cancel flow', async () => {
      const flow = await page.evaluate(async () => {
        const { runE2EActionFlow } = await import('/src/runtime/e2e-action-flow-store.ts');
        return runE2EActionFlow('reject-and-cancel-flow', 'mock');
      });
      assert(flow.status === 'completed', `expected completed, got ${flow.status}`);
      assert(flow.contractSequence.includes('runtime.run.reject') && flow.contractSequence.includes('runtime.run.cancel'), 'reject/cancel contracts missing');
      return { status: flow.status };
    });

    await expectStep(rows, 'worker lifecycle flow', async () => {
      const flow = await page.evaluate(async () => {
        const { runE2EActionFlow } = await import('/src/runtime/e2e-action-flow-store.ts');
        return runE2EActionFlow('worker-lifecycle-flow', 'mock');
      });
      assert(flow.status === 'completed', `expected completed, got ${flow.status}`);
      assert(flow.contractSequence.length === 4, `expected 4 worker contracts, got ${flow.contractSequence.length}`);
      return { status: flow.status, steps: flow.contractSequence.length };
    });

    await expectStep(rows, 'artifact export flow', async () => {
      const flow = await page.evaluate(async () => {
        const { runE2EActionFlow } = await import('/src/runtime/e2e-action-flow-store.ts');
        return runE2EActionFlow('artifact-export-flow', 'mock');
      });
      assert(flow.status === 'completed', `expected completed, got ${flow.status}`);
      assert(flow.artifactOutputs.length > 0, 'artifact output missing');
      return { artifacts: flow.artifactOutputs.length };
    });

    await expectStep(rows, 'governance blocked flow', async () => {
      const flow = await page.evaluate(async () => {
        const { runE2EActionFlow } = await import('/src/runtime/e2e-action-flow-store.ts');
        return runE2EActionFlow('governance-blocked-flow', 'production');
      });
      assert(flow.status === 'blocked', `expected blocked, got ${flow.status}`);
      assert(flow.normalizedErrors.length > 0 || flow.finalVerdict.includes('BLOCKED'), 'blocker not visible');
      return { status: flow.status, blockers: flow.normalizedErrors.length };
    });

    await expectStep(rows, 'production blocked if gates missing', async () => {
      await reset(page);
      const flow = await page.evaluate(async () => {
        const { runE2EActionFlow } = await import('/src/runtime/e2e-action-flow-store.ts');
        return runE2EActionFlow('production-readiness-check-flow', 'production');
      });
      assert(flow.status === 'blocked', `expected blocked, got ${flow.status}`);
      assert(flow.finalVerdict.includes('BLOCKED'), `blocked verdict missing: ${flow.finalVerdict}`);
      return { status: flow.status };
    });

    await expectStep(rows, 'sandbox fallback if env missing', async () => {
      await reset(page);
      const flow = await page.evaluate(async () => {
        const { runE2EActionFlow } = await import('/src/runtime/e2e-action-flow-store.ts');
        return runE2EActionFlow('certified-sandbox-run-flow', 'sandbox');
      });
      assert(flow.status === 'completed', `expected completed fallback, got ${flow.status}`);
      assert(flow.warnings.some((warning) => warning.includes('fallback') || warning.includes('missing env')), 'sandbox fallback warning missing');
      return { status: flow.status, warnings: flow.warnings.length };
    });

    await expectStep(rows, 'artifact exports registered', async () => {
      const artifacts = await page.evaluate(async () => {
        const { exportE2EActionFlowArtifacts } = await import('/src/runtime/e2e-action-flow-store.ts');
        return exportE2EActionFlowArtifacts();
      });
      const names = artifacts.map((artifact) => artifact.name);
      for (const name of ['e2e-action-flow-report.md', 'e2e-action-flow-results.json', 'production-action-audit.md', 'contract-execution-trace.json', 'go-live-action-readiness.md']) {
        assert(names.includes(name), `${name} missing`);
      }
      return { artifacts: artifacts.length };
    });

    await expectStep(rows, '/e2e-action-flow route exists', async () => {
      await page.goto(`${baseUrl}/e2e-action-flow`, { waitUntil: 'networkidle' });
      const route = await page.locator('[data-e2e-action-flow-route]').count();
      const cards = await page.locator('[data-e2e-flow-card]').count();
      assert(route === 1, 'route missing');
      assert(cards >= requiredFlows.length, `expected flow cards, got ${cards}`);
      return { route, cards };
    });

    await expectStep(rows, 'no direct fetch from UI pages', async () => {
      const findings = scanUiForDirectFetch();
      assert(findings.length === 0, findings.join('; '));
      return { findings: findings.length };
    });

    await expectStep(rows, 'no silent button actions', async () => {
      await page.goto(`${baseUrl}/e2e-action-flow`, { waitUntil: 'networkidle' });
      await page.locator('[data-e2e-run-flow]').first().click();
      await page.waitForLoadState('networkidle');
      const verdict = await page.locator('[data-e2e-final-verdict]').first().textContent();
      assert(verdict && verdict.trim().length > 0, 'run flow did not update visible verdict');
      const silent = await page.evaluate(() => {
        const result = [];
        for (const button of Array.from(document.querySelectorAll('button'))) {
          const propsKey = Object.keys(button).find((key) => key.startsWith('__reactProps$'));
          const reactProps = propsKey ? button[propsKey] : undefined;
          if (!button.disabled && typeof reactProps?.onClick !== 'function' && button.dataset.actionState !== 'read-only') {
            result.push(button.textContent?.trim() || button.getAttribute('aria-label') || 'unlabeled');
          }
        }
        return result;
      });
      assert(silent.length === 0, `silent buttons: ${silent.join(', ')}`);
      return { verdict: verdict.trim(), silentButtons: silent.length };
    });
  } finally {
    await browser.close();
    await stopServer(server);
  }

  writeJson(reportPath, { rows, passed: rows.filter((row) => row.status === 'passed').length, total: rows.length });
  console.log('| E2E action flow smoke | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details ?? ''} |`);
  }
  const failed = rows.filter((row) => row.status === 'failed');
  console.log(`\nE2E action flow smoke summary: ${rows.length - failed.length}/${rows.length} passed. Report: ${path.relative(root, reportPath)}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
