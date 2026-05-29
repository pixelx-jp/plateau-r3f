import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:5173/';

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

const consoleLogs = [];
page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => consoleLogs.push(`[pageerror] ${err.stack || err.message}`));

let stylesLoaded = 0;
let glbLoaded = 0;
page.on('response', (res) => {
  const u = res.url();
  if (u.includes('/style/') && u.endsWith('.arrow')) stylesLoaded++;
  if (u.endsWith('.glb')) glbLoaded++;
});

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(10000);

const sceneStats = await page.evaluate(() => {
  const dbg = (window).__plateauDebug;
  const scene = dbg?.scene;
  const cam = dbg?.camera;
  if (!scene) return { found: false };
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let meshCount = 0;
  let triCount = 0;
  scene.traverse((o) => {
    if (o.isMesh) {
      meshCount++;
      const g = o.geometry;
      if (g && g.attributes.position) {
        triCount += (g.index ? g.index.count : g.attributes.position.count) / 3;
        if (!g.boundingBox) g.computeBoundingBox();
        const bb = g.boundingBox;
        const m = o.matrixWorld;
        const pts = [
          [bb.min.x, bb.min.y, bb.min.z],
          [bb.max.x, bb.max.y, bb.max.z],
        ];
        for (const p of pts) {
          // manual mat4 transform
          const e = m.elements;
          const x = e[0]*p[0]+e[4]*p[1]+e[8]*p[2]+e[12];
          const y = e[1]*p[0]+e[5]*p[1]+e[9]*p[2]+e[13];
          const z = e[2]*p[0]+e[6]*p[1]+e[10]*p[2]+e[14];
          box.min[0] = Math.min(box.min[0], x); box.max[0] = Math.max(box.max[0], x);
          box.min[1] = Math.min(box.min[1], y); box.max[1] = Math.max(box.max[1], y);
          box.min[2] = Math.min(box.min[2], z); box.max[2] = Math.max(box.max[2], z);
        }
      }
    }
  });
  return {
    found: true,
    meshCount,
    triCount,
    boxMin: box.min,
    boxMax: box.max,
    camPos: [cam.position.x, cam.position.y, cam.position.z],
    camNear: cam.near,
    camFar: cam.far,
  };
});

const screenshotPath = '/tmp/plateau-r3f-render.png';
await page.screenshot({ path: screenshotPath });
await browser.close();

// Sample the canvas area of the screenshot. Decode PNG via sharp if available,
// otherwise fall back to file size as a crude liveness signal.
let stats;
try {
  const sharp = (await import('sharp')).default;
  const raw = await sharp(screenshotPath).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  let nonBg = 0;
  const total = info.width * info.height;
  const ch = info.channels;
  for (let i = 0; i < data.length; i += ch) {
    if (data[i] + data[i + 1] + data[i + 2] > 60) nonBg++;
  }
  stats = { w: info.width, h: info.height, nonBg, total };
} catch {
  const fs = await import('node:fs');
  stats = { fileSize: fs.statSync(screenshotPath).size };
}

console.log(JSON.stringify({ stylesLoaded, glbLoaded, sceneStats, stats, consoleTail: consoleLogs.slice(-10) }, null, 2));

const ok =
  sceneStats.found &&
  sceneStats.meshCount > 0 &&
  glbLoaded > 0 &&
  stylesLoaded > 0 &&
  (stats.nonBg ?? stats.fileSize ?? 0) > 5000;

if (!ok) {
  console.error('[FAIL] render verification failed');
  process.exit(1);
}
console.log('[OK] render verified');
