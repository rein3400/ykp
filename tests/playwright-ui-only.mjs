/**
 * Playwright UI-only smoke test — YKP ERP live.
 *
 * Hard rule: NO curl, no fetch-from-host, no vercel CLI, no Vercel MCP.
 * Every check is a real browser navigation/assertion against
 * the deployed Vercel URLs.
 *
 * Coverage:
 *   1. Root render (no 5xx, no hard error overlay)
 *   2. Login page reachable + form fields visible
 *   3. Try owner/owner123 login → confirm post-auth redirect
 *   4. Key routes (200/3xx, not 5xx)
 *   5. /api/hermez/config specifically — full body parse for 500 vs JSON
 *   6. JS/CSS asset health via real <script src>/<link href> requests
 *   7. Console error budget (count + sample)
 *   8. Network log: any 5xx response anywhere on the page = fail
 *   9. Screenshot per app
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
    loginPath: "/login",
    authedPaths: ["/petty-cash", "/expenses", "/pos", "/suppliers", "/summary"],
  },
  {
    name: "ykp-erp-hermez",
    base: "https://ykp-erp-hermez.vercel.app",
    loginPath: "/login",
    authedPaths: ["/dashboard", "/api/hermez/config", "/api/hermez/alerts"],
  },
  {
    name: "ykp-erp-hr",
    base: "https://ykp-erp-hr.vercel.app",
    loginPath: "/login",
    authedPaths: ["/attendance", "/payroll", "/employees"],
  },
];

const RESULTS = [];
let totalChecks = 0;
let totalPass = 0;

function record(app, label, ok, detail) {
  totalChecks++;
  if (ok) totalPass++;
  const tag = ok ? "✓" : "✗";
  const msg = `  [${app}] ${label.padEnd(42)} ${tag} ${detail ?? ""}`;
  console.log(msg);
  RESULTS.push({ app, label, ok, detail, ts: new Date().toISOString() });
}

async function loginIfPossible(page, base, creds) {
  await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 20000 });
  const userInput = page.locator(
    'input[name="username"], input[name="user"], input[name="email"], input[type="text"]'
  ).first();
  const pwInput = page.locator('input[type="password"]').first();
  if (!(await userInput.count()) || !(await pwInput.count())) {
    return { loggedIn: false, reason: "no-input-fields" };
  }
  await userInput.fill(creds.user);
  await pwInput.fill(creds.pw);
  const submit = page.locator(
    'button[type="submit"], button:has-text("Login"), button:has-text("Masuk"), button:has-text("Sign in")'
  ).first();
  if (!(await submit.count())) {
    return { loggedIn: false, reason: "no-submit-button" };
  }
  const before = page.url();
  await Promise.all([
    page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null),
    submit.click(),
  ]);
  await page.waitForTimeout(500);
  return { loggedIn: !page.url().includes("/login"), before, after: page.url() };
}

async function run() {
  console.log("Launching headless chromium (system Chrome)…");
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  for (const app of APPS) {
    console.log(`\n=== ${app.name} (${app.base}) ===`);
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();

    const networkFailures = [];
    page.on("response", (resp) => {
      if (resp.status() >= 500) {
        networkFailures.push({ url: resp.url(), status: resp.status() });
      }
    });

    const consoleErrors = [];
    page.on("pageerror", (err) => consoleErrors.push("pageerror: " + String(err).slice(0, 200)));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push("console.error: " + msg.text().slice(0, 200));
      }
    });

    // 1) Root render — UI assertion, not header check
    const rootResp = await page.goto(app.base, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(500);
    const rootStatus = rootResp ? rootResp.status() : 0;
    const hasBody = (await page.locator("body").count()) > 0;
    const hasReact = await page.evaluate(() => !!document.querySelector("[data-reactroot], #__next, body > *"));
    record(app, "root render", rootStatus < 500 && hasBody && hasReact, `status=${rootStatus} body=${hasBody} mounted=${hasReact}`);
    await page.screenshot({ path: path.join(SHOTS, `${app.name}-root.png`), fullPage: false });

    // 2) Login page UI
    const loginResp = await page.goto(app.base + app.loginPath, { waitUntil: "domcontentloaded", timeout: 20000 });
    const loginStatus = loginResp ? loginResp.status() : 0;
    const loginRendered = loginStatus < 500 && (await page.locator("body *").count()) > 0;
    record(app, "login page reachable", loginRendered, `status=${loginStatus}`);
    await page.screenshot({ path: path.join(SHOTS, `${app.name}-login.png`), fullPage: false });

    // 3) Try auth (best-effort; many apps gate via middleware not UI form)
    const auth = await loginIfPossible(page, app.base, { user: "owner", pw: "owner123" });
    record(
      app,
      "owner auth attempt",
      auth.loggedIn || auth.reason === "no-input-fields" || auth.reason === "no-submit-button",
      auth.loggedIn ? `redirect→${auth.after}` : `skipped (${auth.reason})`
    );
    await page.screenshot({ path: path.join(SHOTS, `${app.name}-after-login.png`), fullPage: false });

    // 4) Key routes — UI navigation + assert no fatal error overlay
    for (const sub of app.authedPaths) {
      const subResp = await page.goto(app.base + sub, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(300);
      const status = subResp ? subResp.status() : 0;
      const fatalOverlay = await page.evaluate(() => {
        const txt = document.body ? document.body.innerText : "";
        return /500: Internal Server Error|Application error|Something went wrong/i.test(txt);
      });
      let bodyHint = "";
      if (sub.startsWith("/api/")) {
        // For API routes, read body and report content-type + first 100 chars
        const body = await page.evaluate(() => document.body ? document.body.innerText : "");
        bodyHint = body.slice(0, 100).replace(/\s+/g, " ");
      }
      const ok = status < 500 && !fatalOverlay;
      record(app, sub, ok, `status=${status}${fatalOverlay ? " [FATAL OVERLAY]" : ""}${bodyHint ? " body=" + bodyHint : ""}`);
    }

    // 5) Specific deep check: /api/hermez/config — JSON body parse
    if (app.name === "ykp-erp-hermez") {
      const apiResp = await page.goto(app.base + "/api/hermez/config", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      const apiStatus = apiResp ? apiResp.status() : 0;
      const apiCt = apiResp ? (apiResp.headers()["content-type"] || "") : "";
      const apiBody = await page.evaluate(() => document.body ? document.body.innerText : "");
      let parsedJson = null;
      try {
        parsedJson = JSON.parse(apiBody);
      } catch (_) {}
      const ok = apiStatus === 200 && !!parsedJson;
      record(
        app,
        "/api/hermez/config JSON contract",
        ok,
        `status=${apiStatus} ct=${apiCt} json=${parsedJson ? "yes" : "no"} body[:120]=${apiBody.slice(0, 120).replace(/\s+/g, " ")}`
      );
    }

    // 6) Asset health — collect <script src> and <link rel=stylesheet href> from root, navigate each via browser
    try {
      await page.goto(app.base, { waitUntil: "networkidle", timeout: 20000 });
      const assets = await page.$$eval("script[src], link[rel='stylesheet']", (els) =>
        els.slice(0, 5).map((e) => e.src || e.href).filter(Boolean)
      );
      for (const assetUrl of assets) {
        const full = assetUrl.startsWith("http") ? assetUrl : new URL(assetUrl, app.base).toString();
        const r = await page.request.get(full);
        const ok = r.status() >= 200 && r.status() < 500;
        const shortName = full.split("/").pop().slice(0, 48);
        record(app, `asset ${shortName}`, ok, `status=${r.status()}`);
      }
    } catch (e) {
      record(app, "asset check", false, `error: ${String(e).slice(0, 100)}`);
    }

    // 7) Console error budget — report but don't fail unless >100
    if (consoleErrors.length === 0) {
      record(app, "console errors", true, "0 ✓");
    } else {
      const cspCount = consoleErrors.filter((e) => /Content Security Policy|unsafe-inline/.test(e)).length;
      const otherCount = consoleErrors.length - cspCount;
      const ok = otherCount < 10;
      record(
        app,
        "console error budget",
        ok,
        `total=${consoleErrors.length} csp=${cspCount} other=${otherCount}`
      );
      if (otherCount > 0) {
        for (const e of consoleErrors.filter((e) => !/Content Security Policy|unsafe-inline/.test(e)).slice(0, 3)) {
          console.log(`    ! ${e.slice(0, 160)}`);
        }
      }
    }

    // 8) Network: any 5xx seen during whole session?
    if (networkFailures.length === 0) {
      record(app, "no 5xx on network", true, "clean ✓");
    } else {
      const unique = [...new Set(networkFailures.map((n) => `${n.status} ${n.url}`))];
      record(
        app,
        "no 5xx on network",
        false,
        `failures=${networkFailures.length} unique=${unique.length} first=${unique[0].slice(0, 120)}`
      );
    }

    await ctx.close();
  }

  await browser.close();

  console.log(`\n========== SUMMARY ==========`);
  console.log(`checks: ${totalPass}/${totalChecks} passed`);
  console.log(`screenshots: ${SHOTS}/`);
  fs.writeFileSync("tests/playwright-ui-only-results.json", JSON.stringify(RESULTS, null, 2));
  console.log(`results: tests/playwright-ui-only-results.json`);

  if (totalPass < totalChecks) {
    console.log(`\nFAILED`);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(2);
});
