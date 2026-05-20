import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright';

const root = process.cwd();
const manifestPath = path.join(root, 'docs/05-ui-ux/screen-manifest.csv');
const stitchDir = path.join(root, 'public/stitch_ui');
const reportRoot = path.join(root, 'parity-reports');
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const maxDiffPercent = Number(process.env.STRICT_MAX_DIFF_PERCENT || '1.0');
const waitMs = Number(process.env.PARITY_WAIT_MS || '750');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { ids: null };
  for (const arg of args) {
    if (arg.startsWith('--ids=')) {
      opts.ids = new Set(arg.slice('--ids='.length).split(',').map((v) => Number(v.trim())).filter(Boolean));
    }
  }
  return opts;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function readManifest() {
  const lines = fs.readFileSync(manifestPath, 'utf8').trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

function slug(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

const opts = parseArgs();
const manifest = readManifest().filter((row) => !opts.ids || opts.ids.has(Number(row.id)));
fs.mkdirSync(reportRoot, { recursive: true });

const browser = await chromium.launch();
const results = [];
let failed = false;

for (const row of manifest) {
  const id = String(row.id).padStart(2, '0');
  const refPath = path.join(stitchDir, row.expected_png);
  const outDir = path.join(reportRoot, `${id}_${slug(row.screen_name)}`);
  fs.mkdirSync(outDir, { recursive: true });

  if (!fs.existsSync(refPath)) {
    const result = {
      id: Number(row.id),
      route: row.route,
      expectedPng: row.expected_png,
      status: 'missing_reference_png',
    };
    writeJson(path.join(outDir, 'report.json'), result);
    results.push(result);
    failed = true;
    continue;
  }

  const refPng = readPng(refPath);
  const width = refPng.width;
  const height = refPng.height;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });

  const url = `${baseUrl}${row.route}`;
  let result;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(waitMs);
    const actualPath = path.join(outDir, 'actual.png');
    await page.screenshot({ path: actualPath, fullPage: false });
    const actualPng = readPng(actualPath);

    if (actualPng.width !== width || actualPng.height !== height) {
      result = {
        id: Number(row.id),
        route: row.route,
        expectedPng: row.expected_png,
        status: 'size_mismatch',
        reference: { width, height },
        actual: { width: actualPng.width, height: actualPng.height },
      };
      failed = true;
    } else {
      const diff = new PNG({ width, height });
      const mismatchedPixels = pixelmatch(refPng.data, actualPng.data, diff.data, width, height, {
        threshold: 0.1,
        includeAA: false,
      });
      const totalPixels = width * height;
      const diffPercent = (mismatchedPixels / totalPixels) * 100;
      const diffPath = path.join(outDir, 'diff.png');
      fs.writeFileSync(diffPath, PNG.sync.write(diff));

      result = {
        id: Number(row.id),
        screenName: row.screen_name,
        route: row.route,
        url,
        expectedPng: row.expected_png,
        viewport: { width, height },
        mismatchedPixels,
        totalPixels,
        diffPercent: Number(diffPercent.toFixed(4)),
        thresholdPercent: maxDiffPercent,
        status: diffPercent <= maxDiffPercent ? 'passed' : 'failed',
        artifacts: {
          actual: path.relative(root, actualPath),
          diff: path.relative(root, diffPath),
        },
      };
      if (diffPercent > maxDiffPercent) failed = true;
    }
  } catch (error) {
    result = {
      id: Number(row.id),
      route: row.route,
      expectedPng: row.expected_png,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    failed = true;
  } finally {
    await page.close();
  }

  writeJson(path.join(outDir, 'report.json'), result);
  results.push(result);
  const marker = result.status === 'passed' ? 'PASS' : 'FAIL';
  console.log(`${marker} ${id} ${row.route} ${result.diffPercent ?? ''}% ${result.status}`);
}

await browser.close();

const summary = {
  baseUrl,
  thresholdPercent: maxDiffPercent,
  checked: results.length,
  passed: results.filter((r) => r.status === 'passed').length,
  failed: results.filter((r) => r.status !== 'passed').length,
  results,
};
writeJson(path.join(reportRoot, 'summary.json'), summary);
console.log(`\nVisual parity summary: ${summary.passed}/${summary.checked} passed. Reports: parity-reports/summary.json`);

if (failed) process.exit(1);
