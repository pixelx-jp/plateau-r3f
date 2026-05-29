import { chromium } from 'playwright';
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const errs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning')
    errs.push(`${m.type()}: ${m.text().slice(0, 250)}`);
});
page.on('pageerror', (e) => errs.push(`pageerror: ${e.message.slice(0, 250)}`));

const target = process.env.URL ?? 'https://plateau-r3f-demo.pages.dev/';
await page.goto(target, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(60000);

const info = await page.evaluate(() => {
  const dbg = window.__plateauDebug;
  const out = { meshes: [] };
  if (!dbg?.scene) return out;
  let n = 0;
  dbg.scene.traverse((o) => {
    if (!o.isMesh || n++ >= 5) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const g = o.geometry;
    const handle = o.userData?.plateauHandle;
    let parentHandle = null;
    let p = o.parent;
    while (p && !parentHandle) {
      if (p.userData?.plateauHandle) parentHandle = p.userData.plateauHandle;
      p = p.parent;
    }
    out.meshes.push({
      type: mat?.type,
      plateauPatched: !!mat?.userData?.plateauPatched,
      attrs: g?.attributes ? Object.keys(g.attributes) : [],
      hasFid_lower: !!g?.getAttribute?.('_feature_id_0'),
      hasFid_upper: !!g?.getAttribute?.('_FEATURE_ID_0'),
      hasBatchId: !!g?.getAttribute?.('_BATCHID'),
      hasPlateauFid: !!g?.getAttribute?.('plateauFeatureId'),
      ownHandleState: handle?.state ?? null,
      parentHandleState: parentHandle?.state ?? null,
      parentHandleUri: parentHandle?.tile_content_uri ?? null,
      parentMeshesLen: parentHandle?.meshes?.length ?? null,
      parentMeshesHasFid: parentHandle?.meshes?.map((m) => !!m.featureIdAttribute) ?? null,
    });
  });
  return out;
});

console.log(JSON.stringify(info, null, 2));
console.log('\n=== errors ===');
console.log(errs.slice(0, 5).join('\n'));
await browser.close();
