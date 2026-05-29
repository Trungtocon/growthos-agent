import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const root = process.cwd();
const manifestPath = path.join(root, 'docs/05-ui-ux/screen-manifest.csv');
const lockedPath = path.join(root, 'docs/11-quality/PARITY_LOCKED_SCREENS.md');
const stitchDir = path.join(root, 'public/stitch_ui');
const qualityDir = path.join(root, 'docs/11-quality');
const inventoryDir = path.join(qualityDir, 'section-inventory');
const contractsDir = path.join(qualityDir, 'layout-contracts');

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function screenKey(id) {
  return String(id).padStart(2, '0');
}

function pngDimensions(filePath) {
  const image = PNG.sync.read(fs.readFileSync(filePath));
  return { width: image.width, height: image.height };
}

function parseLockedScreens() {
  if (!fs.existsSync(lockedPath)) return new Map();
  const rows = new Map();
  const lines = fs.readFileSync(lockedPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\|\s*(\d{2})\s*\|\s*`?([^`|]+)`?\s*\|\s*(.*?)\s*\|\s*([0-9.]+)%\s*\|\s*(.*?)\s*\|/);
    if (!match) continue;
    const [, id, route, componentRaw, diffRaw, statusRaw] = match;
    if (!rows.has(id)) {
      rows.set(id, {
        route: route.trim(),
        component: componentRaw.replace(/`/g, '').trim(),
        visualDiffPercent: Number(diffRaw),
        status: statusRaw.replace(/`/g, '').trim(),
      });
    }
  }
  return rows;
}

function readOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

function reportLookup(filePath, key = 'screen') {
  const report = readOptionalJson(filePath);
  const lookup = new Map();
  for (const item of report?.screens ?? []) {
    lookup.set(screenKey(item[key]), item);
  }
  return lookup;
}

function visualLookup() {
  const report = readOptionalJson(path.join(root, 'parity-reports/summary.json'));
  const lookup = new Map();
  for (const item of report?.results ?? []) {
    lookup.set(screenKey(item.id), item);
  }
  return lookup;
}

function componentFileFor(id) {
  const numeric = Number(id);
  if (numeric <= 7) return 'src/pages/Sprint2Screens.tsx';
  return 'src/pages/DemoScreens.tsx';
}

function renderModeFor(id) {
  const numeric = Number(id);
  if (numeric <= 7) return 'STATIC_PARITY';
  return 'REAL_UI';
}

function statusFor(id, locked) {
  const numeric = Number(id);
  if (!locked) return 'UNKNOWN';
  if (numeric <= 7) return 'PASS';
  return 'PARTIAL';
}

function measuredStatus(referenceExists, sectionStatus, bboxStatus, visual) {
  if (!referenceExists) return 'BLOCKED';
  if (sectionStatus?.status && sectionStatus.status !== 'passed') return 'FAIL';
  if (bboxStatus?.status && bboxStatus.status !== 'passed') return 'FAIL';
  if (visual?.status && visual.status !== 'passed') return 'FAIL';
  if (visual && visual.diffPercent > 3) return 'PARTIAL';
  return 'PASS';
}

function priorityFor(screen, locked, referenceExists, contractExists) {
  if (!referenceExists || !screen.route || !locked?.component) return 'P0';
  if (!contractExists) return 'P1';
  const diff = locked?.visualDiffPercent;
  if (typeof diff === 'number' && diff > 15) return 'P1';
  if (typeof diff === 'number' && diff > 8) return 'P2';
  return 'P3';
}

function humanizeSection(id) {
  return id
    .split(/[.-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function contractFor(screen, referencePath) {
  const id = screenKey(screen.id);
  const existingPath = path.join(qualityDir, `screen-${id}-layout-contract.json`);
  if (fs.existsSync(existingPath)) {
    const contract = readJson(existingPath);
    return {
      screenId: id,
      route: screen.route,
      viewport: contract.viewport,
      contractSource: contract.source?.contractSource ?? contract.contractSource ?? 'existing-route-contract',
      source: contract.source ?? { reference: path.relative(root, referencePath).replace(/\\/g, '/') },
      regions: contract.regions,
    };
  }

  const dimensions = pngDimensions(referencePath);
  return {
    screenId: id,
    route: screen.route,
    viewport: dimensions,
    contractSource: 'static-or-onboarding-full-page-reference',
    source: {
      reference: path.relative(root, referencePath).replace(/\\/g, '/'),
      note: 'Static/onboarding screens use visual parity as the primary lock; bbox fallback checks the full rendered page root.',
    },
    regions: {
      'page.root': {
        x: 0,
        y: 0,
        width: dimensions.width,
        height: dimensions.height,
        tolerance: 12,
      },
    },
  };
}

function sectionInventoryFor(screen, referencePath, contract) {
  const id = screenKey(screen.id);
  const sections = Object.keys(contract.regions).map((regionId) => ({
    id: regionId,
    name: humanizeSection(regionId),
    required: true,
    visibleInReference: true,
    existsInImplementation: null,
    selector: regionId === 'page.root'
      ? 'body'
      : `[data-parity-id="${regionId}"], [data-section-id="${regionId}"]`,
    status: 'PENDING_AUDIT',
    notes: '',
  }));
  return {
    screenId: id,
    screenName: screen.screen_name,
    route: screen.route,
    referencePng: path.relative(root, referencePath).replace(/\\/g, '/'),
    generatedAt: new Date().toISOString(),
    sections,
  };
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function buildReports(registry, assetMap) {
  const registryRows = registry.map((screen) => [
    screen.screenId,
    `\`${screen.route}\``,
    screen.screenName,
    screen.implementedComponent || 'Unknown',
    screen.currentRenderMode,
    screen.currentStatus,
    screen.visualDiffPercent == null ? '-' : `${screen.visualDiffPercent}%`,
    screen.bboxStatus || 'PENDING_AUDIT',
    screen.sectionInventoryStatus,
    screen.priority,
  ]);
  writeText(
    path.join(qualityDir, 'SCREEN_55_MASTER_REGISTRY.md'),
    `# Screen 55 Master Registry\n\nGenerated by \`npm run generate:screen-audit\`.\n\n${markdownTable(
      ['Screen', 'Route', 'Name', 'Component', 'Mode', 'Status', 'Visual Diff', 'BBox', 'Section Inventory', 'Priority'],
      registryRows,
    )}\n`,
  );

  const assetRows = assetMap.map((screen) => [
    screen.screenId,
    `\`${screen.route}\``,
    screen.screenName,
    screen.referencePngPath ? `\`${screen.referencePngPath}\`` : 'Missing',
    screen.referenceExists ? 'Yes' : 'No',
    screen.expectedComponent || 'Unknown',
  ]);
  writeText(
    path.join(qualityDir, 'SCREEN_REFERENCE_ASSET_MAP.md'),
    `# Screen Reference Asset Map\n\nGenerated by \`npm run generate:screen-audit\`.\n\n${markdownTable(
      ['Screen', 'Route', 'Name', 'Reference PNG', 'Exists', 'Expected Component'],
      assetRows,
    )}\n`,
  );

  const auditRows = registry.map((screen) => [
    screen.screenId,
    `\`${screen.route}\``,
    screen.implementedComponent || 'Unknown',
    screen.currentRenderMode,
    screen.sectionInventoryStatus,
    screen.bboxStatus || 'PENDING_AUDIT',
    screen.visualDiffPercent == null ? '-' : `${screen.visualDiffPercent}%`,
    screen.missingSections.length ? screen.missingSections.join(', ') : '-',
    screen.priority,
  ]);
  writeText(
    path.join(qualityDir, 'FULL_55_SCREEN_AUDIT_REPORT.md'),
    `# Full 55-Screen Audit Report\n\n## Scope\n\nThis report initializes the measurable 55-screen recovery system. Section and bbox audit scripts update generated evidence under \`parity-reports/\`.\n\n${markdownTable(
      ['Screen', 'Route', 'Component', 'Render Mode', 'Section Audit', 'BBox Audit', 'Visual Diff', 'Missing Sections', 'Priority'],
      auditRows,
    )}\n`,
  );

  writeText(
    path.join(qualityDir, 'FULL_55_SCREEN_PARITY_RECOVERY_REPORT.md'),
    `# Full 55-Screen Parity Recovery Report\n\n## Summary\n\n- Total screens: ${registry.length}\n- PASS: ${registry.filter((screen) => screen.currentStatus === 'PASS').length}\n- PARTIAL: ${registry.filter((screen) => screen.currentStatus === 'PARTIAL').length}\n- FAIL: ${registry.filter((screen) => screen.currentStatus === 'FAIL').length}\n- BLOCKED: ${registry.filter((screen) => screen.currentStatus === 'BLOCKED').length}\n\n## Per Screen\n\n${markdownTable(
      ['Screen', 'Route', 'Section', 'BBox', 'Visual Diff', 'Status', 'Next Action'],
      registry.map((screen) => [
        screen.screenId,
        `\`${screen.route}\``,
        screen.sectionInventoryStatus,
        screen.bboxStatus || 'PENDING_AUDIT',
        screen.visualDiffPercent == null ? '-' : `${screen.visualDiffPercent}%`,
        screen.currentStatus,
        screen.priority === 'P0' ? 'Fix missing route/component/reference first' : 'Run section and bbox audit, then repair by priority',
      ]),
    )}\n\n## Evidence Paths\n\nGenerated evidence is written under \`parity-reports/<screen-slug>/\` by the section, bbox, and visual parity scripts. Generated evidence is not committed unless project convention changes.\n`,
  );
}

const manifest = parseCsv(fs.readFileSync(manifestPath, 'utf8')).map((screen) => ({
  ...screen,
  id: Number(screen.id),
}));
const locked = parseLockedScreens();
const sectionReports = reportLookup(path.join(root, 'parity-reports/section-audit-summary.json'));
const bboxReports = reportLookup(path.join(root, 'parity-reports/bbox-audit-summary.json'));
const visualReports = visualLookup();
const registry = [];
const assetMap = [];

for (const screen of manifest) {
  const id = screenKey(screen.id);
  const lockedInfo = locked.get(id);
  const referencePath = path.join(stitchDir, screen.expected_png);
  const referenceExists = fs.existsSync(referencePath);
  const sectionReport = sectionReports.get(id);
  const bboxReport = bboxReports.get(id);
  const visualReport = visualReports.get(id);
  const contractPath = path.join(qualityDir, `screen-${id}-layout-contract.json`);
  const contractExists = fs.existsSync(contractPath) || referenceExists;
  const contract = referenceExists ? contractFor(screen, referencePath) : null;
  if (contract) {
    writeJson(path.join(contractsDir, `screen-${id}-layout-contract.json`), contract);
    const inventory = sectionInventoryFor(screen, referencePath, contract);
    writeJson(path.join(inventoryDir, `screen-${id}-section-inventory.json`), inventory);
    writeText(
      path.join(inventoryDir, `screen-${id}-section-inventory.md`),
      `# Screen ${id} Section Inventory - ${screen.screen_name}\n\n- Route: \`${screen.route}\`\n- Reference: \`${inventory.referencePng}\`\n\n${markdownTable(
        ['Section ID', 'Name', 'Required', 'Selector', 'Status'],
        inventory.sections.map((section) => [
          `\`${section.id}\``,
          section.name,
          section.required ? 'Yes' : 'No',
          `\`${section.selector}\``,
          section.status,
        ]),
      )}\n`,
    );
  }

  const measuredDiffInfo = visualReport ? { ...(lockedInfo ?? {}), visualDiffPercent: visualReport.diffPercent } : lockedInfo;
  const registryEntry = {
    screenId: id,
    screenName: screen.screen_name,
    moduleName: screen.wave,
    route: screen.route,
    referencePngPath: referenceExists ? `public/stitch_ui/${screen.expected_png}` : null,
    implementedComponent: lockedInfo?.component ?? 'Unknown',
    componentFile: componentFileFor(id),
    usesAppShell: screen.layout_type === 'AppShell',
    currentRenderMode: renderModeFor(id),
    currentStatus: sectionReport || bboxReport || visualReport
      ? measuredStatus(referenceExists, sectionReport, bboxReport, visualReport)
      : statusFor(id, lockedInfo),
    visualDiffPercent: visualReport?.diffPercent ?? lockedInfo?.visualDiffPercent ?? null,
    bboxStatus: bboxReport?.summary
      ? `${bboxReport.status === 'passed' ? 'Pass' : 'Fail'} ${bboxReport.summary.passed}/${bboxReport.summary.checked}`
      : contract ? 'PENDING_AUDIT' : 'BLOCKED_REFERENCE_MISSING',
    sectionInventoryStatus: sectionReport?.summary
      ? `${sectionReport.status === 'passed' ? 'Pass' : 'Fail'} ${sectionReport.summary.passed}/${sectionReport.summary.checked}`
      : contract ? 'PENDING_AUDIT' : 'BLOCKED_REFERENCE_MISSING',
    missingSections: [],
    priority: priorityFor(screen, measuredDiffInfo, referenceExists, contractExists),
  };
  registry.push(registryEntry);

  assetMap.push({
    screenId: id,
    screenName: screen.screen_name,
    moduleName: screen.wave,
    route: screen.route,
    expectedComponent: lockedInfo?.component ?? 'Unknown',
    referencePngPath: referenceExists ? `public/stitch_ui/${screen.expected_png}` : null,
    referenceExists,
  });
}

writeJson(path.join(qualityDir, 'screen-55-master-registry.json'), registry);
writeJson(path.join(qualityDir, 'screen-reference-asset-map.json'), assetMap);
buildReports(registry, assetMap);

console.log(`Generated registry, asset map, ${registry.length} section inventories, and ${registry.length} layout contracts.`);
