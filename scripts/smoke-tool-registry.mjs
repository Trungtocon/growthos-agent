import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/tool-registry-smoke.json');

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
    const { clearToolRegistry } = await import('/src/runtime-store/tool-registry-store.ts');
    const { clearStream } = await import('/src/runtime-store/stream-store.ts');
    clearHermesDiscovery();
    clearToolRegistry();
    clearStream('run-demo-module-3');
  });

  await expectStep(rows, 'discovery creates registry', async () => {
    const result = await page.evaluate(async () => {
      const { refreshHermesDiscovery } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getToolRegistry } = await import('/src/runtime-store/tool-registry-store.ts');
      await refreshHermesDiscovery();
      const registry = getToolRegistry();
      return { tools: registry.tools.length, models: registry.models.length, compatibility: registry.compatibility.length };
    });
    assert(result.tools > 0, 'registry tools missing');
    assert(result.models > 0, 'registry models missing');
    assert(result.compatibility >= result.tools, 'compatibility matrix missing');
    return result;
  });

  await expectStep(rows, 'registry persists in sessionStorage', async () => {
    const result = await page.evaluate(async () => {
      const { getToolRegistry } = await import('/src/runtime-store/tool-registry-store.ts');
      const registry = getToolRegistry();
      return { generatedAt: registry.generatedAt, firstTool: registry.tools[0]?.name };
    });
    assert(Boolean(result.generatedAt), 'registry timestamp missing');
    assert(Boolean(result.firstTool), 'first tool missing');
    return result;
  });

  await expectStep(rows, 'registry survives reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const { getToolRegistry } = await import('/src/runtime-store/tool-registry-store.ts');
      return { tools: getToolRegistry().tools.length };
    });
    assert(result.tools > 0, 'registry missing after reload');
    return result;
  });

  await expectStep(rows, 'tool runtime reads registry', async () => {
    const result = await page.evaluate(async () => {
      const { startStreamingRun, nextStreamTick } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { getToolRegistry } = await import('/src/runtime-store/tool-registry-store.ts');
      const { getToolCallsByRun } = await import('/src/runtime-store/tool-call-store.ts');
      const registry = getToolRegistry();
      await startStreamingRun('ticket-audit-module-3');
      await nextStreamTick('run-demo-module-3');
      await nextStreamTick('run-demo-module-3');
      const calls = getToolCallsByRun('run-demo-module-3');
      return { registryTool: registry.tools[0]?.name, runtimeTool: calls[0]?.toolName, calls: calls.length };
    });
    assert(result.calls > 0, 'runtime tool calls missing');
    assert(result.runtimeTool === result.registryTool, `expected runtime tool ${result.registryTool}, got ${result.runtimeTool}`);
    return result;
  });

  await expectStep(rows, 'compatibility matrix works', async () => {
    const result = await page.evaluate(async () => {
      const { getToolRegistry, getToolCompatibility } = await import('/src/runtime-store/tool-registry-store.ts');
      const registry = getToolRegistry();
      const toolId = registry.tools[0]?.id;
      const modelId = registry.models[0]?.id;
      const compatibility = getToolCompatibility(toolId, modelId);
      return { toolId, modelId, supported: compatibility.supported, reason: compatibility.reason };
    });
    assert(Boolean(result.toolId && result.modelId), 'tool/model ids missing');
    assert(result.supported, `expected compatible default tool/model: ${result.reason}`);
    return result;
  });

  await expectStep(rows, 'selectors expose registry', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      return {
        tools: selectors.selectRegisteredHermesTools().length,
        models: selectors.selectRegisteredHermesModels().length,
        capabilities: selectors.selectRegisteredHermesCapabilities().length,
        matrix: selectors.selectToolCompatibilityMatrix().length,
      };
    });
    assert(result.tools > 0 && result.models > 0 && result.capabilities > 0 && result.matrix > 0, 'selector registry data incomplete');
    return result;
  });

  await expectStep(rows, 'run console renders registry', async () => {
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.getByText('Tool Registry').first().waitFor({ timeout: 10000 });
    await page.getByText('Available Tools').first().waitFor({ timeout: 10000 });
    await page.getByText('Compatible Models').first().waitFor({ timeout: 10000 });
    return { route: '/runs/demo-run' };
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

  console.log('| Tool registry | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nTool registry smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
