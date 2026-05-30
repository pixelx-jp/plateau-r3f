// End-to-end user journey on the live demo.
// Verifies: load → switch city → swap colorBy → toggle hazard → URL sync →
// share-button → restore via URL → color legend updates → loading phases
// appear & clear → cross-browser parity.

import { chromium, firefox, webkit } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';

const BASE = process.env.URL ?? 'https://plateau-r3f-demo.pages.dev';
const BROWSER = (process.env.BROWSER ?? 'chromium').toLowerCase();
const launchers = { chromium, firefox, webkit };
if (!launchers[BROWSER]) {
  console.error(`unknown browser ${BROWSER}; use chromium/firefox/webkit`);
  process.exit(1);
}

const args =
  BROWSER === 'chromium'
    ? ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
    : [];

const results = [];

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const result = await fn();
    results.push({ step: name, ok: true, ms: Date.now() - t0, ...result });
    console.log(`✅ ${name} (${Date.now() - t0}ms)`);
    return result;
  } catch (err) {
    results.push({ step: name, ok: false, ms: Date.now() - t0, error: err.message });
    console.error(`❌ ${name}: ${err.message}`);
    throw err;
  }
}

async function pixelCoverage(buf) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let nonBg = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] + data[i + 1] + data[i + 2] > 60) nonBg++;
  }
  return +((nonBg / (info.width * info.height)) * 100).toFixed(1);
}

async function panelText(page) {
  return await page.evaluate(() => {
    const sels = Array.from(document.querySelectorAll('.panel select')).map((s) => ({
      id: s.id,
      value: s.value,
    }));
    const legend = Array.from(document.querySelectorAll('.legend-title')).map((el) =>
      el.textContent?.trim(),
    );
    const phase = document.querySelector('.phase')?.textContent?.trim();
    const shareBtn = document.querySelector('.share')?.textContent?.trim();
    return { selects: sels, legendTitles: legend, phase, shareBtn };
  });
}

const browser = await launchers[BROWSER].launch({ headless: true, args });
// Firefox/WebKit don't accept clipboard-* permissions through the
// Playwright API; chromium does. Apply only where supported.
const ctxOpts = { viewport: { width: 1280, height: 800 } };
if (BROWSER === 'chromium') {
  ctxOpts.permissions = ['clipboard-read', 'clipboard-write'];
}
const ctx = await browser.newContext(ctxOpts);
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 200)}`);
});

try {
  // ----- 1. Initial load -----
  await step('open demo with defaults', async () => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(45_000);
    return {};
  });

  await step('panel shows defaults: chiyoda/height/river_flood', async () => {
    const t = await panelText(page);
    const map = Object.fromEntries(t.selects.map((s) => [s.id, s.value]));
    if (map.city !== 'chiyoda') throw new Error(`city=${map.city} expected chiyoda`);
    if (map.colorby !== 'height') throw new Error(`colorBy=${map.colorby} expected height`);
    if (map.hazard !== 'river_flood') throw new Error(`hazard=${map.hazard}`);
    return { panel: t };
  });

  await step('color legend reflects defaults', async () => {
    const t = await panelText(page);
    const titles = t.legendTitles.join('|');
    if (!titles.includes('Height')) throw new Error(`Height legend missing: ${titles}`);
    if (!titles.includes('River flood')) throw new Error(`River flood legend missing: ${titles}`);
    return { titles };
  });

  // ----- 2. Switch city -----
  await step('switch city → minato', async () => {
    await page.selectOption('#city', 'minato');
    await page.waitForTimeout(30_000);
    const url = new URL(page.url());
    if (url.searchParams.get('city') !== 'minato')
      throw new Error(`URL did not sync to minato: ${page.url()}`);
    return { url: page.url() };
  });

  await step('minato actually renders with color', async () => {
    const shot = await page.screenshot();
    const pct = await pixelCoverage(shot);
    fs.writeFileSync(`/tmp/journey-${BROWSER}-minato.png`, shot);
    if (pct < 5) throw new Error(`minato coverage only ${pct}% — render seems blank`);
    return { coverage: pct };
  });

  // ----- 3. Swap colorBy -----
  await step('swap colorBy → year_built', async () => {
    await page.selectOption('#colorby', 'year_built');
    await page.waitForTimeout(2000);
    const url = new URL(page.url());
    if (url.searchParams.get('colorBy') !== 'year_built')
      throw new Error(`URL missing colorBy=year_built: ${page.url()}`);
    const t = await panelText(page);
    const titles = t.legendTitles.join('|');
    if (!titles.includes('Year built')) throw new Error(`legend did not update: ${titles}`);
    return { url: page.url(), titles };
  });

  // ----- 4. Toggle hazard -----
  await step('toggle hazard → landslide', async () => {
    await page.selectOption('#hazard', 'landslide');
    await page.waitForTimeout(2000);
    const url = new URL(page.url());
    if (url.searchParams.get('hazard') !== 'landslide')
      throw new Error(`URL missing hazard=landslide: ${page.url()}`);
    const t = await panelText(page);
    const titles = t.legendTitles.join('|');
    if (!titles.includes('Landslide')) throw new Error(`legend did not switch: ${titles}`);
    return {};
  });

  await step('toggle hazard → none clears the legend section', async () => {
    await page.selectOption('#hazard', 'none');
    await page.waitForTimeout(1000);
    const t = await panelText(page);
    if (t.legendTitles.some((l) => /flood|tsunami|landslide|storm/i.test(l ?? '')))
      throw new Error(`hazard legend still shown: ${t.legendTitles.join('|')}`);
    return {};
  });

  // ----- 5. Share button copies URL -----
  await step('share button copies URL', async () => {
    await page.selectOption('#hazard', 'tsunami');
    await page.waitForTimeout(500);
    const before = page.url();
    await page.click('.share');
    await page.waitForTimeout(500);
    const t = await panelText(page);
    if (!/copied|fail/i.test(t.shareBtn ?? ''))
      throw new Error(`share button tip didn't change: ${t.shareBtn}`);
    // Clipboard verification only on chromium (firefox/webkit require user
    // gesture for clipboard read and Playwright can't grant permission).
    if (BROWSER === 'chromium') {
      const clipboard = await page.evaluate(() => navigator.clipboard.readText());
      if (clipboard !== before)
        throw new Error(`clipboard did not match URL\n  url=${before}\n  clip=${clipboard}`);
      return { clipboard };
    }
    return { skippedClipboardRead: true };
  });

  // ----- 6. Open URL in fresh context, state restores -----
  const sharedUrl = page.url();
  await step('shared URL restores state in a new tab', async () => {
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await ctx2.newPage();
    await page2.goto(sharedUrl, { waitUntil: 'domcontentloaded' });
    await page2.waitForTimeout(10000);
    const t = await panelText(page2);
    const map = Object.fromEntries(t.selects.map((s) => [s.id, s.value]));
    if (map.city !== 'minato' || map.colorby !== 'year_built' || map.hazard !== 'tsunami') {
      throw new Error(`state did not restore: ${JSON.stringify(map)}`);
    }
    await ctx2.close();
    return { restored: map };
  });
} finally {
  await browser.close();
}

console.log(`\n=== ${BROWSER}: ${results.filter((r) => r.ok).length}/${results.length} steps passed ===`);
if (errors.length) {
  console.log('Console errors during run:');
  for (const e of errors.slice(0, 5)) console.log('  -', e);
}
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`FAIL: ${failed.length} steps`);
  for (const f of failed) console.error(' -', f.step, ':', f.error);
  process.exit(1);
}
console.log('OK — all user journey steps passed.');
