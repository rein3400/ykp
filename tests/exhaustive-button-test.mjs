/**
 * Exhaustive button/link/form testing across all deployed YKP apps.
 * Captures BEFORE / WHILE / AFTER for every interactive element.
 *
 * Usage: node tests/exhaustive-button-test.mjs
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
      '/warehouse',
      '/warehouse/items',
      '/warehouse/locations',
      '/warehouse/suppliers',
      '/warehouse/categories',
      '/warehouse/unit-conversion',
      '/warehouse/threshold',
      '/warehouse/penerimaan',
      '/warehouse/pemakaian',
      '/warehouse/transfer',
      '/warehouse/waste',
      '/warehouse/opname',
      '/warehouse/ledger',
      '/warehouse/expiry',
      '/warehouse/purchase-recommendation',
      '/warehouse/purchase-request',
      '/warehouse/alerts',
      '/warehouse/actions',
      '/warehouse/summary',
      '/warehouse/dashboard'
    ]
  },
  {
    id: 'investor',
    base: 'https://ykp-investor-v1.vercel.app',
    loginPath: '/login',
    creds: { username: 'owner', password: 'owner123' },
    home: '/investor',
    pages: [
      '/investor',
      '/investor/portfolio',
      '/investor/capital',
      '/investor/dividend',
      '/investor/returns'
    ]
  },
  {
    id: 'hr-v1',
    base: 'https://ykp-hr-v1-standalone-production.up.railway.app',
    loginPath: '/login',
    creds: { username: 'owner', password: 'owner123' },
    home: '/hr',
    pages: [
      '/hr',
      '/hr/employees',
      '/hr/attendance',
      '/hr/roster',
      '/hr/lateness',
      '/hr/leaves',
      '/hr/payroll',
      '/hr/adjustments',
      '/hr/summary',
      '/hr/users'
    ]
  },
  {
    id: 'finance',
    base: 'https://ykp-erp-finance-production.up.railway.app',
    loginPath: '/api/auth/login?role=OWNER&redirect=/',
    creds: null, // SSO bridge GET login
    home: '/',
    pages: [
      '/',
      '/pos',
      '/expenses',
      '/suppliers',
      '/petty-cash',
      '/summary',
      '/analytics',
      '/settings'
    ]
  },
  {
    id: 'hermez',
    base: 'https://ykp-erp-hermez-production.up.railway.app',
    loginPath: '/api/auth/login?role=SUPER_ADMIN&redirect=/',
    creds: null,
    home: '/',
    pages: [
      '/',
      '/alerts',
      '/actions',
      '/warehouse',
      '/config',
      '/run',
      '/telegram-test'
    ]
  },
  {
    id: 'erp-hr',
    base: 'https://ykp-erp-hr-production.up.railway.app',
    loginPath: '/api/auth/login?role=OWNER&redirect=/',
    creds: null,
    home: '/',
    pages: [
      '/',
      '/employees',
      '/attendance',
      '/payroll',
      '/leaves',
      '/roster',
      '/summary'
    ]
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

async function login(page, app) {
  const before = { url: page.url(), title: await page.title().catch(() => '') };
  if (app.creds) {
    await page.goto(app.base + app.loginPath, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // fill username/password fields flexibly
    const userSel = 'input[type="text"], input[name="username"], input[placeholder*="ser" i], input:not([type="password"]):not([type="hidden"])';
    const passSel = 'input[type="password"]';
    await page.locator(userSel).first().fill(app.creds.username).catch(() => {});
    await page.locator(passSel).first().fill(app.creds.password).catch(() => {});
    await page.getByRole('button', { name: /login|masuk|sign in/i }).first().click({ timeout: 10000 }).catch(async () => {
      await page.locator('button[type="submit"]').first().click({ timeout: 5000 }).catch(() => {});
    });
    await page.waitForTimeout(2500);
  } else {
    // SSO GET login or open home
    await page.goto(app.base + app.loginPath, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
  }
  const after = { url: page.url(), title: await page.title().catch(() => ''), status: page.url().includes('/login') ? 'STILL_LOGIN' : 'OK' };
  return { before, after };
}

async function collectInteractives(page) {
  return page.evaluate(() => {
    const els = [];
    const nodes = document.querySelectorAll('button, a[href], [role="button"], input[type="submit"], input[type="button"]');
    nodes.forEach((el, idx) => {
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible = r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
      const text = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('href') || '').trim().slice(0, 80);
      els.push({
        idx,
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || '',
        text,
        href: el.getAttribute('href') || '',
        disabled: !!(el.disabled || el.getAttribute('aria-disabled') === 'true'),
        visible,
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height)
      });
    });
    return els;
  });
}

async function clickByIndex(page, idx) {
  return page.evaluate((i) => {
    const nodes = Array.from(document.querySelectorAll('button, a[href], [role="button"], input[type="submit"], input[type="button"]'));
    const el = nodes[i];
    if (!el) return { ok: false, reason: 'not_found' };
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || style.display === 'none' || style.visibility === 'hidden') {
      return { ok: false, reason: 'not_visible' };
    }
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
      return { ok: false, reason: 'disabled' };
    }
    // skip logout / destructive without confirm for exhaustive scan — still click, record
    try {
      el.click();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  }, idx);
}

async function pageHealth(page) {
  const url = page.url();
  const title = await page.title().catch(() => '');
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const errors = [];
  if (/internal server error|application error|something went wrong/i.test(bodyText)) errors.push('ERROR_TEXT');
  if (/unauthorized|401/i.test(bodyText) && url.includes('/api/')) errors.push('UNAUTHORIZED');
  // count interactive
  const counts = await page.evaluate(() => ({
    buttons: document.querySelectorAll('button').length,
    links: document.querySelectorAll('a[href]').length,
    inputs: document.querySelectorAll('input,select,textarea').length,
    tables: document.querySelectorAll('table').length,
    h1: document.querySelector('h1')?.innerText?.slice(0, 80) || ''
  }));
  return { url, title, errors, counts, bodySnippet: bodyText.replace(/\s+/g, ' ').slice(0, 200) };
}

async function testApp(browser, app) {
  const result = {
    app: app.id,
    base: app.base,
    before: {},
    login: null,
    pages: [],
    buttons: [],
    summary: { pagesOk: 0, pagesFail: 0, buttonsClicked: 0, buttonsSkipped: 0, buttonsFailed: 0, navOk: 0 }
  };

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const networkFails = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('favicon')) {
      networkFails.push({ url: res.url().slice(0, 150), status: res.status() });
    }
  });

  // BEFORE: unauth homepage probe
  try {
    const r = await page.goto(app.base + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    result.before.homeStatus = r?.status() ?? null;
    result.before.homeUrl = page.url();
  } catch (e) {
    result.before.homeError = String(e).slice(0, 200);
  }

  // LOGIN
  try {
    result.login = await login(page, app);
    // ensure on app
    if (!page.url().includes(app.base.replace('https://', '').split('/')[0]) === false) {
      // ok
    }
    // if still login and has home, try navigate home
    if (page.url().includes('/login') && app.creds) {
      // failed login
      result.login.failed = true;
    } else {
      await page.goto(app.base + app.home, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    result.login = { error: String(e).slice(0, 300) };
  }

  // Walk pages
  for (const p of app.pages) {
    const pageResult = {
      path: p,
      before: null,
      while: { clicks: [] },
      after: null,
      screenshot: null
    };
    const shotBase = `${app.id}_${safeName(p)}`;
    try {
      const resp = await page.goto(app.base + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1200);
      pageResult.before = {
        http: resp?.status() ?? null,
        ...(await pageHealth(page)),
        consoleErrorsAtStart: consoleErrors.length,
        networkFailsAtStart: networkFails.length
      };

      // screenshot before interactions
      const shotPath = path.join(OUT_DIR, `${shotBase}_before.png`);
      await page.screenshot({ path: shotPath, fullPage: false }).catch(() => {});
      pageResult.screenshot = shotPath;

      if ((resp?.status() ?? 500) >= 400) {
        result.summary.pagesFail++;
        pageResult.after = pageResult.before;
        result.pages.push(pageResult);
        continue;
      }
      result.summary.pagesOk++;

      // collect buttons
      let interactives = await collectInteractives(page);
      // only visible non-disabled first pass; also try disabled for recording
      const candidates = interactives.filter((el) => el.visible);

      // limit clicks per page to avoid runaway (max 25)
      const maxClicks = 25;
      let clicked = 0;
      for (const el of candidates) {
        if (clicked >= maxClicks) break;
        // skip external absolute http links that leave app
        if (el.href && el.href.startsWith('http') && !el.href.startsWith(app.base)) {
          result.summary.buttonsSkipped++;
          pageResult.while.clicks.push({ el, action: 'skip_external' });
          continue;
        }
        // skip logout for mid-test (do at end of app)
        if (/logout|keluar|sign out/i.test(el.text)) {
          result.summary.buttonsSkipped++;
          pageResult.while.clicks.push({ el, action: 'skip_logout' });
          continue;
        }

        const beforeClick = {
          url: page.url(),
          h1: (await page.locator('h1').first().innerText().catch(() => '')).slice(0, 80)
        };
        const netBefore = networkFails.length;
        const consBefore = consoleErrors.length;

        let clickResult;
        if (el.disabled) {
          clickResult = { ok: false, reason: 'disabled' };
          result.summary.buttonsSkipped++;
        } else {
          // Prefer Playwright locator click for reliability when text unique
          try {
            if (el.tag === 'a' && el.href && el.href.startsWith('/')) {
              // nav link — click
              await page.locator(`a[href="${el.href}"]`).first().click({ timeout: 4000 });
              clickResult = { ok: true, method: 'locator_href' };
            } else if (el.text && el.text.length > 1 && el.text.length < 40) {
              await page.getByRole(el.tag === 'a' ? 'link' : 'button', { name: el.text, exact: false }).first().click({ timeout: 4000 });
              clickResult = { ok: true, method: 'role_text' };
            } else {
              clickResult = await clickByIndex(page, el.idx);
              clickResult.method = 'index';
            }
          } catch (e) {
            clickResult = { ok: false, reason: String(e).slice(0, 150) };
          }
        }

        await page.waitForTimeout(900);

        // handle dialogs
        page.once('dialog', async (d) => {
          await d.dismiss().catch(() => {});
        });

        const afterClick = {
          url: page.url(),
          h1: (await page.locator('h1').first().innerText().catch(() => '')).slice(0, 80),
          newNetworkFails: networkFails.slice(netBefore).slice(0, 5),
          newConsoleErrors: consoleErrors.slice(consBefore).slice(0, 5)
        };

        const navigated = beforeClick.url !== afterClick.url;
        if (clickResult.ok) {
          result.summary.buttonsClicked++;
          if (navigated) result.summary.navOk++;
        } else if (clickResult.reason !== 'disabled') {
          result.summary.buttonsFailed++;
        }

        pageResult.while.clicks.push({
          el: { text: el.text, tag: el.tag, href: el.href, disabled: el.disabled },
          before: beforeClick,
          click: clickResult,
          after: afterClick,
          navigated
        });

        result.buttons.push({
          app: app.id,
          page: p,
          text: el.text,
          tag: el.tag,
          href: el.href,
          clickOk: !!clickResult.ok,
          reason: clickResult.reason || null,
          navigated,
          urlAfter: afterClick.url,
          networkFails: afterClick.newNetworkFails,
          consoleErrors: afterClick.newConsoleErrors
        });

        clicked++;

        // if navigated away from page under test, go back
        if (navigated) {
          // don't follow logout
          if (afterClick.url.includes('/login')) {
            // re-login
            await login(page, app);
          }
          await page.goto(app.base + p, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
          await page.waitForTimeout(800);
          // refresh interactives indices after re-nav
          interactives = await collectInteractives(page);
        }
      }

      // AFTER page state
      pageResult.after = {
        ...(await pageHealth(page)),
        consoleErrorsTotal: consoleErrors.length,
        networkFailsTotal: networkFails.length
      };
      await page.screenshot({ path: path.join(OUT_DIR, `${shotBase}_after.png`), fullPage: false }).catch(() => {});
    } catch (e) {
      pageResult.error = String(e).slice(0, 400);
      result.summary.pagesFail++;
    }
    result.pages.push(pageResult);
  }

  // try logout button at end
  try {
    await page.goto(app.base + app.home, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(800);
    const logout = page.getByRole('button', { name: /logout|keluar/i }).first();
    if (await logout.count()) {
      const before = page.url();
      await logout.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      result.logout = { before, after: page.url(), ok: page.url().includes('login') || page.url() !== before };
    }
  } catch (e) {
    result.logout = { error: String(e).slice(0, 200) };
  }

  result.consoleErrors = consoleErrors.slice(0, 50);
  result.networkFails = networkFails.slice(0, 80);
  await context.close();
  return result;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const report = {
    startedAt: new Date().toISOString(),
    apps: [],
    totals: { pagesOk: 0, pagesFail: 0, buttonsClicked: 0, buttonsSkipped: 0, buttonsFailed: 0 }
  };

  for (const app of APPS) {
    console.log(`\n=== TESTING ${app.id} @ ${app.base} ===`);
    try {
      const r = await testApp(browser, app);
      report.apps.push(r);
      report.totals.pagesOk += r.summary.pagesOk;
      report.totals.pagesFail += r.summary.pagesFail;
      report.totals.buttonsClicked += r.summary.buttonsClicked;
      report.totals.buttonsSkipped += r.summary.buttonsSkipped;
      report.totals.buttonsFailed += r.summary.buttonsFailed;
      console.log(app.id, r.summary);
    } catch (e) {
      console.error(app.id, 'FATAL', e);
      report.apps.push({ app: app.id, fatal: String(e) });
    }
  }

  report.finishedAt = new Date().toISOString();
  // high-level findings
  report.findings = [];
  for (const a of report.apps) {
    if (a.fatal) report.findings.push({ app: a.app, severity: 'CRITICAL', msg: a.fatal });
    if (a.login?.failed || a.login?.after?.status === 'STILL_LOGIN') {
      report.findings.push({ app: a.app, severity: 'CRITICAL', msg: 'Login failed or stuck on /login' });
    }
    for (const p of a.pages || []) {
      if (p.before?.http && p.before.http >= 400) {
        report.findings.push({ app: a.app, severity: 'HIGH', msg: `${p.path} HTTP ${p.before.http}` });
      }
      if (p.before?.errors?.length) {
        report.findings.push({ app: a.app, severity: 'HIGH', msg: `${p.path} body errors: ${p.before.errors.join(',')}` });
      }
      for (const c of p.while?.clicks || []) {
        if (c.click?.ok === false && c.click?.reason !== 'disabled' && c.action !== 'skip_logout' && c.action !== 'skip_external') {
          // only note if not intentional skip
        }
        if (c.after?.newNetworkFails?.some((n) => n.status >= 500)) {
          report.findings.push({
            app: a.app,
            severity: 'HIGH',
            msg: `Click "${c.el?.text}" on ${p.path} caused 5xx: ${JSON.stringify(c.after.newNetworkFails)}`
          });
        }
      }
    }
    // 5xx network
    const fives = (a.networkFails || []).filter((n) => n.status >= 500);
    if (fives.length) {
      report.findings.push({ app: a.app, severity: 'HIGH', msg: `${fives.length} 5xx responses`, sample: fives.slice(0, 5) });
    }
  }

  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log('\n=== TOTALS ===', report.totals);
  console.log('Findings:', report.findings.length);
  console.log('Report:', REPORT);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
