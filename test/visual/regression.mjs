// Visual regression harness.
//   node test/visual/regression.mjs                 # check against baseline
//   node test/visual/regression.mjs --update        # write baseline
//
// Uses the running vite-basic dev server (assumed at http://localhost:5173).
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.URL ?? 'http://localhost:5173/';
const UPDATE = process.argv.includes('--update');
const BASELINE_DIR = path.resolve(import.meta.dirname, 'baseline');
const DIFF_DIR = path.resolve(import.meta.dirname, 'diff');
fs.mkdirSync(BASELINE_DIR, { recursive: true });
fs.mkdirSync(DIFF_DIR, { recursive: true });

// Tolerance: percentage of pixels allowed to differ above per-pixel threshold.
const PIXEL_THRESHOLD = 30; // max channel abs diff
const PIXEL_TOLERANCE_PCT = 5.0; // up to 5% of pixels may exceed threshold

const SHOTS = [
  { name: 'chiyoda-height-flood', city: 'chiyoda', colorBy: 'height', hazard: 'river_flood' },
  { name: 'chiyoda-height-none', city: 'chiyoda', colorBy: 'height', hazard: 'none' },
  { name: 'chiyoda-yearbuilt-none', city: 'chiyoda', colorBy: 'year_built', hazard: 'none' },
];

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});

let failures = 0;
const results = [];

for (const shot of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(`${URL}?city=${shot.city}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  const selects = await page.locator('.hud select').all();
  if (selects.length >= 2) {
    await selects[0].selectOption(shot.colorBy);
    await selects[1].selectOption(shot.hazard);
    await page.waitForTimeout(2500);
  }

  const currentPath = path.join(DIFF_DIR, `${shot.name}.current.png`);
  await page.screenshot({ path: currentPath });
  await ctx.close();

  const baselinePath = path.join(BASELINE_DIR, `${shot.name}.png`);
  if (UPDATE || !fs.existsSync(baselinePath)) {
    fs.copyFileSync(currentPath, baselinePath);
    results.push({ name: shot.name, status: 'baseline-written' });
    continue;
  }

  // Diff
  const cur = await sharp(currentPath).raw().toBuffer({ resolveWithObject: true });
  const base = await sharp(baselinePath).raw().toBuffer({ resolveWithObject: true });
  if (cur.info.width !== base.info.width || cur.info.height !== base.info.height) {
    results.push({ name: shot.name, status: 'size-mismatch' });
    failures++;
    continue;
  }
  const total = cur.info.width * cur.info.height;
  const ch = cur.info.channels;
  let bad = 0;
  const diff = Buffer.alloc(cur.data.length);
  for (let i = 0; i < cur.data.length; i += ch) {
    const dr = Math.abs(cur.data[i] - base.data[i]);
    const dg = Math.abs(cur.data[i + 1] - base.data[i + 1]);
    const db = Math.abs(cur.data[i + 2] - base.data[i + 2]);
    const isDiff = Math.max(dr, dg, db) > PIXEL_THRESHOLD;
    if (isDiff) {
      bad++;
      diff[i] = 255;
      diff[i + 1] = 0;
      diff[i + 2] = 0;
    } else {
      diff[i] = Math.round(cur.data[i] * 0.4);
      diff[i + 1] = Math.round(cur.data[i + 1] * 0.4);
      diff[i + 2] = Math.round(cur.data[i + 2] * 0.4);
    }
    if (ch === 4) diff[i + 3] = 255;
  }
  const pct = (bad / total) * 100;
  const passed = pct <= PIXEL_TOLERANCE_PCT;
  if (!passed) {
    failures++;
    await sharp(diff, { raw: cur.info }).png().toFile(path.join(DIFF_DIR, `${shot.name}.diff.png`));
  }
  results.push({ name: shot.name, status: passed ? 'pass' : 'fail', pct: +pct.toFixed(2) });
}

await browser.close();

console.log(JSON.stringify(results, null, 2));
if (failures) {
  console.error(`\n[FAIL] ${failures} of ${SHOTS.length} regressions detected. Diff images in ${DIFF_DIR}.`);
  process.exit(1);
}
console.log(`\n[OK] ${SHOTS.length}/${SHOTS.length} shots within tolerance (${PIXEL_TOLERANCE_PCT}%)`);
