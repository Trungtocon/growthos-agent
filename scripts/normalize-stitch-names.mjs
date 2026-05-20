import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'docs/05-ui-ux/screen-manifest.csv');
const stitchDir = path.join(root, 'public/stitch_ui');

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

if (!fs.existsSync(stitchDir)) {
  console.error(`Missing directory: ${stitchDir}`);
  process.exit(1);
}

const manifest = readManifest();
const files = fs.readdirSync(stitchDir).filter((f) => /\.png$/i.test(f));
let renamed = 0;
const messages = [];

for (const row of manifest) {
  const id = String(row.id).padStart(2, '0');
  const expected = row.expected_png;
  const expectedPath = path.join(stitchDir, expected);
  if (files.includes(expected)) continue;

  const candidates = files.filter((file) => {
    const normalized = file.toLowerCase();
    return normalized.startsWith(`${id}_`.toLowerCase()) || normalized.startsWith(`${Number(row.id)}_`.toLowerCase());
  });

  if (candidates.length === 1) {
    const current = candidates[0];
    const currentPath = path.join(stitchDir, current);
    if (current.toLowerCase() === expected.toLowerCase() && current !== expected) {
      const tempPath = path.join(stitchDir, `.__rename_${Date.now()}_${current}`);
      fs.renameSync(currentPath, tempPath);
      fs.renameSync(tempPath, expectedPath);
    } else {
      fs.renameSync(currentPath, expectedPath);
    }
    const idx = files.indexOf(current);
    if (idx >= 0) files[idx] = expected;
    renamed++;
    messages.push(`renamed: ${current} -> ${expected}`);
  } else if (candidates.length > 1) {
    messages.push(`ambiguous ${id}: ${candidates.join(', ')}; expected ${expected}`);
  } else {
    messages.push(`missing ${id}: expected ${expected}`);
  }
}

for (const message of messages) console.log(message);
console.log(`\nNormalize complete. Renamed ${renamed} file(s).`);
