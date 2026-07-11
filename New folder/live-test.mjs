/**
 * YKP Hermez AI Command Center — live manual Playwright test
 *
 * Tujuan: bug fixing & penyempurnaan. Test 5 URL Railway secara manual
 * satu-per-satu, capture proses pengujian + after pengujian.
 *
 * 4 DB-backed apps (Finance/Hermez/HR/HR V1) + Hub exempt (portal only).
 * Login owner/owner123, hit DB-backed routes, capture screenshot + HAR-like
 * step log. Output JSON report ke New folder/live-test-report.json.
 *
 * Browser: system Chrome via playwright-core (no download needed).
 */

import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const ROOT = "D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER/New folder";
const SHOTS = path.join(ROOT, "screens");
fs.mkdirSync(SHOTS, { recursive: true });

const CHROME = "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe";

const APPS = [
  {
    name: "finance",
    base: "https://ykp-erp-finance-production.up.railway.app",
    loginPath: "/login",
    loginType: "role-select", // role picker, no password
    auth: { user: "owner", pw: "owner123", role: "OWNER" },
    cookieNames: ["ykp_session"],
    ssoRole: "OWNER", // Hub→ERP SSO bridge: GET /api/auth/login?role=OWNER&redirect=/
    dbRoutes: [
      { path: "/", label: "dashboard root" },
      { path: "/petty-cash", label: "petty cash list (DB)" },
      { path: "/expenses", label: "expenses list (DB)" },
      { path: "/pos", label: "POS sessions (DB)" },
      { path: "/suppliers", label: "suppliers (DB)" },
      { path: "/summary", label: "finance summary (DB aggregate)" },
      { path: "/api/fin/summary", label: "finance summary API (JSON)" },
      { path: "/api/fin/petty-cash", label: "petty cash API (JSON)" },
      { path: "/api/fin/supplier", label: "supplier API (JSON)" },
    ],
  },
  {
    name: "hermez",
    base: "https://ykp-erp-hermez-production.up.railway.app",
    loginPath: "/login",
    loginType: "role-select",
    auth: { user: "owner", pw: "owner123", role: "SUPER_ADMIN" },
    cookieNames: ["ykp_session"],
    ssoRole: "SUPER_ADMIN", // Hub→ERP SSO bridge (Hermez API needs SUPER_ADMIN)
    dbRoutes: [
      { path: "/", label: "brief root (read-only)" },
      { path: "/alerts", label: "hermez alerts log" },
      { path: "/config", label: "hermez config" },
      { path: "/run", label: "hermez run console" },
      { path: "/telegram-test", label: "hermez telegram test" },
      { path: "/api/hermez/config", label: "hermez config API (JSON)" },
      { path: "/api/hermez/brief", label: "hermez brief API (JSON)" },
      { path: "/api/hermez/alerts", label: "hermez alerts API (JSON)" },
    ],
  },
  {
    name: "hr",
    base: "https://ykp-erp-hr-production.up.railway.app",
    loginPath: "/login",
    loginType: "role-select",
    auth: { user: "owner", pw: "owner123", role: "OWNER" },
    cookieNames: ["ykp_session"],
    ssoRole: "OWNER", // Hub→ERP SSO bridge
    dbRoutes: [
      { path: "/", label: "dashboard root" },
      { path: "/attendance", label: "attendance (DB)" },
      { path: "/payroll", label: "payroll (DB)" },
      { path: "/employees", label: "employees (DB)" },
      { path: "/api/hr/summary", label: "hr summary API (JSON)" },
    ],
  },
  {
    name: "hr-v1",
    base: "https://ykp-hr-v1-standalone-production.up.railway.app",
    loginPath: "/login",
    loginType: "userpass-noattr", // inputs w/o name/id, fill by position
    auth: { user: "owner", pw: "owner123" },
    cookieNames: ["ykp_hr_session"],
    dbRoutes: [
      { path: "/", label: "dashboard root" },
      { path: "/hr/employees", label: "employees (Sheets)" },
      { path: "/hr/attendance", label: "attendance (Sheets)" },
      { path: "/hr/payroll", label: "payroll (Sheets)" },
      { path: "/api/hr/summary", label: "hr summary API (Sheets JSON)" },
    ],
  },
  {
    name: "hub",
    base: "https://ykp-hub-production.up.railway.app",
    loginPath: "/", // form lives at root, not /login
    loginType: "hub-local", // client-side: POST /api/auth/login + localStorage
    auth: { user: "owner", pw: "owner123" },
    cookieNames: [], // hub uses localStorage ykp_hub_session, no cookie
    dbRoutes: [
      { path: "/", label: "hub portal (exempt — no DB)" },
    ],
  },
];

function ts() {
  return new Date().toISOString();
}

async function loginIfPossible(page, app, log) {
  if (!app.loginPath || !app.auth) return { skipped: true };
  const url = app.base + app.loginPath;
  log.push({ step: "login-start", url, loginType: app.loginType, ts: ts() });
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  log.push({ step: "login-page", status: resp?.status(), ts: ts() });
  await page.screenshot({ path: path.join(SHOTS, app.name, "01-login-page.png"), fullPage: true });

  try {
    const submitBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Masuk")').first();

    if (app.loginType === "role-select") {
      // Role-picker login (Finance/Hermez/HR): POST /api/auth/login directly via page.evaluate
      // (most reliable — bypasses React controlled-select onChange quirks).
      await page.screenshot({ path: path.join(SHOTS, app.name, "02-login-filled.png"), fullPage: true });
      const loginResult = await page.evaluate(async (role) => {
        const r = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role }),
        });
        return { ok: r.ok, status: r.status };
      }, app.auth.role);
      log.push({ step: "login-api-response", ...loginResult, ts: ts() });
      if (loginResult.ok) {
        await page.goto(app.base + "/", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
      }
    } else if (app.loginType === "userpass-noattr") {
      // HR V1: inputs w/o name/id. Fill by position: 1st text input = username, 1st password input = pw.
      const pwInput = page.locator('input[type="password"]').first();
      await pwInput.waitFor({ state: "visible", timeout: 8000 });
      const textInputs = page.locator('input:not([type="password"]):not([type="hidden"]):not([type="submit"])');
      const uInput = textInputs.first();
      await uInput.fill(app.auth.user);
      await pwInput.fill(app.auth.pw);
      log.push({ step: "login-credentials-filled", user: app.auth.user, ts: ts() });
      await page.screenshot({ path: path.join(SHOTS, app.name, "02-login-filled.png"), fullPage: true });
      // HR V1 login = POST /api/auth/login (server-side cookie). Wait for nav away from /login.
      const navAway = page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20000 }).catch(() => null);
      await submitBtn.click().catch(async () => {
        await pwInput.press("Enter");
      });
      await navAway;
    } else if (app.loginType === "hub-local") {
      // Hub: client-side login. POST /api/auth/login, then persist to localStorage (ykp_hub_session).
      await page.screenshot({ path: path.join(SHOTS, app.name, "02-login-filled.png"), fullPage: true });
      const loginResult = await page.evaluate(async ({ user, pw }) => {
        const r = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: user, password: pw }),
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok && data?.data) {
          localStorage.setItem(
            "ykp_hub_session",
            JSON.stringify({ username: data.data.username, role: data.data.role, ts: new Date().toISOString() }),
          );
        }
        return { ok: r.ok, status: r.status, data };
      }, { user: app.auth.user, pw: app.auth.pw });
      log.push({ step: "login-api-response", ...loginResult, ts: ts() });
      if (loginResult.ok) {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
      }
    }

    await page.waitForTimeout(2500);
    const landedUrl = page.url();
    // Verify session marker: cookie for server-auth apps, localStorage for hub (client portal).
    const cookies = await page.context().cookies();
    const cookieNames = app.cookieNames || ["ykp_session"];
    const sessionCookie = cookies.find((c) => cookieNames.includes(c.name));
    let hubLocalSession = null;
    if (app.name === "hub") {
      hubLocalSession = await page.evaluate(() => localStorage.getItem("ykp_hub_session"));
    }
    const authed = !!sessionCookie || !!hubLocalSession;
    log.push({ step: "login-submit", status: "submitted", url: landedUrl, hasSessionCookie: !!sessionCookie, hasHubLocal: !!hubLocalSession, authed, ts: ts() });
    await page.screenshot({ path: path.join(SHOTS, app.name, "03-after-login.png"), fullPage: true });
    // detect login error text on page
    const bodyText = (await page.evaluate(() => document?.body?.innerText ?? "")).toLowerCase();
    const loginErr = /invalid|wrong|failed|incorrect|denied|error/.test(bodyText) && landedUrl.includes("/login") && !authed;
    return { skipped: false, landedUrl, hasSessionCookie: !!sessionCookie, hasHubLocal: !!hubLocalSession, authed, loginError: loginErr };
  } catch (e) {
    log.push({ step: "login-error", error: String(e).slice(0, 200), ts: ts() });
    await page.screenshot({ path: path.join(SHOTS, app.name, "03-login-error.png"), fullPage: true }).catch(() => {});
    return { skipped: false, error: String(e).slice(0, 200) };
  }
}

async function probeRoute(page, app, route, log) {
  const url = app.base + route.path;
  const t0 = Date.now();
  let status = 0,
    size = 0,
    err = null,
    bodySnippet = "";
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    status = resp?.status() ?? 0;
    // Finance/HR UI pages are client components that fetch via TanStack Query
    // AFTER hydration. Wait for the API fetch to settle so the screenshot
    // captures populated data, not the "Memuat..."/"Rp 0" initial state.
    if (!route.path.startsWith("/api/")) {
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    size = (await page.content()).length;
    // capture visible text snippet for DB evidence
    const text = await page.evaluate(() => document?.body?.innerText?.slice(0, 600) ?? "");
    bodySnippet = text.replace(/\s+/g, " ").slice(0, 400);
  } catch (e) {
    err = String(e).slice(0, 200);
  }
  const ms = Date.now() - t0;
  const shot = path.join(SHOTS, app.name, `route-${route.path.replace(/[^a-z0-9]/gi, "_") || "root"}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  const entry = {
    step: "route",
    label: route.label,
    path: route.path,
    url,
    status,
    ms,
    size,
    error: err,
    bodySnippet,
    shot: path.relative(ROOT, shot).replace(/\\/g, "/"),
    ts: ts(),
  };
  log.push(entry);
  return entry;
}

async function runApp(browser, app) {
  const log = [];
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  log.push({ step: "app-start", name: app.name, base: app.base, ts: ts() });

  // 1. root probe (no auth)
  const rootResp = await page.goto(app.base, { waitUntil: "domcontentloaded", timeout: 30000 }).catch((e) => ({ status: () => 0, error: String(e).slice(0, 200) }));
  const rootStatus = rootResp?.status?.() ?? 0;
  const rootFinalUrl = page.url();
  log.push({ step: "root-probe", url: app.base, status: rootStatus, finalUrl: rootFinalUrl, ts: ts() });
  await page.screenshot({ path: path.join(SHOTS, app.name, "00-root.png"), fullPage: true }).catch(() => {});

  // 2. login
  const loginResult = await loginIfPossible(page, app, log);

  // 3. DB-backed routes
  const routes = [];
  for (const r of app.dbRoutes) {
    routes.push(await probeRoute(page, app, r, log));
  }

  // 4. final after screenshot
  await page.screenshot({ path: path.join(SHOTS, app.name, "99-after-all.png"), fullPage: true }).catch(() => {});

  // 5. SSO bridge test (role-picker apps only: finance/hr/hermez).
  //    Simulate Hub opening the app: fresh context (no cookie) → hit
  //    /api/auth/login?role=<hubRole>&redirect=/ → should set ykp_session
  //    cookie + 302 to "/". Verifies the Hub→ERP auto-login flow works.
  let ssoBridge = null;
  if (app.ssoRole) {
    try {
      const ssoCtx = await browser.newContext({ viewport: { width: 1366, height: 900 }, ignoreHTTPSErrors: true });
      const ssoPage = await ssoCtx.newPage();
      const ssoUrl = `${app.base}/api/auth/login?role=${encodeURIComponent(app.ssoRole)}&redirect=/`;
      log.push({ step: "sso-start", url: ssoUrl, ts: ts() });
      await ssoPage.goto(ssoUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await ssoPage.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await ssoPage.waitForTimeout(1000);
      const landed = ssoPage.url();
      const cookies = await ssoCtx.cookies();
      const sessionCookie = cookies.find((c) => c.name === "ykp_session");
      const bodyText = (await ssoPage.evaluate(() => document?.body?.innerText?.slice(0, 300) ?? "")).replace(/\s+/g, " ").slice(0, 200);
      await ssoPage.screenshot({ path: path.join(SHOTS, app.name, "04-sso-bridge.png"), fullPage: true }).catch(() => {});
      ssoBridge = { url: ssoUrl, landedUrl: landed, hasSessionCookie: !!sessionCookie, bodySnippet: bodyText, ok: !!sessionCookie && landed.replace(/\/$/, "") === app.base.replace(/\/$/, "") };
      log.push({ step: "sso-result", ...ssoBridge, ts: ts() });
      await ssoCtx.close();
    } catch (e) {
      ssoBridge = { error: String(e).slice(0, 200) };
      log.push({ step: "sso-error", error: String(e).slice(0, 200), ts: ts() });
    }
  }

  log.push({ step: "app-end", name: app.name, ts: ts() });

  await ctx.close();
  return {
    name: app.name,
    base: app.base,
    rootStatus,
    rootFinalUrl,
    loginResult,
    routes,
    ssoBridge,
    log,
  };
}

async function main() {
  console.log(`[${ts()}] Launching system Chrome headless…`);
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  const report = { startedAt: ts(), apps: [] };
  for (const app of APPS) {
    console.log(`\n[${ts()}] === ${app.name} === ${app.base}`);
    try {
      const r = await runApp(browser, app);
      report.apps.push(r);
      console.log(`  root: ${r.rootStatus} → ${r.rootFinalUrl}`);
      console.log(`  login: ${JSON.stringify(r.loginResult)}`);
      if (r.ssoBridge) console.log(`  sso: ${JSON.stringify(r.ssoBridge)}`);
      for (const rt of r.routes) {
        console.log(`  ${rt.status} ${rt.ms}ms ${rt.path} — ${rt.label}${rt.error ? " ERR=" + rt.error : ""}`);
      }
    } catch (e) {
      console.error(`  FATAL ${app.name}:`, String(e).slice(0, 300));
      report.apps.push({ name: app.name, base: app.base, fatal: String(e).slice(0, 500) });
    }
  }

  report.finishedAt = ts();
  await browser.close();

  const out = path.join(ROOT, "live-test-report.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\n[${ts()}] Report written: ${out}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});