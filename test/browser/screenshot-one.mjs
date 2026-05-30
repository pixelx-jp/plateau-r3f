import { chromium } from 'playwright';
import sharp from 'sharp';
const city = process.argv[2] ?? 'kamakura';
const wait = +(process.argv[3] ?? 60000);
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`https://plateau-r3f-demo.pages.dev/?city=${city}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(wait);
const out = `/tmp/live-demo-${city}.png`;
await page.screenshot({ path: out });
const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
let nonBg = 0;
for (let i = 0; i < data.length; i += info.channels) {
  if (data[i] + data[i + 1] + data[i + 2] > 60) nonBg++;
}
console.log(`${city} (${wait}ms): ${((nonBg / (info.width * info.height)) * 100).toFixed(1)}% → ${out}`);
await browser.close();
