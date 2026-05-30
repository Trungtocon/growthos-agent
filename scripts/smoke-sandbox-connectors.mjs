import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const reportPath = path.join(root, 'parity-reports/sandbox-connectors-smoke.json');

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

function startHealthServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,accept');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'online', message: 'sandbox health ok' }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'sandbox-response', status: 'running' }));
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not allocate sandbox health server port'));
        return;
      }
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.on('error', (error) => resolve({ code: 1, stdout, stderr: error.message }));
  });
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
const healthServer = await startHealthServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
const rows = [];

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await expectStep(rows, 'mock mode works without env', async () => {
    const result = await page.evaluate(async () => {
      const { checkRuntimeHealth } = await import('/src/integrations/growthos-runtime/runtime-health.ts');
      return checkRuntimeHealth({ VITE_RUNTIME_MODE: 'mock' });
    });
    assert(result.mode === 'mock', `Expected mock mode, got ${result.mode}`);
    assert(result.hermes.status === 'online', `Expected Hermes online mock, got ${result.hermes.status}`);
    assert(result.paperclip.status === 'online', `Expected Paperclip online mock, got ${result.paperclip.status}`);
    return { mode: result.mode, hermes: result.hermes.status, paperclip: result.paperclip.status };
  });

  await expectStep(rows, 'sandbox missing env falls back safely', async () => {
    const result = await page.evaluate(async () => {
      const { checkRuntimeHealth } = await import('/src/integrations/growthos-runtime/runtime-health.ts');
      return checkRuntimeHealth({ VITE_RUNTIME_MODE: 'sandbox' });
    });
    assert(result.mode === 'mock', `Expected fallback mock mode, got ${result.mode}`);
    assert(result.hermes.status === 'degraded', `Expected Hermes degraded, got ${result.hermes.status}`);
    assert(result.paperclip.status === 'degraded', `Expected Paperclip degraded, got ${result.paperclip.status}`);
    return { mode: result.mode, hermes: result.hermes.message, paperclip: result.paperclip.message };
  });

  await expectStep(rows, 'sandbox health returns normalized status', async () => {
    const result = await page.evaluate(async (url) => {
      const { checkRuntimeHealth } = await import('/src/integrations/growthos-runtime/runtime-health.ts');
      return checkRuntimeHealth({
        VITE_RUNTIME_MODE: 'sandbox',
        VITE_HERMES_BASE_URL: url,
        VITE_HERMES_API_KEY: 'sandbox-key',
        VITE_PAPERCLIP_BASE_URL: url,
        VITE_PAPERCLIP_API_KEY: 'sandbox-key',
      });
    }, healthServer.url);
    assert(result.mode === 'sandbox', `Expected sandbox mode, got ${result.mode}`);
    assert(result.hermes.status === 'online', `Expected Hermes online, got ${result.hermes.status}`);
    assert(result.paperclip.status === 'online', `Expected Paperclip online, got ${result.paperclip.status}`);
    return { mode: result.mode, hermesLatency: result.hermes.latencyMs, paperclipLatency: result.paperclip.latencyMs };
  });

  await expectStep(rows, 'runtime integration smoke still passes', async () => {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
    const args = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm run smoke:runtime-integration']
      : ['run', 'smoke:runtime-integration'];
    const result = await runCommand(command, args);
    assert(result.code === 0, result.stderr || result.stdout || 'runtime integration smoke failed');
    return { command: 'npm run smoke:runtime-integration' };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    sandboxHealthUrl: healthServer.url,
    summary: {
      checked: rows.length,
      passed: rows.filter((row) => row.status === 'passed').length,
      failed: rows.filter((row) => row.status !== 'passed').length,
    },
    rows,
  };
  writeJson(reportPath, report);

  console.log('| Sandbox connector smoke | Status | Details |');
  console.log('|---|---|---|');
  for (const row of rows) {
    const details = row.status === 'passed'
      ? Object.entries(row).filter(([key]) => !['name', 'status'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')
      : row.error;
    console.log(`| ${row.name} | ${row.status} | ${details} |`);
  }
  console.log(`\nSandbox connector smoke summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
} finally {
  await page.close();
  await browser.close();
  healthServer.server.close();
  await stopServer(serverProcess);
}
