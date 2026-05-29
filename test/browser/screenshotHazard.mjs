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
await selects[0].selectOption('height');
await selects[1].selectOption('river_flood');
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/plateau-r3f-height-flood.png' });

await selects[1].selectOption('tsunami');
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/plateau-r3f-height-tsunami.png' });

await selects[1].selectOption('landslide');
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/plateau-r3f-height-landslide.png' });

await browser.close();
console.log('ok');
