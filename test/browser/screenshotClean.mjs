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
console.log('selects', selects.length);
if (selects.length >= 2) {
  await selects[1].selectOption('none');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/plateau-r3f-year_built.png' });

  await selects[0].selectOption('structure');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/plateau-r3f-structure.png' });

  await selects[0].selectOption('height');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/plateau-r3f-height.png' });
}

await browser.close();
console.log('ok');
