import { chromium } from 'playwright';
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto('https://plateau-r3f-demo.pages.dev/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(20000);

const state = await page.evaluate(() => {
  const dbg = (window).__plateauDebug;
  if (!dbg?.scene) return { found: false };
  let meshCount = 0;
  let patchedCount = 0;
  let unpatchedCount = 0;
  let withFidAttr = 0;
  const sampleAttrs = [];
  dbg.scene.traverse((o) => {
    if (!o.isMesh) return;
    meshCount++;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (mat?.userData?.plateauPatched) patchedCount++;
    else unpatchedCount++;
    const attrs = Object.keys(o.geometry?.attributes ?? {});
    if (attrs.some((a) => /feature_id|FEATURE_ID|BATCH/i.test(a))) withFidAttr++;
    if (sampleAttrs.length < 3) sampleAttrs.push(attrs);
  });
  return { found: true, meshCount, patchedCount, unpatchedCount, withFidAttr, sampleAttrs };
});

console.log(JSON.stringify(state, null, 2));
console.log('\n=== logs (last 8) ===');
console.log(logs.slice(-8).join('\n'));
await browser.close();
