// Ops V1 E2E test
const { chromium } = require('playwright');
const BASE = 'https://ops.oseedigital.tech';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', 'owner');
  await page.fill('input[name="password"]', 'owner123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log(`Login: ${page.url()} | ${await page.title()}`);

  const pages = [
    ['Dashboard', '/ops'], ['AI Assistant', '/ops/ai-assistant'], ['Analytics', '/ops/analytics'],
    ['Briefing', '/ops/briefing'], ['Closing', '/ops/closing'], ['Incidents', '/ops/incidents'],
    ['KDS', '/ops/kds'], ['Opening', '/ops/opening'], ['QC', '/ops/qc'], ['Waste', '/ops/waste'],
  ];

  for (const [name, path] of pages) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const status = await page.evaluate(() => {
      const alerts = document.querySelectorAll('[role="alert"]');
      const alertTexts = []; alerts.forEach(el => { const t = el.textContent.trim(); if (t) alertTexts.push(t.substring(0, 100)); });
      const tbody = document.querySelector('tbody');
      const btns = document.querySelectorAll('button:not([aria-hidden])');
      const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
      return { alerts: alertTexts, rows: tbody ? tbody.rows.length : -1, btns: btns.length, inputs: inputs.length };
    });
    console.log(`${name.padEnd(14)} | ${status.alerts.length > 0 ? `ALERTS(${status.alerts.join(',')})` : 'OK'} | rows:${status.rows} btns:${status.btns} inputs:${status.inputs}`);
  }

  await browser.close();
  console.log('=== OPS V1 E2E COMPLETE ===');
})().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
