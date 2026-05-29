import { chromium } from 'playwright';
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const errs = [];
page.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text());
});
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
const reqs = [];
const fails = [];
page.on('response', (r) => {
  const u = r.url();
  if (u.includes('r2.dev')) reqs.push(`${r.status()} ${u.slice(u.indexOf('r2.dev')+7)}`);
});
page.on('requestfailed', (r) => fails.push(`${r.failure()?.errorText} ${r.url().slice(0, 100)}`));
await page.goto('https://plateau-r3f-demo.pages.dev/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(30000);
console.log('=== unique URL patterns (deduped by prefix) ===');
const seen = new Set();
for (const r of reqs) {
  const key = r.replace(/\/\d+_bldg.*/, '/...');
  if (!seen.has(key)) {
    seen.add(key);
    console.log(r);
  }
}
console.log(`\ntotal: ${reqs.length} reqs`);
console.log('\n=== r2 responses by status ===');
const byStatus = {};
for (const r of reqs) {
  const s = r.split(' ')[0];
  byStatus[s] = (byStatus[s] ?? 0) + 1;
}
console.log(byStatus);
console.log('\n=== failed reqs ===');
console.log(fails.slice(0, 5).join('\n'));
console.log('\n=== console errors ===');
console.log(errs.slice(0, 5).join('\n'));
await browser.close();
