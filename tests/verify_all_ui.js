// Verifikasi manual semua fitur aplikasi YKP via Playwright (headless).
// Login -> navigasi -> interaksi minimal -> snapshot + screenshot.
// Output: output/playwright/<app>/<page>.png + .txt, dan report JSON.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'output', 'playwright');
const APPS = [
  {
    id: 'hr-v1',
    name: 'HR V1',
    base: 'https://hr-v1.oseedigital.tech',
    loginPath: '/login',
    homePath: '/hr',
    creds: { username: 'owner', password: 'owner123' },
    pages: [
      '/hr', '/hr/attendance', '/hr/employees', '/hr/employees/new',
      '/hr/employees/import', '/hr/lateness', '/hr/leaves', '/hr/payroll',
      '/hr/payroll/generate', '/hr/roster', '/hr/summary', '/hr/telegram',
      '/hr/users', '/hr/adjustments', '/change-password'
    ]
  },
  {
    id: 'finance-v1',
    name: 'Finance V1',
    base: 'https://finance-v1.oseedigital.tech',
    loginPath: '/login',
    homePath: '/finance',
    creds: { username: 'owner', password: 'owner123' },
    pages: [
      '/finance', '/finance/analytics', '/finance/summary', '/finance/pos',
      '/finance/suppliers', '/finance/petty-cash', '/finance/expenses',
      '/finance/closing-cash', '/finance/alerts', '/finance/actions',
      '/finance/settings', '/finance/telegram'
    ]
  },
  {
    id: 'warehouse-v1',
    name: 'Warehouse V1',
    base: 'https://warehouse.oseedigital.tech',
    loginPath: '/login',
    homePath: '/warehouse',
    creds: { username: 'owner', password: 'owner123' },
    pages: [
      '/warehouse', '/warehouse/items', '/warehouse/locations',
      '/warehouse/suppliers', '/warehouse/categories',
      '/warehouse/unit-conversion', '/warehouse/threshold',
      '/warehouse/penerimaan', '/warehouse/pemakaian', '/warehouse/transfer',
      '/warehouse/waste', '/warehouse/opname', '/warehouse/ledger',
      '/warehouse/expiry', '/warehouse/purchase-recommendation',
      '/warehouse/purchase-request', '/warehouse/alerts', '/warehouse/actions',
      '/warehouse/summary', '/warehouse/dashboard', '/warehouse/telegram',
      '/warehouse/stok', '/warehouse/closing'
    ]
  },
  {
    id: 'investor-v1',
    name: 'Investor V1',
    base: 'https://investor.oseedigital.tech',
    loginPath: '/login',
    homePath: '/investor',
    creds: { username: 'owner', password: 'owner123' },
    pages: [
      '/investor', '/investor/portfolio', '/investor/capital',
      '/investor/dividend', '/investor/returns', '/investor/telegram',
      '/investor/admin'
    ]
  },
  {
    id: 'ops-v1',
    name: 'Ops V1',
    base: 'https://ops.oseedigital.tech',
    loginPath: '/login',
    homePath: '/ops',
    creds: { username: 'owner', password: 'owner123' },
    pages: [
      '/ops', '/ops/briefing', '/ops/opening', '/ops/checklist', '/ops/kds',
      '/ops/qc', '/ops/incidents', '/ops/closing', '/ops/waste',
      '/ops/analytics', '/ops/ai-assistant', '/ops/telegram'
    ]
  },
  {
    id: 'owner-v1',
    name: 'Owner V1',
    base: 'https://owner.oseedigital.tech',
    loginPath: '/login',
    homePath: '/owner',
    creds: { username: 'owner', password: 'owner123' },
    pages: [
      '/owner', '/owner/activity', '/owner/brief', '/owner/bukti',
      '/owner/gudang', '/owner/health', '/owner/investor', '/owner/keuangan',
      '/owner/operasional', '/owner/penjualan', '/owner/sdm'
    ]
  },
  {
    id: 'hub',
    name: 'Hub',
    base: 'https://oseedigital.tech',
    loginPath: '/',
    homePath: '/',
    creds: { username: 'owner', password: 'owner123' },
    pages: ['/']
  }
];

function slug(p) {
  return (p === '/' ? 'root' : p.replace(/^\//, '').replace(/\//g, '_'));
}

async function login(page, app) {
  await page.goto(app.base + app.loginPath, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  // Fill username/password if present
  const inputs = await page.locator('input').count();
  if (inputs >= 2) {
    const userInput = page.locator('input').first();
    const passInput = page.locator('input[type="password"]').first();
    await userInput.fill(app.creds.username).catch(() => {});
    await passInput.fill(app.creds.password).catch(() => {});
    // Click login button
    const btn = page.locator('button').filter({ hasText: /login|masuk|sign in/i }).first();
    const btnCount = await btn.count();
    if (btnCount > 0) {
      await btn.click().catch(() => {});
    } else {
      await page.locator('button').first().click().catch(() => {});
    }
    await page.waitForTimeout(3000);
  }
}

async function verifyPage(page, app, p) {
  const result = { app: app.id, page: p, status: 'PASS', note: '', interaction: '', error: '' };
  const dir = path.join(OUT, app.id);
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, slug(p));
  try {
    await page.goto(app.base + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    const title = await page.title().catch(() => '');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const h1 = await page.locator('h1').first().innerText().catch(() => '');
    // Detect error/blank
    const lower = bodyText.toLowerCase();
    if (/application error|500|internal server error|not found|404/.test(lower) && bodyText.length < 2000) {
      result.status = 'FAIL';
      result.error = 'error page detected';
    } else if (bodyText.trim().length < 20) {
      result.status = 'FAIL';
      result.error = 'blank page';
    } else {
      result.note = (h1 || title || '').slice(0, 120);
    }
    // Screenshot
    await page.screenshot({ path: base + '.png', fullPage: false }).catch(() => {});
    fs.writeFileSync(base + '.txt', `TITLE: ${title}\nH1: ${h1}\n\n${bodyText.slice(0, 3000)}`);

    // Minimal interaction: click first button in main (non-destructive), or fill first textbox
    let interacted = false;
    const mainBtn = page.locator('main button').first();
    if (await mainBtn.count() > 0) {
      const label = await mainBtn.innerText().catch(() => '');
      // Avoid destructive actions
      if (!/hapus|delete|logout|keluar|submit|simpan|save|generate|regenerate/i.test(label)) {
        await mainBtn.click().catch(() => {});
        await page.waitForTimeout(1200);
        interacted = true;
        result.interaction = `click button "${label.slice(0, 40)}"`;
      }
    }
    if (!interacted) {
      const mainInput = page.locator('main input, main select, main textarea').first();
      if (await mainInput.count() > 0) {
        const tag = await mainInput.evaluate((el) => el.tagName).catch(() => '');
        if (tag === 'SELECT') {
          await mainInput.selectOption({ index: 1 }).catch(() => {});
          result.interaction = 'select option index 1';
        } else {
          await mainInput.fill('test').catch(() => {});
          result.interaction = 'fill first input';
        }
        await page.waitForTimeout(800);
        interacted = true;
      }
    }
    if (!interacted) {
      result.interaction = '(no safe interactive element)';
    }
    // Post-interaction screenshot
    await page.screenshot({ path: base + '-after.png', fullPage: false }).catch(() => {});
  } catch (e) {
    result.status = 'FAIL';
    result.error = e.message.slice(0, 200);
    try { await page.screenshot({ path: base + '.png' }).catch(() => {}); } catch {}
  }
  return result;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = [];
  for (const app of APPS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    console.log(`\n=== ${app.name} (${app.id}) ===`);
    try {
      await login(page, app);
      // Verify we're logged in (URL should not be login page)
      const url = page.url();
      console.log(`  after login URL: ${url}`);
      for (const p of app.pages) {
        const r = await verifyPage(page, app, p);
        report.push(r);
        console.log(`  ${r.status} ${p} ${r.note ? '| ' + r.note : ''} ${r.error ? '| ERR: ' + r.error : ''}`);
      }
    } catch (e) {
      console.log(`  APP FAIL: ${e.message}`);
      report.push({ app: app.id, page: '(login)', status: 'FAIL', note: '', interaction: '', error: e.message.slice(0, 200) });
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\nDONE. Report written to output/playwright/report.json');
})();
