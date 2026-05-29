import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:5173/';

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('plateau') || t.includes('Plateau') || t.includes('shader')) console.log('[browser]', t);
});

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(10000);

// Override the color texture on every patched material to bright red with full alpha.
const forcedRedStats = await page.evaluate(() => {
  const dbg = window.__plateauDebug;
  if (!dbg?.scene) return { found: false };
  let touched = 0;
  dbg.scene.traverse((o) => {
    if (!o.isMesh) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const u = mat?.userData?.plateauUniforms;
    if (!u) return;
    const tex = u.uPlateauColorTex.value;
    if (!tex?.image?.data) return;
    const d = tex.image.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 255;
    }
    tex.needsUpdate = true;
    mat.needsUpdate = true;
    touched++;
  });
  return { touched };
});

await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/plateau-r3f-forced-red.png' });

const probe = await page.evaluate(() => {
  const dbg = window.__plateauDebug;
  if (!dbg?.scene) return { found: false };
  const result = {
    found: true,
    samples: [],
    materialTypes: {},
    geometryAttrs: new Set(),
    patchedCount: 0,
    unpatchedCount: 0,
  };
  let n = 0;
  dbg.scene.traverse((o) => {
    if (!o.isMesh) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const type = mat?.type ?? 'unknown';
    result.materialTypes[type] = (result.materialTypes[type] ?? 0) + 1;
    if (mat?.userData?.plateauPatched) result.patchedCount++;
    else result.unpatchedCount++;
    const attrs = Object.keys(o.geometry?.attributes ?? {});
    for (const a of attrs) result.geometryAttrs.add(a);
    if (n < 3) {
      const u = mat?.userData?.plateauUniforms;
      const tex = u?.uPlateauColorTex?.value;
      let texInfo = null;
      if (tex && tex.image && tex.image.data) {
        const data = tex.image.data;
        let nonZero = 0;
        let nonZeroAlpha = 0;
        for (let i = 0; i < Math.min(data.length, 4000); i += 4) {
          if (data[i] + data[i + 1] + data[i + 2] > 0) nonZero++;
          if (data[i + 3] > 0) nonZeroAlpha++;
        }
        texInfo = {
          w: tex.image.width,
          h: tex.image.height,
          sampled: Math.min(data.length, 4000) / 4,
          nonZeroRGB: nonZero,
          nonZeroAlpha,
          firstRGBA: [data[0], data[1], data[2], data[3]],
        };
      }
      result.samples.push({
        type,
        attrs,
        patched: !!mat?.userData?.plateauPatched,
        opacity: u?.uPlateauOpacity?.value,
        texInfo,
      });
      n++;
    }
  });
  result.geometryAttrs = Array.from(result.geometryAttrs);
  return result;
});

console.log(JSON.stringify(probe, null, 2));
await browser.close();
