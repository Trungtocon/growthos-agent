import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const reportPath = path.join(root, 'parity-reports/static-asset-audit.json');

function walk(dir) {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walk(fullPath));
    } else if (/\.(ts|tsx|js|jsx|css)$/.test(entry.name)) {
      entries.push(fullPath);
    }
  }
  return entries;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function isAllowed(match, relativeFile) {
  if (relativeFile === 'src/data/screens.ts' && /\/stitch_ui\/\d{2}_[^'")]+\.png/.test(match)) {
    return true;
  }
  if (relativeFile === 'src/pages/Sprint2Screens.tsx' && /parity_0[1-7]/.test(match)) {
    return true;
  }
  return false;
}

const patterns = [
  { name: 'parity folder', regex: /parity_\d{2}/g },
  { name: 'sliced layout asset', regex: /sidebar\.png|topbar\.png|content\.png/g },
  { name: 'backgroundImage', regex: /backgroundImage/g },
  { name: 'full stitch PNG', regex: /\/stitch_ui\/\d{2}_[^'")]+\.png/g },
];

const findings = [];
for (const filePath of walk(srcDir)) {
  const relativeFile = path.relative(root, filePath).replace(/\\/g, '/');
  const text = fs.readFileSync(filePath, 'utf8');
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.regex)) {
      const value = match[0];
      const allowed = isAllowed(value, relativeFile);
      findings.push({
        file: relativeFile,
        pattern: pattern.name,
        value,
        allowed,
        severity: allowed ? 'allowed-reference' : 'fail',
      });
    }
  }
}

const failed = findings.filter((finding) => !finding.allowed);
const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    findings: findings.length,
    allowed: findings.length - failed.length,
    failed: failed.length,
  },
  findings,
};
writeJson(reportPath, report);

console.log('| File | Pattern | Value | Severity |');
console.log('|---|---|---|---|');
for (const finding of findings) {
  console.log(`| ${finding.file} | ${finding.pattern} | ${finding.value} | ${finding.severity} |`);
}
console.log(`\nStatic asset audit: ${failed.length === 0 ? 'passed' : 'failed'} (${failed.length} failing findings).`);

process.exit(failed.length === 0 ? 0 : 1);
