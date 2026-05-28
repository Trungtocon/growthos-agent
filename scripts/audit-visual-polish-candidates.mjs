import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const manifestPath = path.join(root, 'docs/05-ui-ux/screen-manifest.csv');
const reportRoot = path.join(root, 'parity-reports');

function parseArgs() {
  const opts = {
    ids: [],
    out: null,
    skipFresh: false,
    threshold: 100,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--ids=')) {
      opts.ids = arg.slice('--ids='.length).split(',').map((value) => Number(value.trim())).filter(Boolean);
    } else if (arg.startsWith('--out=')) {
      opts.out = arg.slice('--out='.length);
    } else if (arg === '--skip-fresh') {
      opts.skipFresh = true;
    } else if (arg.startsWith('--threshold=')) {
      opts.threshold = Number(arg.slice('--threshold='.length));
    }
  }

  if (opts.ids.length === 0) {
    opts.ids = [25, 17, 26, 8, 21, 30];
  }

  return opts;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        cur += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += char;
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

function runNodeScript(scriptPath, args, env = {}) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.stdout.trim()) process.stdout.write(`${result.stdout.trim()}\n`);
  if (result.stderr.trim()) process.stderr.write(`${result.stderr.trim()}\n`);

  return result.status ?? 1;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function screenLabel(id) {
  return String(id).padStart(2, '0');
}

function chooseTopRegion(regions) {
  return regions.find((region) => region.name !== '01 full page') ?? regions[0] ?? null;
}

function suggestAction(regionName) {
  if (!regionName) return 'Run fresh region audit';
  if (regionName.includes('sidebar') || regionName.includes('topbar')) return 'Recalibrate route-specific AppShell visual details';
  if (regionName.includes('heading')) return 'Rebuild header copy/actions against PNG';
  if (regionName.includes('kpis') || regionName.includes('tabs')) return 'Recalibrate KPI/tab band density and labels';
  if (regionName.includes('left') || regionName.includes('right')) return 'Rebuild dominant content section, not icon-level polish';
  return 'Inspect region diff before changing component internals';
}

function buildMarkdown(results) {
  const lines = [
    '# Visual Polish Candidate Audit',
    '',
    'This report ranks the current low-parity screens by fresh pixel diff and dominant region mismatch. Pixel diff remains a polish metric; this audit is used to choose section-level recalibration work instead of speculative micro-tuning.',
    '',
    '| Rank | Screen | Route | 1:1 | Diff % | Top region | Region diff % | Next action |',
    '|---:|---|---|---:|---:|---|---:|---|',
    ...results.map((result, index) => {
      const oneToOne = (100 - result.diffPercent).toFixed(4);
      const region = result.topRegion;
      return `| ${index + 1} | ${screenLabel(result.id)} ${result.screenName} | \`${result.route}\` | ${oneToOne}% | ${result.diffPercent.toFixed(4)}% | ${region?.name ?? 'n/a'} | ${region ? region.diffPercent.toFixed(4) : 'n/a'} | ${suggestAction(region?.name)} |`;
    }),
    '',
    '## Notes',
    '',
    '- Fresh parity screenshots are generated under `parity-reports/` and should not be committed unless the repo explicitly tracks evidence for the run.',
    '- If a candidate tweak worsens diff, revert it and move to section-level measurement or source-PNG contract recalibration.',
    '- Prioritize the highest full-page diff only when the top failing region aligns with a visible missing or structurally different section.',
    '',
  ];

  return `${lines.join('\n')}\n`;
}

const opts = parseArgs();
const idsArg = `--ids=${opts.ids.join(',')}`;

if (!opts.skipFresh) {
  const parityStatus = runNodeScript('scripts/visual-parity-check.mjs', [idsArg], {
    STRICT_MAX_DIFF_PERCENT: String(opts.threshold),
  });
  if (parityStatus !== 0) {
    console.error('Visual parity capture failed. Candidate audit cannot continue.');
    process.exit(parityStatus);
  }
}

const regionStatus = runNodeScript('scripts/analyze-parity-regions.mjs', [idsArg]);
if (regionStatus !== 0) {
  console.error('Region parity analysis failed. Candidate audit cannot continue.');
  process.exit(regionStatus);
}

const manifestById = new Map(readManifest().map((row) => [Number(row.id), row]));
const summaryPath = path.join(reportRoot, 'summary.json');
const regionSummaryPath = path.join(reportRoot, 'region-summary.json');

if (!fs.existsSync(summaryPath) || !fs.existsSync(regionSummaryPath)) {
  console.error('Missing parity summary artifacts. Run without --skip-fresh first.');
  process.exit(1);
}

const summary = readJson(summaryPath);
const regionSummary = readJson(regionSummaryPath);
const regionsById = new Map(regionSummary.map((item) => [Number(item.id), item]));

const results = summary.results.map((item) => {
  const manifestRow = manifestById.get(Number(item.id));
  const regionReport = regionsById.get(Number(item.id));
  return {
    id: Number(item.id),
    screenName: item.screenName ?? manifestRow?.screen_name ?? 'Unknown screen',
    route: item.route ?? manifestRow?.route ?? '',
    diffPercent: Number(item.diffPercent ?? 0),
    topRegion: chooseTopRegion(regionReport?.regions ?? []),
  };
}).sort((a, b) => b.diffPercent - a.diffPercent);

const markdown = buildMarkdown(results);
process.stdout.write(`\n${markdown}`);

if (opts.out) {
  const outPath = path.resolve(root, opts.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, markdown);
  console.log(`Wrote ${path.relative(root, outPath)}`);
}
