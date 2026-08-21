// Re-verification of the 8 previously-FAIL pages after fixes:
//   - /ops/checklist (ops_checklist_submission tab created via sheets:bootstrap)
//   - 7 Hermez sub-pages (hermez schema tables created via db:migrate)
// Drives the real entry path: login/SSO -> navigate -> assert rendered content.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'output', 'playwright');

function isErrorPage(title, body) {
  const t = (title || '').toLowerCase();
  const b = (body || '').toLowerCase();
  if (/couldn't load|could not load|application error|internal server error|server error occurred/.test(t + ' ' + b)) return true;
  if (/error \d{6,}/.test(b) && b.length < 500) return true;
  return false;
}

async function login(page, app) {
  await page.goto(app.base + app.loginPath, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  const inputs = await page.locator('input').count();
  if (inputs >= 2) {
    await page.locator('input').first().fill(app.creds.username).catch(() => {});
    await page.locator('input[type="password"]').first().fill(app.creds.password).catch(() => {});
    const btn = page.locator('button').filter({ hasText: /login|masuk|sign in/i }).first();
    if (await btn.count() > 0) await btn.click().catch(() => {});
    else await page.locator('button').first().click().catch(() => {});
    await page.waitForTimeout(4000);
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];

  // 1. Ops /ops/checklist
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const app = { base: 'https://ops.oseedigital.tech', loginPath: '/login', creds: { username: 'owner', password: 'owner123' } };
    await login(page, app);
    const r = { app: 'ops-v1', page: '/ops/checklist', status: 'PASS', note: '', error: '' };
    try {
      await page.goto(app.base + '/ops/checklist', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(4000);
      const title = await page.title().catch(() => '');
      const body = await page.locator('body').innerText().catch(() => '');
      const h1 = await page.locator('h1').first().innerText().catch(() => '');
      if (isErrorPage(title, body)) { r.status = 'FAIL'; r.error = 'server error page'; }
      else if (body.trim().length < 20) { r.status = 'FAIL'; r.error = 'blank page'; }
      else { r.note = (h1 || title || '').slice(0, 120); }
      const dir = path.join(OUT, 'ops-v1');
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, 'ops_checklist-fixed.png') }).catch(() => {});
      fs.writeFileSync(path.join(dir, 'ops_checklist-fixed.txt'), `TITLE: ${title}\nH1: ${h1}\n\n${body.slice(0, 3000)}`);
    } catch (e) { r.status = 'FAIL'; r.error = e.message.slice(0, 200); }
    results.push(r);
    console.log(`${r.status} ops-v1 /ops/checklist ${r.note ? '| ' + r.note : ''} ${r.error ? '| ' + r.error : ''}`);
    await ctx.close();
  }

  // 2. Hermez 7 sub-pages via SSO
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('https://hermez.oseedigital.tech/api/auth/login?role=SUPER_ADMIN&redirect=/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    const hermezPages = ['/actions', '/alerts', '/config', '/run', '/telegram-bot', '/telegram-test', '/warehouse'];
    for (const p of hermezPages) {
      const r = { app: 'hermez', page: p, status: 'PASS', note: '', error: '' };
      try {
        await page.goto('https://hermez.oseedigital.tech' + p, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(4000);
        const title = await page.title().catch(() => '');
        const body = await page.locator('body').innerText().catch(() => '');
        const h1 = await page.locator('h1').first().innerText().catch(() => '');
        if (isErrorPage(title, body)) { r.status = 'FAIL'; r.error = 'server error page'; }
        else if (body.trim().length < 20) { r.status = 'FAIL'; r.error = 'blank page'; }
        else { r.note = (h1 || title || '').slice(0, 120); }
        const slug = p.replace(/^\//, '').replace(/\//g, '_');
        const dir = path.join(OUT, 'hermez');
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, slug + '-fixed.png') }).catch(() => {});
        fs.writeFileSync(path.join(dir, slug + '-fixed.txt'), `TITLE: ${title}\nH1: ${h1}\n\n${body.slice(0, 3000)}`);
      } catch (e) { r.status = 'FAIL'; r.error = e.message.slice(0, 200); }
      results.push(r);
      console.log(`${r.status} hermez ${p} ${r.note ? '| ' + r.note : ''} ${r.error ? '| ' + r.error : ''}`);
    }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'fix-verification.json'), JSON.stringify(results, null, 2));
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\nDONE: ${pass} PASS / ${fail} FAIL of ${results.length}`);
  if (fail > 0) process.exit(1);
})();
