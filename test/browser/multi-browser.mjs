// Smoke-test the live demo in chromium / firefox / webkit.
import { chromium, firefox, webkit } from 'playwright';
import sharp from 'sharp';

const URL = process.env.URL ?? 'https://plateau-r3f-demo.pages.dev/?city=chiyoda';
const WAIT_MS = +(process.env.WAIT_MS ?? 50000);

const browsers = [
  { name: 'chromium', launcher: chromium, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] },
  { name: 'firefox', launcher: firefox, args: [] },
  { name: 'webkit', launcher: webkit, args: [] },
];

const results = [];
for (const { name, launcher, args } of browsers) {
  console.log(`\n=== ${name} ===`);
  let browser;
  try {
    browser = await launcher.launch({ headless: true, args });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    let glb = 0, arrow = 0, failed = 0;
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    page.on('response', (r) => {
      const u = r.url();
      if (u.endsWith('.glb')) glb++;
      if (u.endsWith('.arrow')) arrow++;
    });
    page.on('requestfailed', () => failed++);
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(WAIT_MS);
    const shot = `/tmp/multi-browser-${name}.png`;
    await page.screenshot({ path: shot });
    const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    let nonBg = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i] + data[i + 1] + data[i + 2] > 60) nonBg++;
    }
    const pct = (nonBg / (info.width * info.height)) * 100;
    const result = {
      browser: name,
      glb,
      arrow,
      failed_requests: failed,
      pageerrors: errors.slice(0, 3),
      nonbg_pct: +pct.toFixed(1),
      screenshot: shot,
    };
    console.log(JSON.stringify(result, null, 2));
    results.push(result);
  } catch (err) {
    console.error(`${name} threw:`, err.message);
    results.push({ browser: name, error: err.message });
  } finally {
    await browser?.close();
  }
}

console.log('\n=== Summary ===');
for (const r of results) {
  const ok = r.error ? '❌' : r.nonbg_pct >= 5 && r.glb > 0 ? '✅' : '⚠️';
  console.log(`${ok} ${r.browser}: glb=${r.glb} arrow=${r.arrow} fails=${r.failed_requests} coverage=${r.nonbg_pct}%`);
}
