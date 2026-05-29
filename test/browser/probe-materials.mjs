import { chromium } from 'playwright';
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`${m.type()}: ${m.text().slice(0, 200)}`);
});
page.on('pageerror', (e) => console.log('pageerror:', e.message));
const target = process.env.URL ?? 'https://plateau-r3f-demo.pages.dev/';
await page.goto(target, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(45000);

const info = await page.evaluate(() => {
  const dbg = (window).__plateauDebug;
  if (!dbg?.scene) return { found: false };
  const out = { found: true, materials: {}, samples: [] };
  let i = 0;
  dbg.scene.traverse((o) => {
    if (!o.isMesh) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const t = mat?.type ?? 'unknown';
    out.materials[t] = (out.materials[t] ?? 0) + 1;
    if (i++ < 3) {
      out.samples.push({
        type: t,
        plateauPatched: !!mat?.userData?.plateauPatched,
        plateauUnsupported: !!mat?.userData?.plateauUnsupported,
        attrs: Object.keys(o.geometry?.attributes ?? {}),
        userDataKeys: Object.keys(mat?.userData ?? {}),
      });
    }
  });
  // Try to find a plateauHandle on the scene
  const handles = [];
  dbg.scene.traverse((o) => {
    const h = o.userData?.plateauHandle;
    if (h) handles.push({ uri: h.tile_content_uri, state: h.state, meshCount: h.meshes?.length });
  });
  out.handles = handles.slice(0, 5);
  return out;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
