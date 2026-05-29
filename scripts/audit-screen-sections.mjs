import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const inventoryDir = path.join(root, 'docs/11-quality/section-inventory');
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

function manifestScreens() {
  return parseCsv(fs.readFileSync(manifestPath, 'utf8')).map((screen) => ({
    ...screen,
    id: Number(screen.id),
    key: screenKey(screen.id),
  }));
}

function targetScreens(args) {
  const screens = manifestScreens();
  if (args.all === 'true') return screens;
  if (args.ids) {
    const wanted = new Set(args.ids.split(',').map((id) => screenKey(id.trim())));
    return screens.filter((screen) => wanted.has(screen.key));
  }
  console.error('Usage: npm run audit:sections -- --ids=1,2,3 OR npm run audit:sections -- --all');
  process.exit(2);
}

async function auditScreen(browser, screen) {
  const inventoryPath = path.join(inventoryDir, `screen-${screen.key}-section-inventory.json`);
  if (!fs.existsSync(inventoryPath)) {
    return {
      screen: screen.key,
      route: screen.route,
      status: 'failed',
      error: `Missing inventory ${path.relative(root, inventoryPath)}`,
      rows: [],
    };
  }

  const inventory = readJson(inventoryPath);
  const page = await browser.newPage({
    viewport: { width: 1672, height: 941 },
    deviceScaleFactor: 1,
  });
  await page.goto(`${baseUrl}${inventory.route}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(Number(process.env.SECTION_WAIT_MS || '500'));

  const rows = [];
  for (const section of inventory.sections.filter((item) => item.required)) {
    const selector = section.selector || `[data-section-id="${section.id}"], [data-parity-id="${section.id}"]`;
    const locator = page.locator(selector).first();
    const count = await locator.count();
    let visible = false;
    let box = null;
    if (count > 0) {
      visible = await locator.isVisible().catch(() => false);
      box = await locator.boundingBox().catch(() => null);
    }
    rows.push({
      sectionId: section.id,
      selector,
      exists: count > 0,
      visible,
      box,
      status: count > 0 && visible ? 'passed' : 'missing',
    });
  }
  await page.close();

  const failed = rows.filter((row) => row.status !== 'passed');
  const report = {
    screen: inventory.screenId,
    route: inventory.route,
    referencePng: inventory.referencePng,
    generatedAt: new Date().toISOString(),
    summary: {
      checked: rows.length,
      passed: rows.length - failed.length,
      failed: failed.length,
    },
    rows,
    status: failed.length === 0 ? 'passed' : 'failed',
  };
  const outputDir = path.join(root, 'parity-reports', `${screen.key}_${slugify(screen.screen_name)}`);
  writeJson(path.join(outputDir, 'section-report.json'), report);
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
    const summary = report.summary ?? { passed: 0, checked: 0 };
    console.log(`${report.status === 'passed' ? 'PASS' : 'FAIL'} ${screen.key} ${screen.route}: ${summary.passed}/${summary.checked} sections`);
  }
} finally {
  await browser.close();
  await stopServer(serverProcess);
}

const failed = reports.filter((report) => report.status !== 'passed');
writeJson(path.join(root, 'parity-reports/section-audit-summary.json'), {
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

process.exit(failed.length === 0 ? 0 : 1);
