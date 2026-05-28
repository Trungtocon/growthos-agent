import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const root = process.cwd();
const reportDir = path.join(root, 'parity-reports/17_projects-list');
const referencePath = path.join(root, 'public/stitch_ui/17_Projects_List.png');
const actualPath = path.join(reportDir, 'actual.png');

function parseArgs() {
  const opts = { out: null, skipFresh: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--skip-fresh') opts.skipFresh = true;
    if (arg.startsWith('--out=')) opts.out = arg.slice('--out='.length);
  }
  return opts;
}

function runFreshParity() {
  const result = spawnSync(process.execPath, ['scripts/visual-parity-check.mjs', '--ids=17'], {
    cwd: root,
    env: { ...process.env, STRICT_MAX_DIFF_PERCENT: '25.0' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.stdout.trim()) process.stdout.write(`${result.stdout.trim()}\n`);
  if (result.stderr.trim()) process.stderr.write(`${result.stderr.trim()}\n`);
  return result.status ?? 1;
}

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function crop(source, rect) {
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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function safeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const subregions = [
  { name: '01 topbar company/search', x: 218, y: 0, width: 700, height: 72 },
  { name: '02 topbar cost/create/user', x: 918, y: 0, width: 754, height: 72 },
  { name: '03 sidebar nav', x: 0, y: 72, width: 218, height: 660 },
  { name: '04 sidebar bottom plan', x: 0, y: 732, width: 218, height: 209 },
  { name: '05 page header title/actions', x: 240, y: 90, width: 1410, height: 68 },
  { name: '06 kpi band', x: 240, y: 160, width: 1410, height: 88 },
  { name: '07 filters and view controls', x: 240, y: 256, width: 1114, height: 36 },
  { name: '08 project board all columns', x: 240, y: 304, width: 1114, height: 392 },
  { name: '09 board active column', x: 240, y: 304, width: 216, height: 392 },
  { name: '10 board at risk column', x: 464, y: 304, width: 216, height: 392 },
  { name: '11 board blocked column', x: 688, y: 304, width: 216, height: 392 },
  { name: '12 board completed column', x: 912, y: 304, width: 216, height: 392 },
  { name: '13 board archived column', x: 1136, y: 304, width: 218, height: 392 },
  { name: '14 side panel ai suggestions', x: 1370, y: 256, width: 280, height: 672 },
  { name: '15 health overview', x: 240, y: 708, width: 1114, height: 220 },
  { name: '16 health chart left', x: 264, y: 756, width: 520, height: 148 },
  { name: '17 health metrics right', x: 804, y: 756, width: 526, height: 148 },
];

const opts = parseArgs();
if (!opts.skipFresh) {
  const status = runFreshParity();
  if (status !== 0) process.exit(status);
}

if (!fs.existsSync(referencePath) || !fs.existsSync(actualPath)) {
  console.error('Missing Screen 17 reference or actual screenshot. Run without --skip-fresh first.');
  process.exit(1);
}

const reference = readPng(referencePath);
const actual = readPng(actualPath);

const results = subregions.map((region) => {
  const expectedCrop = crop(reference, region);
  const actualCrop = crop(actual, region);
  const diff = new PNG({ width: region.width, height: region.height });
  const mismatchedPixels = pixelmatch(expectedCrop.data, actualCrop.data, diff.data, region.width, region.height, {
    threshold: 0.1,
    includeAA: false,
  });
  const totalPixels = region.width * region.height;
  const dir = path.join(reportDir, 'subregions', safeName(region.name));
  writePng(path.join(dir, 'expected.png'), expectedCrop);
  writePng(path.join(dir, 'actual.png'), actualCrop);
  writePng(path.join(dir, 'diff.png'), diff);
  return {
    name: region.name,
    rect: { x: region.x, y: region.y, width: region.width, height: region.height },
    mismatchedPixels,
    totalPixels,
    diffPercent: Number(((mismatchedPixels / totalPixels) * 100).toFixed(4)),
    artifacts: {
      expected: path.relative(root, path.join(dir, 'expected.png')),
      actual: path.relative(root, path.join(dir, 'actual.png')),
      diff: path.relative(root, path.join(dir, 'diff.png')),
    },
  };
}).sort((a, b) => b.diffPercent - a.diffPercent);

const report = {
  screen: 17,
  route: '/projects',
  reference: 'public/stitch_ui/17_Projects_List.png',
  viewport: { width: reference.width, height: reference.height },
  regions: results,
};

fs.writeFileSync(path.join(reportDir, 'subregion-report.json'), `${JSON.stringify(report, null, 2)}\n`);

const markdown = [
  '# Screen 17 Subregion Audit',
  '',
  'This report breaks `/projects` into source-PNG-aligned subregions so visual polish can target dominant sections instead of speculative component tweaks.',
  '',
  '| Rank | Subregion | Diff % | Rect | Next action |',
  '|---:|---|---:|---|---|',
  ...results.map((region, index) => {
    const nextAction = region.name.includes('board')
      ? 'Rebuild board column/card subregion only'
      : region.name.includes('health')
        ? 'Rebuild health overview subregion only'
        : region.name.includes('side panel')
          ? 'Rebuild AI suggestions side panel only'
          : region.name.includes('topbar') || region.name.includes('sidebar')
            ? 'Recalibrate route-specific AppShell subregion only'
            : 'Inspect crop before changing UI';
    return `| ${index + 1} | ${region.name} | ${region.diffPercent.toFixed(4)} | x=${region.rect.x}, y=${region.rect.y}, w=${region.rect.width}, h=${region.rect.height} | ${nextAction} |`;
  }),
  '',
];

const markdownText = `${markdown.join('\n')}\n`;
fs.writeFileSync(path.join(reportDir, 'subregion-report.md'), markdownText);
process.stdout.write(markdownText);

if (opts.out) {
  const outPath = path.resolve(root, opts.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, markdownText);
  console.log(`Wrote ${path.relative(root, outPath)}`);
}
