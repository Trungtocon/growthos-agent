import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const root = process.cwd();
const manifestPath = path.join(root, 'docs/05-ui-ux/screen-manifest.csv');
const stitchDir = path.join(root, 'public/stitch_ui');
const reportRoot = path.join(root, 'parity-reports');

function parseArgs() {
  const opts = { ids: null, range: 24, step: 2 };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--ids=')) opts.ids = new Set(arg.slice(6).split(',').map((id) => Number(id.trim())).filter(Boolean));
    if (arg.startsWith('--range=')) opts.range = Number(arg.slice(8));
    if (arg.startsWith('--step=')) opts.step = Math.max(1, Number(arg.slice(7)));
  }
  return opts;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
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
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function slug(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function clampRect(rect, width, height) {
  const x = Math.max(0, Math.min(width, Math.round(rect.x)));
  const y = Math.max(0, Math.min(height, Math.round(rect.y)));
  const right = Math.max(x, Math.min(width, Math.round(rect.x + rect.width)));
  const bottom = Math.max(y, Math.min(height, Math.round(rect.y + rect.height)));
  return { x, y, width: right - x, height: bottom - y };
}

function pxRect(width, height, rect) {
  return clampRect({
    x: rect.x * width,
    y: rect.y * height,
    width: rect.width * width,
    height: rect.height * height,
  }, width, height);
}

function regionsFor(row, width, height) {
  const id = Number(row.id);
  if (id <= 7) {
    return [
      { name: 'brand/header', ...pxRect(width, height, { x: 0, y: 0, width: 1, height: 0.11 }) },
      { name: 'stepper', ...pxRect(width, height, { x: 0.08, y: 0.09, width: 0.84, height: 0.12 }) },
      { name: 'title/subtitle', ...pxRect(width, height, { x: 0.12, y: 0.19, width: 0.76, height: 0.11 }) },
      { name: 'content left', ...pxRect(width, height, { x: 0.04, y: 0.30, width: 0.52, height: 0.58 }) },
      { name: 'content right', ...pxRect(width, height, { x: 0.56, y: 0.30, width: 0.40, height: 0.58 }) },
      { name: 'footer/actions', ...pxRect(width, height, { x: 0.20, y: 0.88, width: 0.60, height: 0.12 }) },
    ];
  }

  return [
    { name: 'sidebar', ...pxRect(width, height, { x: 0, y: 0, width: 0.145, height: 1 }) },
    { name: 'topbar', ...pxRect(width, height, { x: 0.145, y: 0, width: 0.855, height: 0.085 }) },
    { name: 'page heading', ...pxRect(width, height, { x: 0.145, y: 0.085, width: 0.855, height: 0.11 }) },
    { name: 'kpis/tabs', ...pxRect(width, height, { x: 0.145, y: 0.195, width: 0.855, height: 0.14 }) },
    { name: 'main left', ...pxRect(width, height, { x: 0.145, y: 0.335, width: 0.43, height: 0.665 }) },
    { name: 'main right', ...pxRect(width, height, { x: 0.575, y: 0.335, width: 0.425, height: 0.665 }) },
  ];
}

function crop(source, rect) {
  const png = new PNG({ width: rect.width, height: rect.height });
  PNG.bitblt(source, png, rect.x, rect.y, rect.width, rect.height, 0, 0);
  return png;
}

function diffPercent(expected, actual) {
  const diff = new PNG({ width: expected.width, height: expected.height });
  const mismatchedPixels = pixelmatch(expected.data, actual.data, diff.data, expected.width, expected.height, {
    threshold: 0.1,
    includeAA: false,
  });
  return (mismatchedPixels / (expected.width * expected.height)) * 100;
}

function bestOffset(expected, actual, rect, range, step) {
  const expectedCrop = crop(expected, rect);
  const baseline = diffPercent(expectedCrop, crop(actual, rect));
  let best = { dx: 0, dy: 0, diffPercent: baseline, improvement: 0 };
  for (let dy = -range; dy <= range; dy += step) {
    for (let dx = -range; dx <= range; dx += step) {
      const shifted = { ...rect, x: rect.x + dx, y: rect.y + dy };
      if (shifted.x < 0 || shifted.y < 0 || shifted.x + shifted.width > actual.width || shifted.y + shifted.height > actual.height) continue;
      const pct = diffPercent(expectedCrop, crop(actual, shifted));
      if (pct < best.diffPercent) best = { dx, dy, diffPercent: pct, improvement: baseline - pct };
    }
  }
  return { baseline, ...best };
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

const opts = parseArgs();
const rows = readManifest().filter((row) => !opts.ids || opts.ids.has(Number(row.id)));
const summary = [];

for (const row of rows) {
  const id = String(row.id).padStart(2, '0');
  const outDir = path.join(reportRoot, `${id}_${slug(row.screen_name)}`);
  const expectedPath = path.join(stitchDir, row.expected_png);
  const actualPath = path.join(outDir, 'actual.png');

  if (!fs.existsSync(expectedPath) || !fs.existsSync(actualPath)) {
    console.error(`Missing PNGs for ${id} ${row.route}. Run parity:check first.`);
    process.exitCode = 1;
    continue;
  }

  const expected = readPng(expectedPath);
  const actual = readPng(actualPath);
  const regions = regionsFor(row, expected.width, expected.height).map((region) => ({
    name: region.name,
    rect: { x: region.x, y: region.y, width: region.width, height: region.height },
    ...bestOffset(expected, actual, region, opts.range, opts.step),
  })).sort((a, b) => b.improvement - a.improvement);

  const result = {
    id: Number(row.id),
    screenName: row.screen_name,
    route: row.route,
    range: opts.range,
    step: opts.step,
    regions,
  };
  writeJson(path.join(outDir, 'offset-report.json'), result);
  summary.push(result);

  console.log(`\n${id} ${row.route}`);
  for (const region of regions.slice(0, 6)) {
    console.log(`${region.name.padEnd(16)} baseline=${region.baseline.toFixed(4)} best=${region.diffPercent.toFixed(4)} dx=${String(region.dx).padStart(3)} dy=${String(region.dy).padStart(3)} improvement=${region.improvement.toFixed(4)}`);
  }
}

writeJson(path.join(reportRoot, 'offset-summary.json'), summary);
