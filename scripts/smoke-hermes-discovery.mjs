import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/hermes-discovery-smoke.json');

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
  await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { clearHermesDiscovery } = await import('/src/runtime-store/hermes-discovery-store.ts');
    clearHermesDiscovery();
    window.sessionStorage.removeItem('uikigai-demo-ui-state');
  });

  await expectStep(rows, 'mock mode discovery returns online result', async () => {
    const result = await page.evaluate(async () => {
      const { discoverHermes } = await import('/src/integrations/hermes/hermes-discovery-client.ts');
      return discoverHermes({ VITE_RUNTIME_MODE: 'mock' });
    });
    assert(result.status === 'online', `expected online, got ${result.status}`);
    assert(result.mode === 'mock', `expected mock mode, got ${result.mode}`);
    assert(result.models.length > 0, 'mock models missing');
    assert(result.tools.length > 0, 'mock tools missing');
    return { discoveryStatus: result.status, models: result.models.length, tools: result.tools.length };
  });

  await expectStep(rows, 'sandbox missing env returns missing_config safely', async () => {
    const result = await page.evaluate(async () => {
      const { discoverHermes } = await import('/src/integrations/hermes/hermes-discovery-client.ts');
      return discoverHermes({ VITE_RUNTIME_MODE: 'sandbox' });
    });
    assert(result.status === 'missing_config', `expected missing_config, got ${result.status}`);
    assert(result.warnings.length > 0, 'missing config warning absent');
    return { discoveryStatus: result.status, warnings: result.warnings.length };
  });

  await expectStep(rows, 'discovery result persists in sessionStorage', async () => {
    const result = await page.evaluate(async () => {
      const { discoverHermes } = await import('/src/integrations/hermes/hermes-discovery-client.ts');
      const { setHermesDiscovery, getHermesDiscovery } = await import('/src/runtime-store/hermes-discovery-store.ts');
      const discovery = await discoverHermes({ VITE_RUNTIME_MODE: 'mock' });
      setHermesDiscovery(discovery);
      return getHermesDiscovery();
    });
    assert(result.status === 'online', `expected persisted online, got ${result.status}`);
    return { discoveryStatus: result.status, checkedAt: result.checkedAt };
  });

  await expectStep(rows, 'selectors expose models tools and capabilities', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      return {
        discoveryStatus: selectors.selectHermesStatus(),
        models: selectors.selectHermesModels().length,
        tools: selectors.selectHermesTools().length,
        capabilities: selectors.selectHermesCapabilities().length,
      };
    });
    assert(result.discoveryStatus === 'online', `expected selector online, got ${result.discoveryStatus}`);
    assert(result.models > 0 && result.tools > 0 && result.capabilities > 0, 'selector discovery lists missing');
    return result;
  });

  await expectStep(rows, 'runtime readiness allows mock run', async () => {
    const readiness = await page.evaluate(async () => {
      const { selectRuntimeReadiness } = await import('/src/domain/selectors.ts');
      return selectRuntimeReadiness();
    });
    assert(readiness.canStartMockRun, 'mock run readiness false');
    return { mode: readiness.mode, canStartMockRun: readiness.canStartMockRun, canStartRealRun: readiness.canStartRealRun };
  });

  await expectStep(rows, 'run console renders discovery summary and refresh action', async () => {
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.locator('[data-runtime-discovery-refresh]').click();
    await page.getByText('SearchKnowledgeBase').first().waitFor({ timeout: 10000 });
    await page.getByText('online').first().waitFor({ timeout: 10000 });
    return { route: '/runs/demo-run' };
  });

  await expectStep(rows, 'no direct UI import from Hermes client', async () => {
    const files = [
      path.join(root, 'src/pages/DemoScreens.tsx'),
      path.join(root, 'src/pages/Sprint2Screens.tsx'),
      path.join(root, 'src/components/artifacts/ArtifactViewer.tsx'),
    ];
    const offenders = files.filter((file) => fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('hermes-client'));
    assert(offenders.length === 0, `direct Hermes client import found in ${offenders.join(', ')}`);
    return { checked: files.length };
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

  console.log('| Hermes discovery | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nHermes discovery smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
