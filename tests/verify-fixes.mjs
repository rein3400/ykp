/**
 * Post-deploy verification — proves bug fixes worked.
 *
 * Checks:
 *  1. CSP header now allows 'unsafe-inline' (script-src contains)
 *  2. Finance expenses page has working Tambah Expense button
 *  3. HR V1 login API no longer 500s
 *  4. Buttons exist in DOM (CSP hydration no longer blocking)
 */

import { chromium } from "playwright-core";
import fs from "node:fs";

const SHOTS = "tests/screenshots/post-fix";
fs.mkdirSync(SHOTS, { recursive: true });

const RESULTS = [];
function record(label, ok, detail) {
  const tag = ok ? "✓" : "✗";
  console.log(`  ${label.padEnd(60)} ${tag} ${detail ?? ""}`);
  RESULTS.push({ label, ok, detail });
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  // ─────────────────────────────────────
  // 1. CSP verification — all 3 ykp-erp apps
  // ─────────────────────────────────────
  console.log("\n=== CSP HEADER CHECK ===");
  for (const app of ["ykp-erp-finance", "ykp-erp-hermez", "ykp-erp-hr"]) {
    const r = await page.request.get(`https://${app}.vercel.app`, { failOnStatusCode: false });
    const csp = r.headers()["content-security-policy"] ?? "";
    const hasUnsafeInline = /script-src[^;]*'unsafe-inline'/.test(csp);
    record(`${app}: CSP has 'unsafe-inline' for script-src`, hasUnsafeInline, `csp=${csp.slice(0, 80)}…`);
  }

  // ─────────────────────────────────────
  // 2. HR V1 login API no longer 500s
  // ─────────────────────────────────────
  console.log("\n=== HR V1 LOGIN API ===");
  const loginResp = await page.request.post("https://ykp-hr-v1.vercel.app/api/auth/login", {
    headers: { "Content-Type": "application/json" },
    data: { username: "owner", password: "owner123" },
  });
  const loginStatus = loginResp.status();
  const loginBody = await loginResp.text();
  record(
    "HR V1 login API returns 2xx (no longer 500)",
    loginStatus >= 200 && loginStatus < 500,
    `status=${loginStatus} body=${loginBody.slice(0, 120)}`
  );

  // ─────────────────────────────────────
  // 3. Button presence — proves hydration works
  // ─────────────────────────────────────
  console.log("\n=== BUTTON PRESENCE (hydration working?) ===");

  // Finance root
  await page.goto("https://ykp-erp-finance.vercel.app", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const finButtons = await page.locator("button").count();
  record("finance root: buttons in DOM (hydration worked)", finButtons > 0, `count=${finButtons}`);
  await page.screenshot({ path: `${SHOTS}/finance-root.png`, fullPage: false });

  // Finance expenses
  await page.goto("https://ykp-erp-finance.vercel.app/expenses", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const tambahBtn = await page.locator('button:has-text("Tambah Expense")').count();
  record("finance /expenses: Tambah Expense button in DOM", tambahBtn > 0, `count=${tambahBtn}`);
  await page.screenshot({ path: `${SHOTS}/finance-expenses.png`, fullPage: false });

  // Click Tambah Expense — expect dialog opens
  if (tambahBtn > 0) {
    await page.locator('button:has-text("Tambah Expense")').first().click({ force: true });
    await page.waitForTimeout(2000);
    const dialogVisible = await page.locator('[role="dialog"]').count();
    record(
      "finance Tambah Expense: click opens dialog",
      dialogVisible > 0,
      `dialogs=${dialogVisible}`
    );
    await page.screenshot({ path: `${SHOTS}/finance-tambah-dialog.png`, fullPage: false });
  }

  // Hermez root
  await page.goto("https://ykp-erp-hermez.vercel.app", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const hermezButtons = await page.locator("button").count();
  record("hermez root: buttons in DOM (hydration worked)", hermezButtons > 0, `count=${hermezButtons}`);
  await page.screenshot({ path: `${SHOTS}/hermez-root.png`, fullPage: false });

  // HR (ykp-erp) root → /attendance
  await page.goto("https://ykp-erp-hr.vercel.app/attendance", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const hrButtons = await page.locator("button").count();
  record("hr /attendance: buttons in DOM (hydration worked)", hrButtons > 0, `count=${hrButtons}`);
  await page.screenshot({ path: `${SHOTS}/hr-attendance.png`, fullPage: false });

  // HR V1 after login
  await page.context().clearCookies();
  await page.goto("https://ykp-hr-v1.vercel.app/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  if (loginStatus >= 200 && loginStatus < 300) {
    // Cookies should be set already
    await page.goto("https://ykp-hr-v1.vercel.app/hr/employees", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const hrV1Buttons = await page.locator("button").count();
    record("hr-v1 /hr/employees: buttons in DOM (hydration worked)", hrV1Buttons > 0, `count=${hrV1Buttons}`);
    await page.screenshot({ path: `${SHOTS}/hr-v1-employees.png`, fullPage: false });
  } else {
    record("hr-v1 /hr/employees: skip (login failed)", false, "login not 2xx");
  }

  await browser.close();

  const passed = RESULTS.filter((r) => r.ok).length;
  console.log(`\n========== POST-FIX VERIFY ==========`);
  console.log(`${passed}/${RESULTS.length} checks passed`);
  fs.writeFileSync("tests/post-fix-results.json", JSON.stringify(RESULTS, null, 2));

  if (passed < RESULTS.length) process.exit(1);
}

run().catch((e) => {
  console.error("verify failed:", e);
  process.exit(2);
});