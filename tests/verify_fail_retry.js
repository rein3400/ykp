// Re-verify halaman yang sebelumnya FAIL dengan deteksi error yang akurat.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'output', 'playwright');

const TARGETS = [
  { app: 'finance-v1', base: 'https://finance-v1.oseedigital.tech', loginPath: '/login', creds: { username: 'owner', password: 'owner123' }, pages: ['/finance/expenses'] },
  { app: 'warehouse-v1', base: 'https://warehouse.oseedigital.tech', loginPath: '/login', creds: { username: 'owner', password: 'owner123' }, pages: ['/warehouse/suppliers', '/warehouse/threshold'] },
  { app: 'investor-v1', base: 'https://investor.oseedigital.tech', loginPath: '/login', creds: { username: 'owner', password: 'owner123' }, pages: ['/investor', '/investor/portfolio'] },
  { app: 'owner-v1', base: 'https://owner.oseedigital.tech', loginPath: '/login', creds: { username: 'owner', password: 'owner123' }, pages: ['/owner/gudang'] },
  { app: 'ops-v1', base: 'https://ops.oseedigital.tech', loginPath: '/login', creds: { username: 'owner', password: 'owner123' }, pages: ['/ops/checklist'] }
];

function slug(p) { return (p === '/' ? 'root' : p.replace(/^\//, '').replace(/\//g, '_')); }

function isErrorPage(title, body) {
  const t = (title || '').toLowerCase();
  const b = (body || '').toLowerCase();
  if (/couldn't load|could not load|application error|internal server error|server error occurred/.test(t + ' ' + b)) return true;
  // Next.js error page signature
  if (/error \d{6,}/.test(b) && b.length < 500) return true;
  return false;
}

async function login(page, app) {
  await page.goto(app.base + app.loginPath, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  const inputs = await page.locator('input').count();
  if (inputs >= 2) {
    await page.locator('input').first().fill(app.creds.username).catch(() => {});
    await page.locator('input[type="password"]').first().fill(app.creds.password).catch(() => {});
    const btn = page.locator('button').filter({ hasText: /login|masuk|sign in/i }).first();
    if (await btn.count() > 0) await btn.click().catch(() => {});
    else await page.locator('button').first().click().catch(() => {});
    await page.waitForTimeout(3000);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const app of TARGETS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, app);
    for (const p of app.pages) {
      const r = { app: app.app, page: p, status: 'PASS', note: '', interaction: '', error: '' };
      const dir = path.join(OUT, app.app);
      fs.mkdirSync(dir, { recursive: true });
      const base = path.join(dir, slug(p));
      try {
        await page.goto(app.base + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(2500);
        const title = await page.title().catch(() => '');
        const body = await page.locator('body').innerText().catch(() => '');
        const h1 = await page.locator('h1').first().innerText().catch(() => '');
        if (isErrorPage(title, body)) {
          r.status = 'FAIL';
          r.error = 'server error page';
        } else if (body.trim().length < 20) {
          r.status = 'FAIL';
          r.error = 'blank page';
        } else {
          r.note = (h1 || title || '').slice(0, 120);
        }
        await page.screenshot({ path: base + '.png' }).catch(() => {});
        fs.writeFileSync(base + '.txt', `TITLE: ${title}\nH1: ${h1}\n\n${body.slice(0, 3000)}`);
        // interaction
        const mainBtn = page.locator('main button').first();
        if (await mainBtn.count() > 0) {
          const label = await mainBtn.innerText().catch(() => '');
          if (!/hapus|delete|logout|keluar|submit|simpan|save|generate|regenerate/i.test(label)) {
            await mainBtn.click().catch(() => {});
            await page.waitForTimeout(1200);
            r.interaction = `click "${label.slice(0, 40)}"`;
          }
        }
        await page.screenshot({ path: base + '-after.png' }).catch(() => {});
      } catch (e) {
        r.status = 'FAIL';
        r.error = e.message.slice(0, 200);
      }
      results.push(r);
      console.log(`${r.status} ${app.app} ${p} ${r.note ? '| ' + r.note : ''} ${r.error ? '| ' + r.error : ''}`);
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'retry.json'), JSON.stringify(results, null, 2));
  console.log('DONE retry');
})();
