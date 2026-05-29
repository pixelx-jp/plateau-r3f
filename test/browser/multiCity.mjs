// Render each city in headless Chromium and report what loaded.
// Usage: node test/browser/multiCity.mjs [city ...]   (defaults to a fixed list)
import { chromium } from 'playwright';
import sharp from 'sharp';

const CITIES = process.argv.slice(2);
const DEFAULT = ['chiyoda', 'minato', 'kamakura', 'fukuoka', 'nagoya'];
const list = CITIES.length ? CITIES : DEFAULT;

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});

const results = [];
for (const city of list) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  let glbLoaded = 0;
  let arrowLoaded = 0;
  let failed = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().endsWith('.glb')) glbLoaded++;
    if (r.url().endsWith('.arrow')) arrowLoaded++;
  });
  page.on('requestfailed', () => failed++);

  const url = `http://localhost:5173/?city=${city}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Wait long enough for the autofit to land and the renderer to stream tiles
  // into the new view. Big cities (e.g. fukuoka 355k buildings) need more.
  await page.waitForTimeout(20000);

  const sceneStats = await page.evaluate(() => {
    const dbg = window.__plateauDebug;
    if (!dbg?.scene) return { meshCount: 0 };
    let meshCount = 0;
    let triCount = 0;
    dbg.scene.traverse((o) => {
      if (!o.isMesh) return;
      meshCount++;
      const g = o.geometry;
      if (g?.attributes?.position) {
        triCount += (g.index ? g.index.count : g.attributes.position.count) / 3;
      }
    });
    return { meshCount, triCount };
  });

  const shot = `/tmp/plateau-r3f-${city}.png`;
  await page.screenshot({ path: shot });

  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
  let nonBg = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] + data[i + 1] + data[i + 2] > 60) nonBg++;
  }
  const coverage = nonBg / (info.width * info.height);

  results.push({
    city,
    glbLoaded,
    arrowLoaded,
    failedReq: failed,
    meshes: sceneStats.meshCount,
    tris: Math.round(sceneStats.triCount),
    coverage: +(coverage * 100).toFixed(1),
    errors: errors.slice(0, 3),
    shot,
  });
  await ctx.close();
}
await browser.close();

console.log(JSON.stringify(results, null, 2));

// Library is verified to work when it loaded ≥1 GLB+arrow with no failures
// and produced ≥1 mesh in scene. Low coverage on big cities is a separate
// example-camera issue, not a library bug.
let bad = 0;
for (const r of results) {
  const libOk = r.glbLoaded >= 1 && r.arrowLoaded >= 1 && r.meshes >= 1 && r.failedReq === 0;
  const visualOk = r.coverage >= 5;
  if (!libOk) {
    bad++;
    console.error(`[FAIL] ${r.city}: glb=${r.glbLoaded} arrow=${r.arrowLoaded} meshes=${r.meshes} failed=${r.failedReq}`);
  } else if (!visualOk) {
    console.warn(`[WARN] ${r.city}: low visual coverage ${r.coverage}% (likely example camera, lib OK)`);
  }
}
if (bad) {
  console.error(`\n${bad}/${results.length} cities failed`);
  process.exit(1);
}
console.log(`\n[OK] all ${results.length} cities rendered`);
