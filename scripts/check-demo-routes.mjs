import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const demoRoutes = [
  ['/command-center', 'Command Center'],
  ['/workforce', 'AI Workforce'],
  ['/org-chart', 'Org Chart'],
  ['/agents/demo-agent', 'Agent Detail'],
  ['/tickets', 'Tickets Board'],
  ['/tickets/demo-ticket', 'Ticket Detail'],
  ['/runs/demo-run', 'Run Console'],
  ['/approvals', 'Approval Center'],
];

const port = 5191;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)],
  { stdio: 'ignore' },
);

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Vite server did not start at ${baseUrl}`);
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const failures = [];

  for (const [route, title] of demoRoutes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    const bodyText = await page.locator('body').innerText();
    const shellCount = await page.locator('aside nav[aria-label="Main navigation"]').count();
    const h1 = await page.locator('h1').first().textContent().catch(() => '');
    const stitchImageCount = await page.locator('img[src^="/stitch_ui/"], img[src*="/stitch_ui/"]').count();
    const scaffoldMarkers = [
      'Implementation Target',
      'Design Reference',
      'Mục tiêu triển khai',
      'Ảnh tham chiếu',
      'Trang scaffold',
    ].filter((marker) => bodyText.includes(marker));

    if (shellCount !== 1 || h1 !== title || scaffoldMarkers.length > 0 || stitchImageCount > 0) {
      failures.push({ route, title, h1, shellCount, scaffoldMarkers, stitchImageCount });
    }
  }

  await browser.close();

  if (failures.length > 0) {
    console.error(JSON.stringify({ failures }, null, 2));
    process.exit(1);
  }

  console.log(`Demo route smoke passed for ${demoRoutes.length} routes.`);
} finally {
  server.kill();
}
