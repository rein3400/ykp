/**
 * Exhaustive button click test — all 4 deployed apps.
 *
 * For each button found in the previous source enumeration:
 *   1. Locate via text/role/aria
 *   2. Try Playwright click first (force=true)
 *   3. Fallback: dispatch click via page.evaluate(() => btn.click())
 *   4. Observe:
 *      - DOM state change (dialog opens, table updates, new URL, etc.)
 *      - Network response (any /api/* call fired)
 *      - No 5xx
 *   5. Screenshot before/after if dialog opens
 *
 * Pass criteria per button:
 *   - clickable (exists, visible, click succeeds without error)
 *   - effect visible (DOM changes OR network call OR URL change)
 */

import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const SHOTS = "tests/screenshots/buttons";
fs.mkdirSync(SHOTS, { recursive: true });

const RESULTS = [];
let totalChecks = 0;
let totalPass = 0;

function record(app, label, ok, detail) {
  totalChecks++;
  if (ok) totalPass++;
  const tag = ok ? "✓" : "✗";
  console.log(`  [${app}] ${label.padEnd(60)} ${tag} ${detail ?? ""}`);
  RESULTS.push({ app, label, ok, detail, ts: new Date().toISOString() });
}

/**
 * Click test: locate by text, click via Playwright, observe effect.
 * Three pass criteria:
 *   - exists: button text present in DOM
 *   - visible: element has non-zero bbox + display !== none
 *   - effective: click → DOM change / network call / URL change / dialog open
 * Reports CSP-blocked hydration separately (clicked=true but no handler ran).
 */
async function clickButton(page, app, label, selectors, { expectDialog = false, expectNetwork = null, beforeUrl = null } = {}) {
  // Extract target text from selectors
  const targetText = (() => {
    for (const sel of selectors) {
      const m = sel.match(/has-text\("([^"]+)"\)/);
      if (m) return m[1];
    }
    return null;
  })();

  if (!targetText) {
    record(app, label, false, "no target text extracted");
    return { passed: false };
  }

  // Phase 1: existence
  const found = await page.evaluate((txt) => {
    const all = Array.from(document.querySelectorAll("button, a[role='button'], [role='button'], a"));
    const matches = all.filter((b) => b.textContent?.trim().includes(txt));
    if (matches.length === 0) return { exists: false };
    const visible = matches.find((m) => {
      const r = m.getBoundingClientRect();
      const cs = window.getComputedStyle(m);
      return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
    });
    return {
      exists: true,
      count: matches.length,
      visible: !!visible,
    };
  }, targetText);

  if (!found.exists) {
    record(app, label, false, "button not in DOM (CSP-blocked hydration?)");
    return { passed: false };
  }
  if (!found.visible) {
    record(app, label, false, `exists x${found.count} but not visible`);
    return { passed: false };
  }

  // Phase 2: capture network
  const networkAfter = [];
  const netHandler = (r) => {
    if (r.url().includes("/api/")) networkAfter.push({ url: r.url(), status: r.status() });
  };
  page.on("response", netHandler);

  // Phase 3: dispatch click via raw JS (bypasses hydration dependency)
  let clicked = false;
  try {
    await page.evaluate((txt) => {
      const all = Array.from(document.querySelectorAll("button, a[role='button'], [role='button'], a"));
      const match = all.find((b) => {
        const r = b.getBoundingClientRect();
        const cs = window.getComputedStyle(b);
        const isVisible = r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
        return isVisible && b.textContent?.trim().includes(txt);
      });
      if (match) {
        match.click();
        match.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        match.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      }
    }, targetText);
    clicked = true;
  } catch (e) {}

  await page.waitForTimeout(2500);

  // Phase 4: observe effect
  const effect = await page.evaluate(() => ({
    dialogOpen: !!document.querySelector('[role="dialog"]:not([data-state="closed"])'),
    menuOpen: !!document.querySelector('[role="menu"]:not([data-state="closed"])'),
    url: location.href,
  }));
  const filteredNet = networkAfter.filter((n) => !n.url.includes("_next/") && !n.url.includes("static/") && !n.url.includes("favicon"));
  const expectedNet = expectNetwork ? filteredNet.filter((n) => n.url.includes(expectNetwork)) : filteredNet;

  let effectReason = "no-effect";
  let effective = false;
  if (expectDialog && effect.dialogOpen) { effective = true; effectReason = "dialog-opened"; }
  else if (effect.menuOpen) { effective = true; effectReason = "menu-opened"; }
  else if (beforeUrl && effect.url !== beforeUrl) { effective = true; effectReason = `url→${effect.url}`; }
  else if (expectedNet.length > 0) { effective = true; effectReason = `api ${expectedNet[0].status}`; }

  // CSP hydration block = click fires but no handler → no DOM change, no API call
  const cspBlocked = clicked && !effective && filteredNet.length === 0;

  const ok = effective;  // strict: pass only if click actually produced effect
  const detail = cspBlocked
    ? `CLICK FIRED but CSP-blocked hydration (no handler bound, 0 API calls)`
    : `clicked=${clicked} ${effectReason} apiCalls=${filteredNet.length}`;

  record(app, label, ok, detail);

  page.off("response", netHandler);

  // Close dialog if opened
  if (effect.dialogOpen || effect.menuOpen) {
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      document.querySelectorAll('[role="dialog"], [role="menu"]').forEach((d) => {
        const closeBtn = d.querySelector('[aria-label="Close"]');
        if (closeBtn) closeBtn.click();
      });
    }).catch(() => {});
    await page.waitForTimeout(300);
  }

  return { passed: ok, clicked, effective, cspBlocked };
}

async function loginAsOwner(page, base) {
  await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);
  const userInput = page.locator(
    'input[name="username"], input[name="user"], input[name="email"], input[type="text"]'
  ).first();
  const pwInput = page.locator('input[type="password"]').first();
  if (!(await userInput.count()) || !(await pwInput.count())) {
    return { ok: false, reason: "no-input-fields" };
  }
  await userInput.fill("owner").catch(() => {});
  await pwInput.fill("owner123").catch(() => {});
  const submit = page.locator(
    'button[type="submit"], button:has-text("Login"), button:has-text("Masuk"), button:has-text("Sign in")'
  ).first();
  if (!(await submit.count())) return { ok: false, reason: "no-submit" };
  const before = page.url();
  await submit.click({ force: true }).catch(() => {});
  await page.waitForTimeout(3000);
  return { ok: !page.url().includes("/login"), before, after: page.url() };
}

async function loginHrV1(page) {
  // ykp-hr-v1 uses server-side redirect from /hr/* to /login when no session.
  // Bypass UI: post directly to /api/auth/login, then navigate.
  const resp = await page.request.post("https://ykp-hr-v1.vercel.app/api/auth/login", {
    headers: { "Content-Type": "application/json" },
    data: { username: "owner", password: "owner123" },
  });
  return { ok: resp.status() === 200, status: resp.status() };
}

async function run() {
  console.log("Launching chromium…");
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  // ════════════════════════════════════════════════════════════
  // FINANCE APP — every button
  // ════════════════════════════════════════════════════════════
  console.log(`\n=== FINANCE — full button click test ===`);
  {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();

    // 1. Root — no buttons, skip
    await page.goto("https://ykp-erp-finance.vercel.app", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // 2. Petty cash tabs (each tab is a button)
    await page.goto("https://ykp-erp-finance.vercel.app/petty-cash", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    for (const t of ["All", "Debit", "Kredit", "Urgent"]) {
      const before = page.url();
      await clickButton(page, "finance", `pc-tab [${t}]`, [
        `[role="tab"]:has-text("${t}")`,
        `button[role="tab"]:has-text("${t}")`,
      ], { beforeUrl: before });
    }

    // 3. Export button on petty cash
    await clickButton(page, "finance", "petty-cash Export trigger", [
      'button:has-text("Export")',
    ], { expectNetwork: "/export/" });

    // 4. Expenses page
    await page.goto("https://ykp-erp-finance.vercel.app/expenses", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "finance", "expenses: Tambah Expense", [
      'button:has-text("Tambah Expense")',
    ], { expectDialog: true });
    await clickButton(page, "finance", "expenses: Export trigger", [
      'button:has-text("Export")',
    ], { expectNetwork: "/export/" });

    // 5. POS page
    await page.goto("https://ykp-erp-finance.vercel.app/pos", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "finance", "pos: Catat transaksi baru", [
      'button:has-text("Catat transaksi baru")',
    ], { expectDialog: true });
    await clickButton(page, "finance", "pos: Export trigger", [
      'button:has-text("Export")',
    ], { expectNetwork: "/export/" });

    // 6. Suppliers
    await page.goto("https://ykp-erp-finance.vercel.app/suppliers", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "finance", "suppliers: Tambah Cost", [
      'button:has-text("Tambah Cost")',
    ], { expectDialog: true });
    // Try Bayar button if any rows
    const bayarBtn = await page.locator('button:has-text("Bayar")').first().isVisible().catch(() => false);
    if (bayarBtn) {
      await clickButton(page, "finance", "suppliers: Bayar (row)", [
        'button:has-text("Bayar")',
      ], { expectNetwork: "/approve" });
    }

    // 7. Summary
    await page.goto("https://ykp-erp-finance.vercel.app/summary", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "finance", "summary: Rebuild Today", [
      'button:has-text("Rebuild Today")',
      'button:has-text("Rebuild")',
    ], { expectNetwork: "/summary" });

    // 8. Settings
    await page.goto("https://ykp-erp-finance.vercel.app/settings", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "finance", "settings: Kirim (Telegram)", [
      'button:has-text("Kirim")',
    ], { expectNetwork: "/telegram" });
    // Settings tabs
    for (const t of ["brands", "outlets", "suppliers", "categories", "methods", "accounts"]) {
      await clickButton(page, "finance", `settings-tab [${t}]`, [
        `[role="tab"]:has-text("${t}")`,
      ]);
    }

    await ctx.close();
  }

  // ════════════════════════════════════════════════════════════
  // HERMEZ APP — every button
  // ════════════════════════════════════════════════════════════
  console.log(`\n=== HERMEZ — full button click test ===`);
  {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();

    // Theme toggle on layout
    await page.goto("https://ykp-erp-hermez.vercel.app", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hermez", "layout: ThemeToggle", [
      'button[aria-label*="theme" i]',
      'button:has(svg.lucide-moon)',
      'button:has(svg.lucide-sun)',
    ]);

    // Brief page (root) — no buttons except nav
    await clickButton(page, "hermez", "brief: 'Lihat alert log' link", [
      'a:has-text("Lihat alert log")',
    ]);

    // Alerts page
    await page.goto("https://ykp-erp-hermez.vercel.app/alerts", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    // Try filter changes
    for (const severity of ["warning", "critical"]) {
      await page.evaluate((v) => {
        const sel = document.querySelector('select');
        if (sel) {
          sel.value = v;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, severity);
      await page.waitForTimeout(800);
    }
    // Try clicking Ubah button on first row if any
    const ubahVisible = await page.locator('button:has-text("Ubah")').first().isVisible().catch(() => false);
    if (ubahVisible) {
      await clickButton(page, "hermez", "alerts: Ubah (row)", [
        'button:has-text("Ubah")',
      ], { expectDialog: true });
    }

    // Config page
    await page.goto("https://ykp-erp-hermez.vercel.app/config", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hermez", "config: Simpan (first row)", [
      'button:has-text("Simpan")',
    ], { expectNetwork: "/config" });

    // Run Console
    await page.goto("https://ykp-erp-hermez.vercel.app/run", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    // Fill date first
    const dateInput = page.locator('input[type="date"]').first();
    if ((await dateInput.count()) > 0) {
      await dateInput.fill("2026-07-08").catch(() => {});
    }
    await clickButton(page, "hermez", "run: Generate brief", [
      'button:has-text("Generate brief")',
      'button:has-text("Generate")',
    ], { expectNetwork: "/run" });

    // Telegram Test
    await page.goto("https://ykp-erp-hermez.vercel.app/telegram-test", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hermez", "telegram: Kirim", [
      'button:has-text("Kirim")',
    ], { expectNetwork: "/telegram" });

    await ctx.close();
  }

  // ════════════════════════════════════════════════════════════
  // HR APP (ykp-erp) — every button
  // ════════════════════════════════════════════════════════════
  console.log(`\n=== HR (ykp-erp) — full button click test ===`);
  {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();

    // Attendance
    await page.goto("https://ykp-erp-hr.vercel.app/attendance", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await clickButton(page, "hr", "attendance: Export (CSV)", [
      'button:has-text("Export")',
    ]);
    // Per-row Check-in / Check-out
    const checkinBtn = page.locator('button:has-text("Check in")').first();
    const checkinVisible = await checkinBtn.isVisible().catch(() => false);
    if (checkinVisible) {
      await clickButton(page, "hr", "attendance: Check-in (row)", [
        'button:has-text("Check in")',
      ], { expectNetwork: "/attendance" });
    }
    const checkoutBtn = page.locator('button:has-text("Check out")').first();
    const checkoutVisible = await checkoutBtn.isVisible().catch(() => false);
    if (checkoutVisible) {
      await clickButton(page, "hr", "attendance: Check-out (row)", [
        'button:has-text("Check out")',
      ], { expectNetwork: "/attendance" });
    }

    // Employees
    await page.goto("https://ykp-erp-hr.vercel.app/employees", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hr", "employees: + Karyawan", [
      'button:has-text("+ Karyawan")',
    ], { expectDialog: true });
    await clickButton(page, "hr", "employees: Import CSV", [
      'button:has-text("Import CSV")',
    ]);

    // Payroll
    await page.goto("https://ykp-erp-hr.vercel.app/payroll", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hr", "payroll: Generate", [
      'button:has-text("Generate")',
    ], { expectDialog: true });
    const approveBtn = page.locator('button:has-text("Approve")').first();
    if (await approveBtn.isVisible().catch(() => false)) {
      await clickButton(page, "hr", "payroll: Approve (row)", [
        'button:has-text("Approve")',
      ], { expectNetwork: "/approve" });
    }
    const rejectBtn = page.locator('button:has-text("Reject")').first();
    if (await rejectBtn.isVisible().catch(() => false)) {
      await clickButton(page, "hr", "payroll: Reject (row)", [
        'button:has-text("Reject")',
      ], { expectNetwork: "/approve" });
    }

    // Rules
    await page.goto("https://ykp-erp-hr.vercel.app/rules", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hr", "rules: + Tambah Rule", [
      'button:has-text("+ Tambah Rule")',
    ], { expectDialog: true });
    const editBtn = page.locator('button:has-text("Edit")').first();
    if (await editBtn.isVisible().catch(() => false)) {
      await clickButton(page, "hr", "rules: Edit (row)", [
        'button:has-text("Edit")',
      ], { expectDialog: true });
    }

    // Summary
    await page.goto("https://ykp-erp-hr.vercel.app/summary", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hr", "summary: Rebuild", [
      'button:has-text("Rebuild")',
    ], { expectNetwork: "/summary" });

    await ctx.close();
  }

  // ════════════════════════════════════════════════════════════
  // HR V1 (ykp-hr-v1) — every button
  // ════════════════════════════════════════════════════════════
  console.log(`\n=== HR V1 (ykp-hr-v1) — full button click test ===`);
  {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();

    // ykp-hr-v1 enforces server-side auth — login via API first
    const auth = await loginHrV1(page);
    record("hr-v1", "login owner/owner123 via /api/auth/login", auth.ok, `status=${auth.status}`);

    // Verify session works by navigating to /hr
    await page.goto("https://ykp-hr-v1.vercel.app/hr", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const onLogin = page.url().includes("/login");
    record("hr-v1", "session persisted after login", !onLogin, `url=${page.url()}`);
    await page.screenshot({ path: "tests/screenshots/buttons/hr-v1-after-login.png" });

    // Employees list
    await page.goto("https://ykp-hr-v1.vercel.app/hr/employees", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hr-v1", "employees: Tambah Karyawan link", [
      'a:has-text("Tambah Karyawan")',
    ]);
    await clickButton(page, "hr-v1", "employees: Import CSV link", [
      'a:has-text("Import")',
    ]);
    await clickButton(page, "hr-v1", "employees: Export CSV link", [
      'a:has-text("Export CSV")',
    ]);

    // Employees new form
    await page.goto("https://ykp-hr-v1.vercel.app/hr/employees/new", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hr-v1", "employees/new: Submit", [
      'button[type="submit"]',
    ], { expectNetwork: "/employees" });
    await clickButton(page, "hr-v1", "employees/new: Batal", [
      'button:has-text("Batal")',
    ]);

    // Attendance
    await page.goto("https://ykp-hr-v1.vercel.app/hr/attendance", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const clkIn = page.locator('button:has-text("Clock in")').first();
    if (await clkIn.isVisible().catch(() => false)) {
      await clickButton(page, "hr-v1", "attendance: Clock in (row)", [
        'button:has-text("Clock in")',
      ], { expectNetwork: "/clock-in" });
    }
    const clkOut = page.locator('button:has-text("Clock out")').first();
    if (await clkOut.isVisible().catch(() => false)) {
      await clickButton(page, "hr-v1", "attendance: Clock out (row)", [
        'button:has-text("Clock out")',
      ], { expectNetwork: "/clock-out" });
    }

    // Roster
    await page.goto("https://ykp-hr-v1.vercel.app/hr/roster", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hr-v1", "roster: Submit", [
      'button[type="submit"]',
    ], { expectNetwork: "/roster" });

    // Leaves
    await page.goto("https://ykp-hr-v1.vercel.app/hr/leaves", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hr-v1", "leaves: Submit", [
      'button[type="submit"]',
    ], { expectNetwork: "/leaves" });

    // Payroll
    await page.goto("https://ykp-hr-v1.vercel.app/hr/payroll", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hr-v1", "payroll: Generate link", [
      'a:has-text("Generate Payroll")',
    ]);

    // Payroll generate
    await page.goto("https://ykp-hr-v1.vercel.app/hr/payroll/generate", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hr-v1", "payroll/gen: Run", [
      'button:has-text("Run")',
      'button[type="submit"]',
    ], { expectNetwork: "/payroll/generate" });

    // Adjustments
    await page.goto("https://ykp-hr-v1.vercel.app/hr/adjustments", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hr-v1", "adjustments: Submit", [
      'button[type="submit"]',
    ], { expectNetwork: "/adjustments" });

    // Summary
    await page.goto("https://ykp-hr-v1.vercel.app/hr/summary", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await clickButton(page, "hr-v1", "summary: Regenerate", [
      'button:has-text("Regenerate")',
      'button:has-text("regenerate")',
    ], { expectNetwork: "/regenerate" });

    await ctx.close();
  }

  await browser.close();

  console.log(`\n========== SUMMARY ==========`);
  console.log(`checks: ${totalPass}/${totalChecks} passed`);
  console.log(`screenshots: ${SHOTS}/`);
  fs.writeFileSync("tests/playwright-all-buttons-results.json", JSON.stringify(RESULTS, null, 2));
  console.log(`results: tests/playwright-all-buttons-results.json`);

  // Persist pass count for hook check
  fs.writeFileSync("tests/.last-button-pass-count", String(totalPass));

  if (totalPass < totalChecks) {
    console.log(`\nPARTIAL: ${totalPass} of ${totalChecks} buttons interactable.`);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(2);
});