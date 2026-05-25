import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const route = '/command-center';
const contractPath = path.join(root, 'docs/11-quality/screen-08-layout-contract.json');
const reportPath = path.join(root, 'parity-reports/08_executive-command-center/bbox-report.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

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
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for dev server at ${url}`));
        } else {
          setTimeout(attempt, 500);
        }
      });
      req.setTimeout(1500, () => {
        req.destroy();
      });
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
  if (!child || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
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

function formatBox(box) {
  if (!box) return 'missing';
  return `${box.x}/${box.y}/${box.width}/${box.height}`;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

const contract = readJson(contractPath);
const expectedRegions = contract.regions;
const serverProcess = await ensureServer();
const browser = await chromium.launch();

let exitCode = 0;
try {
  const page = await browser.newPage({
    viewport: contract.viewport,
    deviceScaleFactor: 1,
  });
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(Number(process.env.BBOX_WAIT_MS || '750'));

  const actualRegions = await page.evaluate(() => {
    const entries = Array.from(document.querySelectorAll('[data-parity-id]')).map((node) => {
      const rect = node.getBoundingClientRect();
      return [
        node.getAttribute('data-parity-id'),
        {
          x: Math.round(rect.x * 10) / 10,
          y: Math.round(rect.y * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
        },
      ];
    });
    return Object.fromEntries(entries);
  });

  const rows = Object.entries(expectedRegions).map(([region, expected]) => {
    const actual = actualRegions[region] ?? null;
    if (!actual) {
      exitCode = 1;
      return {
        region,
        expected,
        actual: null,
        delta: null,
        status: 'missing',
      };
    }

    const delta = {
      dx: round(actual.x - expected.x),
      dy: round(actual.y - expected.y),
      dw: round(actual.width - expected.width),
      dh: round(actual.height - expected.height),
    };
    const tolerance = expected.tolerance ?? 8;
    const passed = Object.values(delta).every((value) => Math.abs(value) <= tolerance);
    if (!passed) exitCode = 1;
    return {
      region,
      expected,
      actual,
      delta,
      tolerance,
      status: passed ? 'passed' : 'failed',
    };
  });

  const missingActualIds = Object.keys(actualRegions).filter((id) => !expectedRegions[id]).sort();
  const report = {
    route,
    url: `${baseUrl}${route}`,
    viewport: contract.viewport,
    contract: path.relative(root, contractPath),
    generatedAt: new Date().toISOString(),
    summary: {
      checked: rows.length,
      passed: rows.filter((row) => row.status === 'passed').length,
      failed: rows.filter((row) => row.status !== 'passed').length,
      extraActualIds: missingActualIds,
    },
    rows,
  };
  writeJson(reportPath, report);

  console.log('| Region | Expected | Actual | dx | dy | dw | dh | Status |');
  console.log('|---|---|---|---:|---:|---:|---:|---|');
  for (const row of rows) {
    const delta = row.delta ?? { dx: '-', dy: '-', dw: '-', dh: '-' };
    console.log(`| ${row.region} | ${formatBox(row.expected)} | ${formatBox(row.actual)} | ${delta.dx} | ${delta.dy} | ${delta.dw} | ${delta.dh} | ${row.status} |`);
  }
  console.log(`\nBBox audit summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, reportPath)}`);
} finally {
  await browser.close();
  await stopServer(serverProcess);
}

process.exit(exitCode);
