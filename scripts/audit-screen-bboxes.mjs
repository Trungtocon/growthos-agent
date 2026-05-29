import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const manifestPath = path.join(root, 'docs/05-ui-ux/screen-manifest.csv');

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...valueParts] = arg.slice(2).split('=');
    args[key] = valueParts.join('=') || 'true';
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') {
      value += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === ',') {
      row.push(value);
      value = '';
      continue;
    }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = '';
      continue;
    }
    value += char;
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  const [header, ...records] = rows;
  return records.map((record) => Object.fromEntries(header.map((key, index) => [key, record[index] ?? ''])));
}

function screenKey(id) {
  return String(id).padStart(2, '0');
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function manifestScreens() {
  return parseCsv(fs.readFileSync(manifestPath, 'utf8')).map((screen) => ({
    ...screen,
    id: Number(screen.id),
    key: screenKey(screen.id),
  }));
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

function defaultContractPath(screenKeyValue) {
  const preferred = path.join(root, 'docs/11-quality/layout-contracts', `screen-${screenKeyValue}-layout-contract.json`);
  if (fs.existsSync(preferred)) return preferred;
  return path.join(root, 'docs/11-quality', `screen-${screenKeyValue}-layout-contract.json`);
}

function defaultReportPath(screen) {
  return path.join(root, 'parity-reports', `${screen.key}_${slugify(screen.screen_name)}`, 'bbox-report.json');
}

function targetScreens(args) {
  const screens = manifestScreens();
  if (args.route && args.contract && args.out) {
    const screen = screens.find((item) => item.route === args.route || item.key === screenKey(args.screen ?? '0')) ?? {
      key: screenKey(args.screen ?? '00'),
      screen_name: args.route.replace(/^\//, '').replace(/\//g, '-'),
      route: args.route,
    };
    return [{
      ...screen,
      contractPath: path.resolve(root, args.contract),
      reportPath: path.resolve(root, args.out),
    }];
  }
  if (args.all === 'true') {
    return screens.map((screen) => ({
      ...screen,
      contractPath: defaultContractPath(screen.key),
      reportPath: defaultReportPath(screen),
    }));
  }
  if (args.ids) {
    const wanted = new Set(args.ids.split(',').map((id) => screenKey(id.trim())));
    return screens
      .filter((screen) => wanted.has(screen.key))
      .map((screen) => ({
        ...screen,
        contractPath: defaultContractPath(screen.key),
        reportPath: defaultReportPath(screen),
      }));
  }
  console.error('Usage: node scripts/audit-screen-bboxes.mjs --route=/path --contract=docs/...json --out=parity-reports/.../bbox-report.json');
  console.error('   or: node scripts/audit-screen-bboxes.mjs --ids=8,20,21');
  console.error('   or: node scripts/audit-screen-bboxes.mjs --all');
  process.exit(2);
}

async function auditScreen(browser, screen) {
  if (!fs.existsSync(screen.contractPath)) {
    return {
      screen: screen.key,
      route: screen.route,
      contract: path.relative(root, screen.contractPath),
      status: 'failed',
      error: 'Missing layout contract',
      summary: { checked: 0, passed: 0, failed: 1 },
      rows: [],
    };
  }

  const contract = readJson(screen.contractPath);
  const expectedRegions = contract.regions;
  const page = await browser.newPage({
    viewport: contract.viewport,
    deviceScaleFactor: 1,
  });
  await page.goto(`${baseUrl}${screen.route}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(Number(process.env.BBOX_WAIT_MS || '750'));

  const actualRegions = await page.evaluate(() => {
    const entries = [];
    const rootRect = document.documentElement.getBoundingClientRect();
    entries.push([
      'page.root',
      {
        x: Math.round(rootRect.x * 10) / 10,
        y: Math.round(rootRect.y * 10) / 10,
        width: Math.round(rootRect.width * 10) / 10,
        height: Math.round(rootRect.height * 10) / 10,
      },
    ]);

    const nodes = Array.from(document.querySelectorAll('[data-parity-id], [data-section-id]'));
    for (const node of nodes) {
      const id = node.getAttribute('data-parity-id') || node.getAttribute('data-section-id');
      if (!id) continue;
      const rect = node.getBoundingClientRect();
      entries.push([
        id,
        {
          x: Math.round(rect.x * 10) / 10,
          y: Math.round(rect.y * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
        },
      ]);
    }
    return Object.fromEntries(entries);
  });

  const rows = Object.entries(expectedRegions).map(([region, expected]) => {
    const actual = actualRegions[region] ?? null;
    if (!actual) {
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
    screen: screen.key,
    route: screen.route,
    url: `${baseUrl}${screen.route}`,
    viewport: contract.viewport,
    contract: path.relative(root, screen.contractPath),
    generatedAt: new Date().toISOString(),
    summary: {
      checked: rows.length,
      passed: rows.filter((row) => row.status === 'passed').length,
      failed: rows.filter((row) => row.status !== 'passed').length,
      extraActualIds,
    },
    rows,
  };
  report.status = report.summary.failed === 0 ? 'passed' : 'failed';
  writeJson(screen.reportPath, report);
  await page.close();
  return report;
}

const args = parseArgs(process.argv.slice(2));
const targets = targetScreens(args);
const serverProcess = await ensureServer();
const browser = await chromium.launch();
const reports = [];

try {
  for (const screen of targets) {
    const report = await auditScreen(browser, screen);
    reports.push(report);

    if (targets.length === 1) {
      console.log('| Region | Expected | Actual | dx | dy | dw | dh | Status |');
      console.log('|---|---|---|---:|---:|---:|---:|---|');
      for (const row of report.rows) {
        const delta = row.delta ?? { dx: '-', dy: '-', dw: '-', dh: '-' };
        console.log(`| ${row.region} | ${formatBox(row.expected)} | ${formatBox(row.actual)} | ${delta.dx} | ${delta.dy} | ${delta.dw} | ${delta.dh} | ${row.status} |`);
      }
    }

    console.log(`${report.status === 'passed' ? 'PASS' : 'FAIL'} ${screen.key} ${screen.route}: ${report.summary.passed}/${report.summary.checked} regions`);
  }
} finally {
  await browser.close();
  await stopServer(serverProcess);
}

const failed = reports.filter((report) => report.status !== 'passed');
writeJson(path.join(root, 'parity-reports/bbox-audit-summary.json'), {
  generatedAt: new Date().toISOString(),
  checked: reports.length,
  passed: reports.length - failed.length,
  failed: failed.length,
  screens: reports.map((report) => ({
    screen: report.screen,
    route: report.route,
    status: report.status,
    summary: report.summary,
    error: report.error,
  })),
});

if (targets.length === 1) {
  const report = reports[0];
  console.log(`\nBBox audit summary: ${report.summary.passed}/${report.summary.checked} passed. Report: ${path.relative(root, targets[0].reportPath)}`);
}

process.exit(failed.length === 0 ? 0 : 1);
