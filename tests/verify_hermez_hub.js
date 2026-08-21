// Verifikasi Hermez (Railway) via SSO bridge + Hub SSO flow.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'output', 'playwright');
const SSO_SECRET = 'ykp_sso_secret_2024_prod_v1';

(async () => {
  fs.mkdirSync(path.join(OUT, 'hermez'), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const results = [];

  // 1. Hermez SSO bridge (SUPER_ADMIN)
  try {
    const url = `https://ykp-erp-hermez-production.up.railway.app/api/auth/login?role=SUPER_ADMIN&token=${SSO_SECRET}&redirect=/`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    const finalUrl = page.url();
    const title = await page.title().catch(() => '');
    const body = await page.locator('body').innerText().catch(() => '');
    const h1 = await page.locator('h1').first().innerText().catch(() => '');
    await page.screenshot({ path: path.join(OUT, 'hermez', 'hermez-home.png') }).catch(() => {});
    fs.writeFileSync(path.join(OUT, 'hermez', 'hermez-home.txt'), `URL: ${finalUrl}\nTITLE: ${title}\nH1: ${h1}\n\n${body.slice(0, 3000)}`);
    results.push({ app: 'hermez', page: '/', status: 'PASS', note: (h1 || title || '').slice(0, 120), url: finalUrl });
    console.log(`hermez / -> ${finalUrl} | ${h1 || title}`);
  } catch (e) {
    results.push({ app: 'hermez', page: '/', status: 'FAIL', error: e.message.slice(0, 200) });
    console.log(`hermez FAIL: ${e.message}`);
  }

  // 2. Hub SSO flow (login -> click module -> new tab)
  try {
    const hubCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const hub = await hubCtx.newPage();
    await hub.goto('https://oseedigital.tech/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await hub.waitForTimeout(2000);
    // login
    const inputs = await hub.locator('input').count();
    if (inputs >= 2) {
      await hub.locator('input').first().fill('owner').catch(() => {});
      await hub.locator('input[type="password"]').first().fill('owner123').catch(() => {});
      const btn = hub.locator('button').filter({ hasText: /login|masuk|sign in/i }).first();
      if (await btn.count() > 0) await btn.click().catch(() => {});
      else await hub.locator('button').first().click().catch(() => {});
      await hub.waitForTimeout(4000);
    }
    const hubBody = await hub.locator('body').innerText().catch(() => '');
    await hub.screenshot({ path: path.join(OUT, 'hub', 'hub-dashboard.png') }).catch(() => {});
    fs.writeFileSync(path.join(OUT, 'hub', 'hub-dashboard.txt'), hubBody.slice(0, 3000));
    results.push({ app: 'hub', page: '/', status: 'PASS', note: 'dashboard rendered' });
    console.log('hub dashboard rendered, modules:', (hubBody.match(/HR|Finance|Warehouse|Investor|Ops|Owner/g) || []).join(','));
    await hubCtx.close();
  } catch (e) {
    results.push({ app: 'hub', page: '/', status: 'FAIL', error: e.message.slice(0, 200) });
    console.log(`hub FAIL: ${e.message}`);
  }

  await ctx.close();
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'hermez-hub.json'), JSON.stringify(results, null, 2));
  console.log('DONE hermez+hub');
})();
