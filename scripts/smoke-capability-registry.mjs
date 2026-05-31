import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/capability-registry-smoke.json');

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
    const { clearCapabilityRegistry } = await import('/src/runtime-store/capability-registry-store.ts');
    clearHermesDiscovery();
    clearToolRegistry();
    clearCapabilityRegistry();
  });

  await expectStep(rows, 'capability build', async () => {
    const result = await page.evaluate(async () => {
      const { refreshHermesDiscovery } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { refreshToolRegistryFromDiscovery } = await import('/src/runtime-store/tool-registry-store.ts');
      const { refreshCapabilityRegistryFromToolRegistry } = await import('/src/runtime-store/capability-registry-store.ts');
      await refreshHermesDiscovery();
      refreshToolRegistryFromDiscovery();
      const registry = refreshCapabilityRegistryFromToolRegistry();
      return { capabilities: registry.capabilities.length, generatedAt: registry.generatedAt };
    });
    assert(result.capabilities > 0, 'capabilities missing');
    assert(Boolean(result.generatedAt), 'capability registry timestamp missing');
    return result;
  });

  await expectStep(rows, 'capability persistence', async () => {
    const result = await page.evaluate(async () => {
      const { getCapabilityRegistry } = await import('/src/runtime-store/capability-registry-store.ts');
      const registry = getCapabilityRegistry();
      return { capabilities: registry.capabilities.length, source: registry.sourceToolRegistryGeneratedAt };
    });
    assert(result.capabilities > 0, 'persisted capabilities missing');
    assert(Boolean(result.source), 'source registry timestamp missing');
    return result;
  });

  await expectStep(rows, 'workflow readiness', async () => {
    const result = await page.evaluate(async () => {
      const { getWorkflowReadiness } = await import('/src/runtime-store/capability-registry-store.ts');
      const readiness = getWorkflowReadiness('demo-run-execution');
      return {
        workflowId: readiness.workflowId,
        ready: readiness.ready,
        required: readiness.requiredCapabilities.length,
        available: readiness.availableCapabilities.length,
        missing: readiness.missingCapabilities.join(','),
      };
    });
    assert(result.workflowId === 'demo-run-execution', 'wrong readiness workflow');
    assert(result.ready, `demo run workflow not ready: ${result.missing}`);
    assert(result.required > 0 && result.available > 0, 'readiness capability lists missing');
    return result;
  });

  await expectStep(rows, 'missing capability detection', async () => {
    const result = await page.evaluate(async () => {
      const { getWorkflowReadinessByRequirement } = await import('/src/runtime-store/capability-registry-store.ts');
      const readiness = getWorkflowReadinessByRequirement({
        workflowId: 'deployment-check',
        requiredCapabilities: ['deployment'],
      });
      return { ready: readiness.ready, missing: readiness.missingCapabilities.join(',') };
    });
    assert(!result.ready, 'deployment workflow should be missing in mock registry');
    assert(result.missing.includes('deployment'), 'deployment missing capability not detected');
    return result;
  });

  await expectStep(rows, 'selectors expose capability registry', async () => {
    const result = await page.evaluate(async () => {
      const selectors = await import('/src/domain/selectors.ts');
      return {
        capabilities: selectors.selectCapabilities().length,
        matrix: selectors.selectWorkflowReadinessMatrix().length,
        missing: selectors.selectMissingCapabilities('deployment-readiness').join(','),
        demoReady: selectors.selectWorkflowReadiness('demo-run-execution').ready,
      };
    });
    assert(result.capabilities > 0, 'capability selector empty');
    assert(result.matrix > 0, 'readiness matrix selector empty');
    assert(result.demoReady, 'demo readiness selector false');
    assert(result.missing.includes('deployment'), 'missing selector did not expose deployment gap');
    return result;
  });

  await expectStep(rows, 'run console renders capabilities', async () => {
    await page.goto(`${baseUrl}/runs/demo-run`, { waitUntil: 'networkidle' });
    await page.getByText('Capabilities').first().waitFor({ timeout: 10000 });
    await page.getByText('Workflow Readiness').first().waitFor({ timeout: 10000 });
    await page.getByText('Missing Capabilities').first().waitFor({ timeout: 10000 });
    await page.getByText('Available Tools').first().waitFor({ timeout: 10000 });
    return { route: '/runs/demo-run' };
  });

  await expectStep(rows, 'capability registry survives reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const { getCapabilityRegistry } = await import('/src/runtime-store/capability-registry-store.ts');
      return { capabilities: getCapabilityRegistry().capabilities.length };
    });
    assert(result.capabilities > 0, 'capabilities missing after reload');
    return result;
  });

  await expectStep(rows, 'tool registry compatibility remains available', async () => {
    const result = await page.evaluate(async () => {
      const { getToolRegistry } = await import('/src/runtime-store/tool-registry-store.ts');
      const { getCapabilityRegistry } = await import('/src/runtime-store/capability-registry-store.ts');
      const toolRegistry = getToolRegistry();
      const capabilityRegistry = getCapabilityRegistry();
      return {
        tools: toolRegistry.tools.length,
        compatibility: toolRegistry.compatibility.length,
        sourceMatches: capabilityRegistry.sourceToolRegistryGeneratedAt === toolRegistry.generatedAt,
      };
    });
    assert(result.tools > 0, 'tool registry tools missing');
    assert(result.compatibility > 0, 'tool compatibility matrix missing');
    assert(result.sourceMatches, 'capability registry source timestamp does not match tool registry');
    return result;
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

  console.log('| Capability registry | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nCapability registry smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
