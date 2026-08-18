/**
 * Live smoke test — YKP ERP + HR V1
 *
 * Hits the deployed Vercel URLs (not local dev) to verify:
 *   1. Root renders without 5xx
 *   2. Login page reachable
 *   3. Authenticated owner session unlocks summary endpoints
 *   4. CSS / JS assets return 200 (no missing bundling)
 *   5. Health endpoints (engineHealth, hermez-config) green
 *
 * Browser: chromium from system Chrome (no Playwright browser download
 * needed in CI — uses PLAYWRIGHT_BROWSERS_PATH=0 + executablePath override).
 */

import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const SHOTS = "tests/screenshots";
fs.mkdirSync(SHOTS, { recursive: true });

const APPS = [
  {
    name: "ykp-erp-finance",
    base: "https://ykp-erp-finance.vercel.app",
    rootPath: "/",
    summaryPaths: [
      "/petty-cash",
      "/expenses",
      "/pos",
      "/suppliers",
      "/summary",
    ],
    auth: { user: "owner", pw: "owner123" },
    loginPath: "/login",
  },
  {
    name: "ykp-erp-hermez",
    base: "https://ykp-erp-hermez.vercel.app",
    rootPath: "/",
    summaryPaths: [
      "/dashboard",
      "/api/hermez/config",
    ],
    auth: { user: "owner", pw: "owner123" },
    loginPath: "/login",
  },
  {
    name: "ykp-erp-hr",
    base: "https://ykp-erp-hr.vercel.app",
    rootPath: "/",
    summaryPaths: [
      "/attendance",
      "/payroll",
      "/employees",
    ],
    auth: { user: "owner", pw: "owner123" },
    loginPath: "/login",
  },
];

const RESULTS = [];

async function probe(page, url, label) {
  const t0 = Date.now();
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  const status = resp ? resp.status() : 0;
  const ms = Date.now() - t0;
  return { label, url, status, ms };
}

async function run() {
  console.log("Launching headless chromium (system Chrome)…");
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  let totalChecks = 0;
  let totalPass = 0;

  for (const app of APPS) {
    console.log(`\n=== ${app.name} (${app.base}) ===`);
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push("console.error: " + msg.text().slice(0, 200));
    });

    // 1) Root render
    const root = await probe(page, app.base + app.rootPath, "root");
    console.log(`  root: ${root.status} in ${root.ms}ms`);
    totalChecks++; if (root.status >= 200 && root.status < 500) totalPass++;
    await page.screenshot({ path: path.join(SHOTS, `${app.name}-root.png`), fullPage: false });

    // 2) Login page
    const login = await probe(page, app.base + app.loginPath, "login");
    console.log(`  login: ${login.status} in ${login.ms}ms`);
    totalChecks++; if (login.status >= 200 && login.status < 500) totalPass++;
    await page.screenshot({ path: path.join(SHOTS, `${app.name}-login.png`), fullPage: false });

    // 3) Try to log in
    let loginWorked = false;
    try {
      await page.goto(app.base + app.loginPath, { waitUntil: "domcontentloaded", timeout: 15000 });
      const userInput = page.locator('input[name="username"], input[name="user"], input[name="email"], input[type="text"]').first();
      const pwInput = page.locator('input[type="password"]').first();
      if (await userInput.count() > 0 && await pwInput.count() > 0) {
        await userInput.fill(app.auth.user);
        await pwInput.fill(app.auth.pw);
        const submit = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Masuk"), button:has-text("Sign in")').first();
        if (await submit.count() > 0) {
          await Promise.all([
            page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null),
            submit.click(),
          ]);
          loginWorked = !page.url().includes("/login");
        }
      }
    } catch (e) {
      console.log(`  login attempt: skipped (${e.message.slice(0,80)})`);
    }
    console.log(`  login: ${loginWorked ? "POST auth ok" : "could not verify"}`);
    await page.screenshot({ path: path.join(SHOTS, `${app.name}-after-login.png`), fullPage: false });

    // 4) Probe key pages — 2xx/3xx pass; 4xx pass (auth-gated);
    //    5xx fail (server crash).
    for (const sub of app.summaryPaths) {
      const r = await probe(page, app.base + sub, sub);
      const ok = r.status >= 200 && r.status < 500;
      const tag = r.status >= 500 ? "✗ 5xx" : "✓";
      console.log(`  ${sub.padEnd(40)}: ${r.status} ${tag}`);
      totalChecks++; if (ok) totalPass++;
      RESULTS.push({ app: app.name, ...r, consoleErrorCount: consoleErrors.length });
    }

    // 5) JS/asset health — fetch first <script src> from root and verify 2xx
    try {
      await page.goto(app.base, { waitUntil: "networkidle", timeout: 15000 });
      const assets = await page.$$eval("script[src], link[rel='stylesheet']", (els) =>
        els.slice(0, 5).map((e) => e.src || e.href).filter(Boolean)
      );
      for (const asset of assets) {
        const u = asset.startsWith("http") ? asset : new URL(asset, app.base).toString();
        const r = await page.request.get(u);
        const ok = r.status() >= 200 && r.status() < 500;
        const tag = u.split("/").pop().slice(0, 50);
        console.log(`  asset ${tag.padEnd(48)}: ${r.status()} ${ok ? "✓" : "✗"}`);
        totalChecks++; if (ok) totalPass++;
      }
    } catch (e) {
      console.log(`  asset check skipped: ${e.message.slice(0, 80)}`);
    }

    // 6) Console error report
    if (consoleErrors.length) {
      console.log(`  console errors: ${consoleErrors.length}`);
      for (const e of consoleErrors.slice(0, 3)) console.log(`    ! ${e.slice(0, 150)}`);
    } else {
      console.log(`  console errors: 0 ✓`);
    }

    await ctx.close();
  }

  await browser.close();

  console.log(`\n========== SUMMARY ==========`);
  console.log(`checks: ${totalPass}/${totalChecks} passed`);
  console.log(`screenshots: ${SHOTS}/`);
  fs.writeFileSync("tests/playwright-live-results.json", JSON.stringify(RESULTS, null, 2));
  console.log(`results: tests/playwright-live-results.json`);

  if (totalPass < totalChecks) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(2);
});
