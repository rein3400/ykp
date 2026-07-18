/**
 * Playwright: Warehouse telegram pipeline (read-only).
 *
 * sendTelegram() in ykp-warehouse-v1 is currently dead code — no route/worker
 * calls it. Alerts are stamped telegram_status=QUEUED but never sent.
 * This test verifies:
 *  1. Standalone login works
 *  2. /api/warehouse/summary 200
 *  3. /api/warehouse/alerts returns 200 (document QUEUED candidates if any)
 *  4. Explicit report field send_wired: false
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const WAREHOUSE = "https://ykp-warehouse-v1.vercel.app";
const OUT = path.resolve("tests/playwright-warehouse-telegram");
fs.mkdirSync(OUT, { recursive: true });

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const shot = async (page, name) => {
  const file = path.join(OUT, `${String(++shot.i).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  log(`📸 ${path.basename(file)}`);
};
shot.i = 0;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const results = {
    ok: false,
    send_wired: false,
    loginOk: false,
    summaryStatus: null,
    alertsHighStatus: null,
    alertsCriticalStatus: null,
    queuedHigh: 0,
    queuedCritical: 0,
    error: null,
  };

  try {
    log("1. Open warehouse root ...");
    await page.goto(WAREHOUSE, { waitUntil: "networkidle" });
    await shot(page, "warehouse-root");

    // Standalone login (not Hub SSO)
    log("2. Login POST /api/auth/login ...");
    const login = await page.evaluate(async (url) => {
      const res = await fetch(`${url}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "owner", password: "owner123" }),
        credentials: "include",
      });
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = await res.text();
      }
      return { status: res.status, body };
    }, WAREHOUSE);
    results.loginOk = login.status >= 200 && login.status < 300;
    log(`   login status=${login.status}`);
    if (!results.loginOk) {
      // try form login if API shape differs
      log("   API login failed — try UI form if present");
      const user = page.locator("input[autocomplete='username'], input[name='username'], input[type='text']").first();
      const pass = page.locator("input[autocomplete='current-password'], input[name='password'], input[type='password']").first();
      if ((await user.count()) > 0 && (await pass.count()) > 0) {
        await user.fill("owner");
        await pass.fill("owner123");
        await page.locator("button[type='submit']").first().click().catch(async () => {
          await page.locator("button:has-text('Login'), button:has-text('Masuk')").first().click();
        });
        await page.waitForTimeout(2000);
        results.loginOk = true;
      }
    }
    await shot(page, "after-login");

    log("3. GET /api/warehouse/summary ...");
    const summary = await page.evaluate(async (url) => {
      const res = await fetch(`${url}/api/warehouse/summary`, { credentials: "include" });
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, hasData: Boolean(body?.data ?? body) };
    }, WAREHOUSE);
    results.summaryStatus = summary.status;
    log(`   summary status=${summary.status} hasData=${summary.hasData}`);

    log("4. GET /api/warehouse/alerts HIGH/CRITICAL ...");
    const high = await page.evaluate(async (url) => {
      const res = await fetch(`${url}/api/warehouse/alerts?severity=HIGH`, { credentials: "include" });
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      const items = body?.data?.items ?? body?.items ?? body?.data ?? [];
      const arr = Array.isArray(items) ? items : [];
      const queued = arr.filter((a) => a?.telegram_status === "QUEUED").length;
      return { status: res.status, total: arr.length, queued };
    }, WAREHOUSE);
    results.alertsHighStatus = high.status;
    results.queuedHigh = high.queued;
    log(`   HIGH status=${high.status} total=${high.total} queued=${high.queued}`);

    const crit = await page.evaluate(async (url) => {
      const res = await fetch(`${url}/api/warehouse/alerts?severity=CRITICAL`, { credentials: "include" });
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      const items = body?.data?.items ?? body?.items ?? body?.data ?? [];
      const arr = Array.isArray(items) ? items : [];
      const queued = arr.filter((a) => a?.telegram_status === "QUEUED").length;
      return { status: res.status, total: arr.length, queued };
    }, WAREHOUSE);
    results.alertsCriticalStatus = crit.status;
    results.queuedCritical = crit.queued;
    log(`   CRITICAL status=${crit.status} total=${crit.total} queued=${crit.queued}`);

    // Pass criteria: login + summary 200 + alerts endpoints 200 (pipeline readable)
    // send_wired remains false — intentional documentation of dead code
    results.ok =
      results.loginOk &&
      results.summaryStatus === 200 &&
      results.alertsHighStatus === 200 &&
      results.alertsCriticalStatus === 200;

    await shot(page, "final");
  } catch (e) {
    results.error = e instanceof Error ? e.message : String(e);
    log(`ERROR: ${results.error}`);
    await shot(page, "error").catch(() => {});
  }

  fs.writeFileSync(
    path.join(OUT, "report.json"),
    JSON.stringify({ ts: new Date().toISOString(), results }, null, 2),
  );
  await browser.close();
  log(
    `\nRESULT: ok=${results.ok} send_wired=${results.send_wired} summary=${results.summaryStatus} queuedH=${results.queuedHigh} queuedC=${results.queuedCritical}`,
  );
  process.exit(results.ok ? 0 : 1);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
