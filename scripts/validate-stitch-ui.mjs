import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve('docs/05-ui-ux/screen-manifest.csv');
const stitchDir = path.resolve('public/stitch_ui');
const csv = fs.readFileSync(manifestPath, 'utf8').trim().split(/\r?\n/);
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

const headers = parseCsvLine(csv[0]);
const expectedIndex = headers.indexOf('expected_png');
const routeIndex = headers.indexOf('route');
const nameIndex = headers.indexOf('screen_name');
const rows = csv.slice(1).map((line) => parseCsvLine(line));
const files = new Set(fs.readdirSync(stitchDir));

let missing = 0;
for (const row of rows) {
  const file = row[expectedIndex];
  const route = row[routeIndex];
  const name = row[nameIndex];
  if (!files.has(file)) {
    missing += 1;
    console.log(`MISSING: ${file} | ${route} | ${name}`);
  }
}

if (missing > 0) {
  console.log(`\n${missing} PNG file(s) missing in public/stitch_ui.`);
  console.log('Copy or rename your generated PNG screens to match docs/05-ui-ux/screen-manifest.csv.');
  process.exitCode = 1;
} else {
  console.log('All 55 PNG files found.');
}
