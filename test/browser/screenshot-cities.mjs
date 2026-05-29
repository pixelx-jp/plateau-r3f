import { chromium } from 'playwright';
import sharp from 'sharp';

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});

const cities = ['chiyoda', 'minato', 'kamakura'];
for (const city of cities) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`https://plateau-r3f-demo.pages.dev/?city=${city}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(60000);
  const out = `/tmp/live-demo-${city}.png`;
  await page.screenshot({ path: out });
  const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  let nonBg = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] + data[i + 1] + data[i + 2] > 60) nonBg++;
  }
  const pct = ((nonBg / (info.width * info.height)) * 100).toFixed(1);
  console.log(`${city}: ${pct}% coverage → ${out}`);
  await ctx.close();
}
await browser.close();
