import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const root = process.cwd();
const manifestPath = path.join(root, 'docs/05-ui-ux/screen-manifest.csv');
const stitchDir = path.join(root, 'public/stitch_ui');
const reportRoot = path.join(root, 'parity-reports');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { ids: null };
  for (const arg of args) {
    if (arg.startsWith('--ids=')) {
      opts.ids = new Set(arg.slice('--ids='.length).split(',').map((value) => Number(value.trim())).filter(Boolean));
    }
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
  return lines.slice(1).filter(Boolean).map((line) => {
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
      { name: '01 shell/background', ...pxRect(width, height, { x: 0, y: 0, width: 1, height: 1 }) },
      { name: '02 brand/header', ...pxRect(width, height, { x: 0, y: 0, width: 1, height: 0.11 }) },
      { name: '03 stepper', ...pxRect(width, height, { x: 0.08, y: 0.09, width: 0.84, height: 0.12 }) },
      { name: '04 title/subtitle', ...pxRect(width, height, { x: 0.12, y: 0.19, width: 0.76, height: 0.11 }) },
      { name: '05 content left', ...pxRect(width, height, { x: 0.04, y: 0.30, width: 0.52, height: 0.58 }) },
      { name: '06 content right', ...pxRect(width, height, { x: 0.56, y: 0.30, width: 0.40, height: 0.58 }) },
      { name: '07 footer/actions', ...pxRect(width, height, { x: 0.20, y: 0.88, width: 0.60, height: 0.12 }) },
    ];
  }

  return [
    { name: '01 full page', ...pxRect(width, height, { x: 0, y: 0, width: 1, height: 1 }) },
    { name: '02 sidebar', ...pxRect(width, height, { x: 0, y: 0, width: 0.145, height: 1 }) },
    { name: '03 topbar', ...pxRect(width, height, { x: 0.145, y: 0, width: 0.855, height: 0.085 }) },
    { name: '04 page heading', ...pxRect(width, height, { x: 0.145, y: 0.085, width: 0.855, height: 0.11 }) },
    { name: '05 kpis/tabs', ...pxRect(width, height, { x: 0.145, y: 0.195, width: 0.855, height: 0.14 }) },
    { name: '06 main left', ...pxRect(width, height, { x: 0.145, y: 0.335, width: 0.43, height: 0.665 }) },
    { name: '07 main right', ...pxRect(width, height, { x: 0.575, y: 0.335, width: 0.425, height: 0.665 }) },
  ];
}

function cropToPng(source, rect) {
  const png = new PNG({ width: rect.width, height: rect.height });
  for (let y = 0; y < rect.height; y += 1) {
    for (let x = 0; x < rect.width; x += 1) {
      const sourceIndex = ((rect.y + y) * source.width + rect.x + x) * 4;
      const targetIndex = (y * rect.width + x) * 4;
      png.data[targetIndex] = source.data[sourceIndex];
      png.data[targetIndex + 1] = source.data[sourceIndex + 1];
      png.data[targetIndex + 2] = source.data[sourceIndex + 2];
      png.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }
  return png;
}

function writePng(filePath, png) {
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function safeRegionName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function writeMarkdown(filePath, result) {
  const lines = [
    `# Region parity: ${String(result.id).padStart(2, '0')} ${result.screenName}`,
    '',
    `Route: \`${result.route}\``,
    `Viewport: \`${result.viewport.width}x${result.viewport.height}\``,
    '',
    '| Rank | Region | Diff % | Mismatched px | Total px | Rect |',
    '|---:|---|---:|---:|---:|---|',
    ...result.regions.map((region, index) => `| ${index + 1} | ${region.name} | ${region.diffPercent.toFixed(4)} | ${region.mismatchedPixels} | ${region.totalPixels} | x=${region.rect.x}, y=${region.rect.y}, w=${region.rect.width}, h=${region.rect.height} |`),
    '',
  ];
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

const opts = parseArgs();
const rows = readManifest().filter((row) => !opts.ids || opts.ids.has(Number(row.id)));
const allResults = [];

for (const row of rows) {
  const id = String(row.id).padStart(2, '0');
  const outDir = path.join(reportRoot, `${id}_${slug(row.screen_name)}`);
  const expectedPath = path.join(stitchDir, row.expected_png);
  const actualPath = path.join(outDir, 'actual.png');

  if (!fs.existsSync(expectedPath) || !fs.existsSync(actualPath)) {
    console.error(`Missing expected or actual PNG for ${id} ${row.route}. Run parity:check first.`);
    process.exitCode = 1;
    continue;
  }

  const expected = readPng(expectedPath);
  const actual = readPng(actualPath);
  if (expected.width !== actual.width || expected.height !== actual.height) {
    console.error(`Size mismatch for ${id} ${row.route}.`);
    process.exitCode = 1;
    continue;
  }

  const regions = regionsFor(row, expected.width, expected.height).map((region) => {
    const expectedCrop = cropToPng(expected, region);
    const actualCrop = cropToPng(actual, region);
    const diff = new PNG({ width: region.width, height: region.height });
    const mismatchedPixels = pixelmatch(expectedCrop.data, actualCrop.data, diff.data, region.width, region.height, {
      threshold: 0.1,
      includeAA: false,
    });
    const totalPixels = region.width * region.height;
    const regionDir = path.join(outDir, 'regions', safeRegionName(region.name));
    fs.mkdirSync(regionDir, { recursive: true });
    writePng(path.join(regionDir, 'expected.png'), expectedCrop);
    writePng(path.join(regionDir, 'actual.png'), actualCrop);
    writePng(path.join(regionDir, 'diff.png'), diff);
    return {
      name: region.name,
      rect: { x: region.x, y: region.y, width: region.width, height: region.height },
      mismatchedPixels,
      totalPixels,
      diffPercent: (mismatchedPixels / totalPixels) * 100,
      artifacts: {
        expected: path.relative(root, path.join(regionDir, 'expected.png')),
        actual: path.relative(root, path.join(regionDir, 'actual.png')),
        diff: path.relative(root, path.join(regionDir, 'diff.png')),
      },
    };
  }).sort((a, b) => b.diffPercent - a.diffPercent);

  const result = {
    id: Number(row.id),
    screenName: row.screen_name,
    route: row.route,
    expectedPng: row.expected_png,
    viewport: { width: expected.width, height: expected.height },
    regions,
  };
  writeJson(path.join(outDir, 'region-report.json'), result);
  writeMarkdown(path.join(outDir, 'region-report.md'), result);
  allResults.push(result);

  console.log(`\n${id} ${row.route}`);
  for (const region of regions.slice(0, 5)) {
    console.log(`${region.diffPercent.toFixed(4).padStart(8)}%  ${region.name}`);
  }
}

writeJson(path.join(reportRoot, 'region-summary.json'), allResults);
