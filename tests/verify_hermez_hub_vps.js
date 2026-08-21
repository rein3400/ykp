// Verifikasi Hermez via VPS (hermez.oseedigital.tech) + Hub via VPS (oseedigital.tech).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'output', 'playwright');

(async () => {
  fs.mkdirSync(path.join(OUT, 'hermez'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'hub'), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];

  // Hermez VPS: login page -> SSO GET -> dashboard pages
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    // SSO bridge on VPS hermez
    await page.goto('https://hermez.oseedigital.tech/api/auth/login?role=SUPER_ADMIN&redirect=/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    const finalUrl = page.url();
    const title = await page.title().catch(() => '');
    const body = await page.locator('body').innerText().catch(() => '');
    const h1 = await page.locator('h1').first().innerText().catch(() => '');
    await page.screenshot({ path: path.join(OUT, 'hermez', 'hermez-home.png') }).catch(() => {});
    fs.writeFileSync(path.join(OUT, 'hermez', 'hermez-home.txt'), `URL: ${finalUrl}\nTITLE: ${title}\nH1: ${h1}\n\n${body.slice(0, 3000)}`);
    results.push({ app: 'hermez', page: '/', status: 'PASS', note: (h1 || title || '').slice(0, 120), url: finalUrl });
    console.log(`hermez / -> ${finalUrl} | ${h1 || title}`);

    // Hermez sub-pages
    const hermezPages = ['/actions', '/alerts', '/config', '/run', '/telegram-bot', '/telegram-test', '/warehouse'];
    for (const p of hermezPages) {
      const r = { app: 'hermez', page: p, status: 'PASS', note: '', error: '' };
      try {
        await page.goto('https://hermez.oseedigital.tech' + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(2500);
        const t = await page.title().catch(() => '');
        const b = await page.locator('body').innerText().catch(() => '');
        const h = await page.locator('h1').first().innerText().catch(() => '');
        const low = (t + ' ' + b).toLowerCase();
        if (/couldn't load|application error|internal server error|not found/.test(low) && b.length < 2000) {
          r.status = 'FAIL'; r.error = 'error page';
        } else if (b.trim().length < 20) {
          r.status = 'FAIL'; r.error = 'blank';
        } else {
          r.note = (h || t || '').slice(0, 120);
        }
        const slug = p === '/' ? 'root' : p.replace(/^\//, '').replace(/\//g, '_');
        await page.screenshot({ path: path.join(OUT, 'hermez', slug + '.png') }).catch(() => {});
        fs.writeFileSync(path.join(OUT, 'hermez', slug + '.txt'), `TITLE: ${t}\nH1: ${h}\n\n${b.slice(0, 2000)}`);
      } catch (e) {
        r.status = 'FAIL'; r.error = e.message.slice(0, 200);
      }
      results.push(r);
      console.log(`${r.status} hermez ${p} ${r.note ? '| ' + r.note : ''} ${r.error ? '| ' + r.error : ''}`);
    }
  } catch (e) {
    results.push({ app: 'hermez', page: '/', status: 'FAIL', error: e.message.slice(0, 200) });
    console.log(`hermez FAIL: ${e.message}`);
  }
  await ctx.close();

  // Hub VPS: login -> dashboard -> module cards
  const hubCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hub = await hubCtx.newPage();
  try {
    await hub.goto('https://oseedigital.tech/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await hub.waitForTimeout(2000);
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
    console.log('hub dashboard rendered');
  } catch (e) {
    results.push({ app: 'hub', page: '/', status: 'FAIL', error: e.message.slice(0, 200) });
    console.log(`hub FAIL: ${e.message}`);
  }
  await hubCtx.close();

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'hermez-hub.json'), JSON.stringify(results, null, 2));
  console.log('DONE hermez+hub VPS');
})();
