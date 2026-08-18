/**
 * Exhaustive button test v2 — incremental report, resume-safe, faster timeouts.
 * Writes tests/exhaustive-button-report.json after EACH app.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('tests/screenshots/exhaustive-buttons-2026-07-15');
const REPORT = path.resolve('tests/exhaustive-button-report.json');
fs.mkdirSync(OUT_DIR, { recursive: true });

const APPS = [
  {
    id: 'warehouse',
    base: 'https://ykp-warehouse-v1.vercel.app',
    loginPath: '/login',
    creds: { username: 'owner', password: 'owner123' },
    home: '/warehouse',
    pages: [
      '/warehouse', '/warehouse/items', '/warehouse/locations', '/warehouse/suppliers',
      '/warehouse/categories', '/warehouse/unit-conversion', '/warehouse/threshold',
      '/warehouse/penerimaan', '/warehouse/pemakaian', '/warehouse/transfer', '/warehouse/waste',
      '/warehouse/opname', '/warehouse/ledger', '/warehouse/expiry',
      '/warehouse/purchase-recommendation', '/warehouse/purchase-request',
      '/warehouse/alerts', '/warehouse/actions', '/warehouse/summary', '/warehouse/dashboard'
    ]
  },
  {
    id: 'investor',
    base: 'https://ykp-investor-v1.vercel.app',
    loginPath: '/login',
    creds: { username: 'owner', password: 'owner123' },
    home: '/investor',
    pages: ['/investor', '/investor/portfolio', '/investor/capital', '/investor/dividend', '/investor/returns']
  },
  {
    id: 'hr-v1',
    base: 'https://ykp-hr-v1-standalone-production.up.railway.app',
    loginPath: '/login',
    creds: { username: 'owner', password: 'owner123' },
    home: '/hr',
    pages: [
      '/hr', '/hr/employees', '/hr/attendance', '/hr/roster', '/hr/lateness',
      '/hr/leaves', '/hr/payroll', '/hr/adjustments', '/hr/summary', '/hr/users'
    ]
  },
  {
    id: 'finance',
    base: 'https://ykp-erp-finance-production.up.railway.app',
    loginPath: '/api/auth/login?role=OWNER&redirect=/',
    creds: null,
    home: '/',
    pages: ['/', '/pos', '/expenses', '/suppliers', '/petty-cash', '/summary', '/analytics', '/settings']
  },
  {
    id: 'hermez',
    base: 'https://ykp-erp-hermez-production.up.railway.app',
    loginPath: '/api/auth/login?role=SUPER_ADMIN&redirect=/',
    creds: null,
    home: '/',
    pages: ['/', '/alerts', '/actions', '/warehouse', '/config', '/run', '/telegram-test']
  },
  {
    id: 'erp-hr',
    base: 'https://ykp-erp-hr-production.up.railway.app',
    loginPath: '/api/auth/login?role=OWNER&redirect=/',
    creds: null,
    home: '/',
    pages: ['/', '/employees', '/attendance', '/payroll', '/leaves', '/roster', '/summary']
  },
  {
    id: 'hub',
    base: 'https://ykp-hub-production.up.railway.app',
    loginPath: '/',
    creds: null,
    home: '/',
    pages: ['/']
  }
];

function safeName(s) {
  return String(s || 'el').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
}

function loadReport() {
  if (fs.existsSync(REPORT)) {
    try { return JSON.parse(fs.readFileSync(REPORT, 'utf8')); } catch { /* fallthrough */ }
  }
  return {
    startedAt: new Date().toISOString(),
    apps: [],
    totals: { pagesOk: 0, pagesFail: 0, buttonsClicked: 0, buttonsSkipped: 0, buttonsFailed: 0 },
    findings: []
  };
}

function saveReport(report) {
  report.updatedAt = new Date().toISOString();
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
}

async function login(page, app) {
  const before = { url: page.url() };
  if (app.creds) {
    await page.goto(app.base + app.loginPath, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(800);
    const user = page.locator('input[type="text"], input[name="username"]').first();
    const pass = page.locator('input[type="password"]').first();
    if (await user.count()) await user.fill(app.creds.username);
    if (await pass.count()) await pass.fill(app.creds.password);
    const btn = page.getByRole('button', { name: /login|masuk|sign in/i }).first();
    if (await btn.count()) await btn.click({ timeout: 8000 });
    else await page.locator('button[type="submit"]').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2500);
  } else {
    await page.goto(app.base + app.loginPath, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
  }
  return {
    before,
    after: { url: page.url() },
    ok: !page.url().includes('/login') || !app.creds
  };
}

async function pageHealth(page) {
  const url = page.url();
  const title = await page.title().catch(() => '');
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const errors = [];
  if (/internal server error|application error|something went wrong|502 Bad Gateway|503 Service/i.test(bodyText)) {
    errors.push('ERROR_TEXT');
  }
  if (/^Unauthorized$/i.test(bodyText.trim()) || bodyText.includes('"code":"unauthorized"')) {
    errors.push('UNAUTHORIZED');
  }
  const counts = await page.evaluate(() => ({
    buttons: document.querySelectorAll('button').length,
    links: document.querySelectorAll('a[href]').length,
    inputs: document.querySelectorAll('input,select,textarea').length,
    tables: document.querySelectorAll('table').length,
    h1: document.querySelector('h1')?.innerText?.slice(0, 100) || '',
    emptyHint: (document.body?.innerText || '').match(/belum ada|no data|empty|tidak ada/i)?.[0] || null
  }));
  return { url, title, errors, counts, bodySnippet: bodyText.replace(/\s+/g, ' ').slice(0, 240) };
}

async function listInteractives(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, a[href], [role="button"], input[type="submit"]').forEach((el, idx) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      const visible = r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
      const text = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('href') || '').trim().slice(0, 80);
      out.push({
        idx, tag: el.tagName.toLowerCase(), text,
        href: el.getAttribute('href') || '',
        disabled: !!(el.disabled || el.getAttribute('aria-disabled') === 'true'),
        visible
      });
    });
    return out;
  });
}

async function testApp(browser, app) {
  const result = {
    app: app.id,
    base: app.base,
    testedAt: new Date().toISOString(),
    before: {},
    login: null,
    pages: [],
    buttons: [],
    summary: { pagesOk: 0, pagesFail: 0, buttonsClicked: 0, buttonsSkipped: 0, buttonsFailed: 0, navOk: 0 },
    consoleErrors: [],
    networkFails: []
  };

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const networkFails = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('favicon')) {
      networkFails.push({ url: res.url().slice(0, 160), status: res.status(), method: res.request().method() });
    }
  });

  // BEFORE unauth probe
  try {
    const r = await page.goto(app.base + '/', { waitUntil: 'domcontentloaded', timeout: 40000 });
    result.before = { homeStatus: r?.status() ?? null, homeUrl: page.url(), health: await pageHealth(page) };
  } catch (e) {
    result.before = { error: String(e).slice(0, 200) };
  }

  // LOGIN
  try {
    result.login = await login(page, app);
    if (result.login.ok) {
      await page.goto(app.base + app.home, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    result.login = { ok: false, error: String(e).slice(0, 250) };
  }

  for (const p of app.pages) {
    const pr = { path: p, before: null, while: { clicks: [] }, after: null, error: null };
    const shot = `${app.id}_${safeName(p)}`;
    try {
      const resp = await page.goto(app.base + p, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await page.waitForTimeout(1000);
      pr.before = { http: resp?.status() ?? null, ...(await pageHealth(page)) };
      await page.screenshot({ path: path.join(OUT_DIR, `${shot}_before.png`) }).catch(() => {});

      if ((resp?.status() ?? 500) >= 400 || pr.before.errors.includes('ERROR_TEXT') || pr.before.errors.includes('UNAUTHORIZED')) {
        result.summary.pagesFail++;
        pr.after = pr.before;
        result.pages.push(pr);
        continue;
      }
      result.summary.pagesOk++;

      const els = (await listInteractives(page)).filter((e) => e.visible);
      let n = 0;
      for (const el of els) {
        if (n >= 20) break;
        if (el.href?.startsWith('http') && !el.href.startsWith(app.base)) {
          result.summary.buttonsSkipped++;
          pr.while.clicks.push({ el, action: 'skip_external' });
          continue;
        }
        if (/logout|keluar|sign out/i.test(el.text)) {
          result.summary.buttonsSkipped++;
          pr.while.clicks.push({ el, action: 'skip_logout' });
          continue;
        }
        if (el.disabled) {
          result.summary.buttonsSkipped++;
          pr.while.clicks.push({ el, action: 'skip_disabled' });
          continue;
        }

        const beforeClick = { url: page.url(), h1: pr.before.counts?.h1 };
        const net0 = networkFails.length;
        const cons0 = consoleErrors.length;
        let click = { ok: false };
        try {
          if (el.tag === 'a' && el.href?.startsWith('/')) {
            await page.locator(`a[href="${el.href}"]`).first().click({ timeout: 3500 });
            click = { ok: true, method: 'href' };
          } else if (el.text && el.text.length > 0 && el.text.length < 48) {
            const role = el.tag === 'a' ? 'link' : 'button';
            await page.getByRole(role, { name: el.text, exact: false }).first().click({ timeout: 3500 });
            click = { ok: true, method: 'role' };
          } else {
            await page.evaluate((i) => {
              const nodes = Array.from(document.querySelectorAll('button, a[href], [role="button"], input[type="submit"]'));
              nodes[i]?.click();
            }, el.idx);
            click = { ok: true, method: 'index' };
          }
        } catch (e) {
          click = { ok: false, reason: String(e).slice(0, 120) };
        }
        await page.waitForTimeout(700);
        const afterClick = {
          url: page.url(),
          h1: (await page.locator('h1').first().innerText().catch(() => '')).slice(0, 80),
          newNetworkFails: networkFails.slice(net0, net0 + 8),
          newConsoleErrors: consoleErrors.slice(cons0, cons0 + 5)
        };
        const navigated = beforeClick.url !== afterClick.url;
        if (click.ok) {
          result.summary.buttonsClicked++;
          if (navigated) result.summary.navOk++;
        } else {
          result.summary.buttonsFailed++;
        }
        const entry = {
          app: app.id, page: p, text: el.text, tag: el.tag, href: el.href,
          clickOk: click.ok, reason: click.reason || null, method: click.method || null,
          navigated, urlBefore: beforeClick.url, urlAfter: afterClick.url,
          networkFails: afterClick.newNetworkFails, consoleErrors: afterClick.newConsoleErrors,
          caused5xx: afterClick.newNetworkFails.some((x) => x.status >= 500),
          caused4xxApi: afterClick.newNetworkFails.some((x) => x.status >= 400 && x.url.includes('/api/'))
        };
        pr.while.clicks.push({ el: { text: el.text, tag: el.tag, href: el.href }, click, before: beforeClick, after: afterClick, navigated });
        result.buttons.push(entry);
        n++;

        if (navigated) {
          if (afterClick.url.includes('/login') && app.creds) await login(page, app);
          await page.goto(app.base + p, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
          await page.waitForTimeout(600);
        }
      }

      pr.after = await pageHealth(page);
      await page.screenshot({ path: path.join(OUT_DIR, `${shot}_after.png`) }).catch(() => {});
    } catch (e) {
      pr.error = String(e).slice(0, 350);
      result.summary.pagesFail++;
    }
    result.pages.push(pr);
  }

  // logout at end
  try {
    await page.goto(app.base + app.home, { waitUntil: 'domcontentloaded', timeout: 25000 });
    const lo = page.getByRole('button', { name: /logout|keluar/i }).first();
    if (await lo.count()) {
      const b = page.url();
      await lo.click({ timeout: 4000 });
      await page.waitForTimeout(1200);
      result.logout = { before: b, after: page.url(), ok: page.url().includes('login') || page.url() !== b };
    }
  } catch (e) {
    result.logout = { error: String(e).slice(0, 150) };
  }

  result.consoleErrors = consoleErrors.slice(0, 40);
  result.networkFails = networkFails.slice(0, 100);
  await context.close();
  return result;
}

async function main() {
  const only = process.argv.slice(2); // optional app ids
  const report = loadReport();
  // if resuming, drop incomplete apps that we will retest
  const targets = only.length ? APPS.filter((a) => only.includes(a.id)) : APPS;
  const doneIds = new Set((report.apps || []).filter((a) => a.summary && !a.fatal).map((a) => a.app));

  const browser = await chromium.launch({ headless: true });
  for (const app of targets) {
    if (!only.length && doneIds.has(app.id) && app.id !== 'finance' && app.id !== 'hermez' && app.id !== 'erp-hr' && app.id !== 'hub' && app.id !== 'hr-v1') {
      // warehouse+investor already complete from previous run if present
      const prev = report.apps.find((a) => a.app === app.id);
      if (prev?.summary?.pagesOk > 0) {
        console.log(`SKIP ${app.id} (already in report)`);
        continue;
      }
    }
    console.log(`\n=== TESTING ${app.id} @ ${app.base} ===`);
    // remove previous entry for this app
    report.apps = (report.apps || []).filter((a) => a.app !== app.id);
    try {
      const r = await testApp(browser, app);
      report.apps.push(r);
      console.log(app.id, r.summary, 'login', r.login?.ok);
    } catch (e) {
      console.error(app.id, 'FATAL', e);
      report.apps.push({ app: app.id, fatal: String(e) });
    }
    // recompute totals
    report.totals = { pagesOk: 0, pagesFail: 0, buttonsClicked: 0, buttonsSkipped: 0, buttonsFailed: 0 };
    for (const a of report.apps) {
      if (!a.summary) continue;
      report.totals.pagesOk += a.summary.pagesOk || 0;
      report.totals.pagesFail += a.summary.pagesFail || 0;
      report.totals.buttonsClicked += a.summary.buttonsClicked || 0;
      report.totals.buttonsSkipped += a.summary.buttonsSkipped || 0;
      report.totals.buttonsFailed += a.summary.buttonsFailed || 0;
    }
    // findings
    report.findings = [];
    for (const a of report.apps) {
      if (a.fatal) report.findings.push({ app: a.app, severity: 'CRITICAL', msg: a.fatal });
      if (a.login && a.login.ok === false) report.findings.push({ app: a.app, severity: 'CRITICAL', msg: 'Login failed', detail: a.login });
      for (const p of a.pages || []) {
        if (p.before?.http >= 400) report.findings.push({ app: a.app, severity: 'HIGH', msg: `${p.path} HTTP ${p.before.http}`, body: p.before.bodySnippet });
        if (p.before?.errors?.length) report.findings.push({ app: a.app, severity: 'HIGH', msg: `${p.path} ${p.before.errors.join(',')}`, body: p.before.bodySnippet });
        if (p.error) report.findings.push({ app: a.app, severity: 'HIGH', msg: `${p.path} exception: ${p.error}` });
      }
      for (const b of a.buttons || []) {
        if (b.caused5xx) report.findings.push({ app: a.app, severity: 'CRITICAL', msg: `Click "${b.text}" on ${b.page} caused 5xx`, network: b.networkFails });
      }
      const fives = (a.networkFails || []).filter((n) => n.status >= 500);
      if (fives.length) report.findings.push({ app: a.app, severity: 'HIGH', msg: `${fives.length} 5xx responses`, sample: fives.slice(0, 6) });
    }
    saveReport(report);
    console.log('saved report', REPORT);
  }

  report.finishedAt = new Date().toISOString();
  saveReport(report);
  console.log('\n=== TOTALS ===', report.totals);
  console.log('Findings', report.findings.length);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
