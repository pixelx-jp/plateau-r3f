import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);

const selects = await page.locator('.hud select').all();
await selects[1].selectOption('none');
await page.waitForTimeout(2000);

const probe = await page.evaluate(() => {
  const dbg = window.__plateauDebug;
  const samples = [];
  let count = 0;
  dbg.scene.traverse((o) => {
    if (!o.isMesh || count >= 4) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const u = mat?.userData?.plateauUniforms;
    const tex = u?.uPlateauColorTex?.value;
    if (!tex?.image?.data) return;
    const d = tex.image.data;
    const cells = [];
    for (let i = 0; i < Math.min(d.length, 80); i += 4) {
      cells.push([d[i], d[i + 1], d[i + 2], d[i + 3]]);
    }
    samples.push({
      w: tex.image.width,
      h: tex.image.height,
      featureCount: tex.image.width * tex.image.height,
      cells,
    });
    count++;
  });
  const gl = dbg.gl;
  return {
    samples,
    outputColorSpace: gl?.outputColorSpace ?? null,
    toneMapping: gl?.toneMapping ?? null,
  };
});

console.log(JSON.stringify(probe, null, 2));
await browser.close();
