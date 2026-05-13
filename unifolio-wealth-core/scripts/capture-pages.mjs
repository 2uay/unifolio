#!/usr/bin/env node
// Captures a full-page screenshot of every routed Unifolio page in demo mode.
//
// Usage:
//   npm run screenshot               # against https://unifolio.ca (production)
//   UNIFOLIO_URL=http://localhost:5173 npm run screenshot    # against local dev server
//
// Output: docs/page-map/<route>.png + docs/page-map/README.md (index).

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROUTES = [
  { route: '/',             name: 'dashboard',    title: 'Dashboard' },
  { route: '/holdings',     name: 'holdings',     title: 'Holdings' },
  { route: '/accounts',     name: 'accounts',     title: 'Accounts' },
  { route: '/performance',  name: 'performance',  title: 'Performance' },
  { route: '/transactions', name: 'transactions', title: 'Transactions' },
  { route: '/insights',     name: 'insights',     title: 'Insights (ETF X-Ray)' },
  { route: '/import',       name: 'import',       title: 'Import Center' },
  { route: '/tax',          name: 'tax',          title: 'Tax Report' },
  { route: '/learn',        name: 'learn',        title: 'Learn' },
  { route: '/plans',        name: 'plans',        title: 'Plans & Pricing' },
  { route: '/community',    name: 'community',    title: 'Community' },
  { route: '/instructions', name: 'instructions', title: 'Import Instructions' },
  { route: '/privacy',      name: 'privacy',      title: 'Privacy & Data' },
  { route: '/settings',     name: 'settings',     title: 'Settings' },
  { route: '/profile',      name: 'profile',      title: 'Profile' },
];

const BASE = process.env.UNIFOLIO_URL ?? 'https://unifolio.ca';
const OUT  = path.resolve('docs/page-map');

console.log(`Capturing ${ROUTES.length} pages from ${BASE} → ${OUT}/`);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

// Enter demo mode so authenticated pages render
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => {});
// Click "Continue without logging in" if present. Wrap in try in case the
// landing UI changes — pages may still render via signed-in state via storage.
try {
  await page.click('text=/continue without/i', { timeout: 4000 });
  await page.waitForLoadState('networkidle').catch(() => {});
} catch {
  console.log('  (demo mode button not found — continuing)');
}

await fs.mkdir(OUT, { recursive: true });
const results = [];

for (const { route, name, title } of ROUTES) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1200); // theme transition + chart animation settle
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  ✓ ${route.padEnd(18)} → ${name}.png`);
    results.push({ route, name, title, ok: true });
  } catch (err) {
    console.warn(`  ✗ ${route} failed: ${err?.message || err}`);
    results.push({ route, name, title, ok: false });
  }
}

// Write index README
const md = [
  '# Page Map — Visual Reference',
  '',
  `Auto-captured from \`${BASE}\` in demo mode. Re-run with \`npm run screenshot\`.`,
  '',
  '| Route | Page | Screenshot |',
  '|-------|------|------------|',
  ...results.map(r => `| \`${r.route}\` | ${r.title} | ${r.ok ? `![${r.name}](./${r.name}.png)` : '_capture failed_'} |`),
  '',
  '## How to use',
  '',
  'Reference pages by route + section name as defined in [docs/PAGES.md](../PAGES.md). Click any image to view full size.',
].join('\n');

await fs.writeFile(path.join(OUT, 'README.md'), md);
console.log(`\nWrote ${OUT}/README.md`);

await browser.close();
process.exit(results.every(r => r.ok) ? 0 : 1);
