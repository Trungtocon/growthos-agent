import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/artifact-registry-smoke.json');

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
  await page.goto(`${baseUrl}/artifacts`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { resetRuntimeState } = await import('/src/runtime-store/runtime-persistence.ts');
    const { clearArtifactRegistry } = await import('/src/runtime/artifact-registry-store.ts');
    resetRuntimeState();
    clearArtifactRegistry();
  });

  await expectStep(rows, 'register artifact', async () => {
    const result = await page.evaluate(async () => {
      const { registerArtifact, selectArtifactById } = await import('/src/runtime/artifact-registry-store.ts');
      const record = registerArtifact({
        id: 'artifact-registry-smoke-report',
        runId: 'run-demo-module-3',
        type: 'report',
        name: 'artifact-registry-smoke-report.md',
        contentSummary: 'Registry smoke report',
        createdAt: '2026-06-01T00:00:00.000Z',
        source: 'mock',
      }, { workspaceId: 'workspace-uikigai-demo' });
      return { record, selected: selectArtifactById(record.id) };
    });
    assert(result.selected?.id === 'artifact-registry-smoke-report', 'registered artifact missing');
    assert(result.record.lifecycle === 'AVAILABLE', 'registered artifact should be available');
    return { artifact: result.record.id };
  });

  await expectStep(rows, 'search artifact', async () => {
    const result = await page.evaluate(async () => {
      const { searchArtifacts } = await import('/src/runtime/artifact-registry-store.ts');
      return searchArtifacts({ query: 'smoke', type: 'REPORT' }).map((record) => record.id);
    });
    assert(result.includes('artifact-registry-smoke-report'), 'search did not find registered report');
    return { matches: result.length };
  });

  await expectStep(rows, 'archive artifact', async () => {
    const result = await page.evaluate(async () => {
      const { archiveArtifact, selectArtifactById } = await import('/src/runtime/artifact-registry-store.ts');
      archiveArtifact('artifact-registry-smoke-report');
      return selectArtifactById('artifact-registry-smoke-report');
    });
    assert(result?.lifecycle === 'ARCHIVED', 'artifact was not archived');
    return { lifecycle: result.lifecycle };
  });

  await expectStep(rows, 'delete artifact', async () => {
    const result = await page.evaluate(async () => {
      const { deleteArtifact, selectArtifactById } = await import('/src/runtime/artifact-registry-store.ts');
      deleteArtifact('artifact-registry-smoke-report');
      return selectArtifactById('artifact-registry-smoke-report');
    });
    assert(result?.lifecycle === 'DELETED', 'artifact was not soft deleted');
    return { lifecycle: result.lifecycle };
  });

  await expectStep(rows, 'versioning', async () => {
    const result = await page.evaluate(async () => {
      const { createVersion, selectArtifactVersions, updateMetadata } = await import('/src/runtime/artifact-registry-store.ts');
      updateMetadata('artifact-registry-smoke-report', { contentSummary: 'Registry smoke report v2' });
      const version = createVersion('artifact-registry-smoke-report', { tags: ['smoke', 'versioned'] });
      return { version, versions: selectArtifactVersions('artifact-registry-smoke-report') };
    });
    assert(result.version.version === 2, 'new artifact version should be v2');
    assert(result.versions.length >= 2, 'artifact version history missing');
    return { versions: result.versions.length };
  });

  await expectStep(rows, 'Hermes integration registers artifacts', async () => {
    const result = await page.evaluate(async () => {
      const { startSandboxRun } = await import('/src/integrations/growthos-runtime/runtime-orchestrator.ts');
      const { selectArtifactsByRun } = await import('/src/runtime/artifact-registry-store.ts');
      await startSandboxRun('ticket-audit-module-3');
      return selectArtifactsByRun('run-demo-module-3').map((record) => ({ id: record.id, type: record.type, source: record.metadata.source }));
    });
    assert(result.some((record) => record.id === 'paperclip-run-demo-module-3-qa-packet'), 'Paperclip QA packet not registered');
    assert(result.some((record) => record.source === 'hermes'), 'Hermes output artifact not registered');
    return { runArtifacts: result.length };
  });

  await expectStep(rows, 'workspace filtering', async () => {
    const result = await page.evaluate(async () => {
      const { selectArtifactsByWorkspace } = await import('/src/runtime/artifact-registry-store.ts');
      return selectArtifactsByWorkspace('workspace-uikigai-demo').length;
    });
    assert(result >= 3, 'workspace filter returned too few artifacts');
    return { workspaceArtifacts: result };
  });

  await expectStep(rows, 'run filtering', async () => {
    const result = await page.evaluate(async () => {
      const { selectArtifactsByRun } = await import('/src/runtime/artifact-registry-store.ts');
      return selectArtifactsByRun('run-demo-module-3').length;
    });
    assert(result >= 3, 'run filter returned too few artifacts');
    return { runArtifacts: result };
  });

  await expectStep(rows, 'exports generated', async () => {
    const result = await page.evaluate(async () => {
      const {
        exportArtifactHealthReportMarkdown,
        exportArtifactRegistryJson,
        exportArtifactSummaryMarkdown,
      } = await import('/src/runtime/artifact-registry-store.ts');
      return {
        json: exportArtifactRegistryJson(),
        summary: exportArtifactSummaryMarkdown(),
        health: exportArtifactHealthReportMarkdown(),
      };
    });
    assert(result.json.includes('artifact-registry-smoke-report'), 'registry json export missing artifact');
    assert(result.summary.includes('Artifact Registry Summary'), 'summary export missing heading');
    assert(result.health.includes('Artifact Health Report'), 'health report missing heading');
    return { exports: 'artifact-registry.json, artifact-summary.md, artifact-health-report.md' };
  });

  await expectStep(rows, 'UI renders registry controls', async () => {
    await page.goto(`${baseUrl}/artifacts?q=paperclip&type=REPORT&sort=name`, { waitUntil: 'networkidle' });
    await page.locator('[data-parity-id="artifacts.header"]').waitFor({ timeout: 10000 });
    await page.locator('[data-artifact-registry-controls]').waitFor({ timeout: 10000 });
    const count = await page.locator('[data-artifact-registry-id]').count();
    assert(count >= 1, 'artifact registry cards did not render');
    return { visibleArtifacts: count };
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

  console.log('| Artifact registry | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nArtifact registry smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  await stopServer(serverProcess);
}
