// Finance V1 E2E test
const { chromium } = require('playwright');
const BASE = 'https://finance-v1.oseedigital.tech';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="text"]', 'owner');
  await page.fill('input[type="password"]', 'owner123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log(`Login: ${page.url()} | ${await page.title()}`);

  const pages = [
    ['Dashboard', '/finance'], ['Actions', '/finance/actions'], ['Alerts', '/finance/alerts'],
    ['Analytics', '/finance/analytics'], ['Closing Cash', '/finance/closing-cash'],
    ['Expenses', '/finance/expenses'], ['Petty Cash', '/finance/petty-cash'],
    ['POS', '/finance/pos'], ['Settings', '/finance/settings'], ['Summary', '/finance/summary'],
    ['Suppliers', '/finance/suppliers'],
  ];

  for (const [name, path] of pages) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const status = await page.evaluate(() => {
      const alerts = document.querySelectorAll('[role="alert"]');
      const alertTexts = []; alerts.forEach(el => { const t = el.textContent.trim(); if (t) alertTexts.push(t.substring(0, 150)); });
      const sidebar = document.querySelectorAll('nav a, aside a');
      const table = document.querySelector('table');
      const tbody = table?.querySelector('tbody');
      const btns = document.querySelectorAll('button:not([aria-hidden])');
      const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
      return { alerts: alertTexts, sidebar: sidebar.length, rows: tbody ? tbody.rows.length : -1, btns: btns.length, inputs: inputs.length };
    });
    const hasAlert = status.alerts.length > 0 ? `ALERTS(${status.alerts.join(',')})` : 'OK';
    console.log(`${name.padEnd(15)} | ${hasAlert} | rows:${status.rows} btns:${status.btns} inputs:${status.inputs} sidebar:${status.sidebar}`);
  }

  // Test settings page Telegram tab specifically
  await page.goto(`${BASE}/finance/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const telegramSection = await page.evaluate(() => {
    const tabs = document.querySelectorAll('button');
    for (const b of tabs) { if (b.textContent.includes('Telegram')) return b.id || b.textContent.trim(); }
    return 'not-found';
  });
  console.log(`Settings Telegram tab: ${telegramSection}`);

  await browser.close();
  console.log('=== FINANCE V1 E2E COMPLETE ===');
})().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
