import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...valueParts] = arg.slice(2).split('=');
    args[key] = valueParts.join('=') || 'true';
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const route = args.route;
const contractPath = args.contract ? path.resolve(root, args.contract) : null;
const reportPath = args.out ? path.resolve(root, args.out) : null;

if (!route || !contractPath || !reportPath) {
  console.error('Usage: node scripts/audit-screen-bboxes.mjs --route=/path --contract=docs/...json --out=parity-reports/.../bbox-report.json');
  process.exit(2);
}

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
    const spawnArgs = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm run dev -- --host 127.0.0.1']
      : ['run', 'dev', '--', '--host', '127.0.0.1'];
    const child = spawn(command, spawnArgs, {
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

function stopServer(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.on('error', () => {
        child.kill();
        resolve();
      });
      killer.on('exit', () => resolve());
    });
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
        tolerance: expected.tolerance ?? 8,
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

  const extraActualIds = Object.keys(actualRegions).filter((id) => !expectedRegions[id]).sort();
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
      extraActualIds,
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
