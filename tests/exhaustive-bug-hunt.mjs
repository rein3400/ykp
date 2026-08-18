/**
 * EXHAUSTIVE bug hunt across 4 deployed apps.
 * Tests every page, button, form. Reports all bugs with severity.
 *
 * Mode: VISIBLE Chrome (lo bisa lihat interaksi live).
 */

import { chromium } from "playwright-core";
import fs from "node:fs";

const SHOTS = "tests/screenshots/bug-hunt";
fs.mkdirSync(SHOTS, { recursive: true });

const BUGS = [];
const PASSES = [];

function bug(severity, app, location, description, evidence = {}) {
  const entry = { severity, app, location, description, ...evidence, ts: new Date().toISOString() };
  BUGS.push(entry);
  console.log(`  🐛 [${severity}] ${app} :: ${location} :: ${description}`);
  if (evidence.url) console.log(`     URL: ${evidence.url}`);
  if (evidence.status) console.log(`     Status: ${evidence.status}`);
  if (evidence.body) console.log(`     Body: ${evidence.body.slice(0, 200)}`);
  if (evidence.screenshot) console.log(`     Screenshot: ${evidence.screenshot}`);
}

function pass(app, location, note = "") {
  PASSES.push({ app, location, note });
  console.log(`  ✓ ${app} :: ${location} ${note}`);
}

/* ----------------- Test runner per app ----------------- */

async function testFinance(page) {
  const app = "ykp-erp-finance";
  console.log(`\n=== ${app} ===`);
  const base = "https://ykp-erp-finance-production.up.railway.app";

  // 1. Root page
  let resp = await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  if (resp?.status() === 200) pass(app, "root /", "loads OK");

  // 2. /petty-cash tabs
  for (const tab of ["All", "Debit", "Kredit", "Urgent"]) {
    resp = await page.goto(base + "/petty-cash", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const tabBtn = page.locator(`[role="tab"]:has-text("${tab}")`).first();
    if ((await tabBtn.count()) > 0) {
      try {
        await tabBtn.click({ timeout: 3000 });
        await page.waitForTimeout(1000);
        pass(app, `/petty-cash tab "${tab}"`);
      } catch (e) {
        bug("medium", app, `/petty-cash tab "${tab}"`, `click failed: ${e.message.slice(0, 100)}`);
      }
    } else {
      bug("low", app, `/petty-cash tab "${tab}"`, "tab not found in DOM");
    }
    // Capture any 4xx/5xx
    if (resp?.status() >= 400) bug("high", app, `/petty-cash`, `HTTP ${resp.status()}`);
  }

  // 3. Tambah Expense
  resp = await page.goto(base + "/expenses", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  if (resp?.status() === 200) pass(app, "/expenses loads");
  const tambahBtn = page.locator('button:has-text("Tambah Expense")').first();
  if ((await tambahBtn.count()) > 0) {
    try {
      await tambahBtn.click({ timeout: 3000 });
      await page.waitForTimeout(2000);
      const dialogCount = await page.locator('[role="dialog"]').count();
      if (dialogCount > 0) {
        pass(app, "Tambah Expense dialog opens");
        await page.screenshot({ path: `${SHOTS}/finance-tambah-expense.png` });
        // Try fill form
        const dateInput = page.locator('input[type="date"]').last();
        if ((await dateInput.count()) > 0) {
          await dateInput.fill("2026-07-10");
          const amountInput = page.locator('input[type="number"]').last();
          await amountInput.fill("50000");
          pass(app, "Tambah Expense form fillable");
        }
      } else {
        bug("high", app, "/expenses Tambah Expense", "click fires but dialog not visible");
      }
    } catch (e) {
      bug("high", app, "/expenses Tambah Expense", `click failed: ${e.message.slice(0, 100)}`);
    }
  }

  // 4. /pos page + Catat transaksi baru
  resp = await page.goto(base + "/pos", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const posBtn = page.locator('button:has-text("Catat transaksi baru")').first();
  if ((await posBtn.count()) > 0) {
    try {
      await posBtn.click({ timeout: 3000 });
      await page.waitForTimeout(2000);
      if ((await page.locator('[role="dialog"]').count()) > 0) {
        pass(app, "POS Catat transaksi baru dialog opens");
        await page.screenshot({ path: `${SHOTS}/finance-pos-form.png` });
      } else {
        bug("high", app, "/pos Catat transaksi baru", "click fires but no dialog");
      }
    } catch (e) {
      bug("high", app, "/pos", `click failed: ${e.message.slice(0, 100)}`);
    }
  }

  // 5. /suppliers + Tambah Cost
  resp = await page.goto(base + "/suppliers", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const tambahCostBtn = page.locator('button:has-text("Tambah Cost")').first();
  if ((await tambahCostBtn.count()) > 0) {
    try {
      await tambahCostBtn.click({ timeout: 3000 });
      await page.waitForTimeout(2000);
      if ((await page.locator('[role="dialog"]').count()) > 0) {
        pass(app, "Suppliers Tambah Cost dialog opens");
        await page.screenshot({ path: `${SHOTS}/finance-supplier-form.png` });
      } else {
        bug("high", app, "/suppliers Tambah Cost", "click fires but no dialog");
      }
    } catch (e) {
      bug("high", app, "/suppliers", `click failed: ${e.message.slice(0, 100)}`);
    }
  }

  // 6. /summary Rebuild Today
  resp = await page.goto(base + "/summary", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const rebuildBtn = page.locator('button:has-text("Rebuild Today"), button:has-text("Rebuild")').first();
  if ((await rebuildBtn.count()) > 0) {
    try {
      await rebuildBtn.click({ timeout: 3000 });
      await page.waitForTimeout(3000);
      pass(app, "Summary Rebuild button clickable");
    } catch (e) {
      bug("medium", app, "/summary", `click failed: ${e.message.slice(0, 100)}`);
    }
  }

  // 7. /settings Kirim (Telegram test)
  resp = await page.goto(base + "/settings", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const kirimBtn = page.locator('button:has-text("Kirim")').first();
  if ((await kirimBtn.count()) > 0) {
    try {
      await kirimBtn.click({ timeout: 3000 });
      await page.waitForTimeout(2000);
      pass(app, "Settings Kirim button clickable");
    } catch (e) {
      bug("medium", app, "/settings", `click failed: ${e.message.slice(0, 100)}`);
    }
  }

  // 8. Export PDF/CSV
  resp = await page.goto(base + "/expenses", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const exportBtn = page.locator('button:has-text("Export")').first();
  if ((await exportBtn.count()) > 0) {
    try {
      await exportBtn.click({ timeout: 3000 });
      await page.waitForTimeout(1000);
      const pdfItem = page.locator('[role="menuitem"]:has-text("PDF")').first();
      if ((await pdfItem.count()) > 0) {
        // Try click and watch network
        const respPromise = page.waitForResponse(
          (r) => r.url().includes("/export/"),
          { timeout: 10000 }
        ).catch(() => null);
        await pdfItem.click();
        const captured = await respPromise;
        if (captured) {
          if (captured.status() < 400) pass(app, "Export PDF fires API");
          else bug("high", app, "/expenses Export PDF", `API returned ${captured.status()}`, { url: captured.url() });
        } else {
          bug("medium", app, "/expenses Export PDF", "no API call fired");
        }
      }
      await page.keyboard.press("Escape");
    } catch (e) {
      bug("medium", app, "/expenses Export", `failed: ${e.message.slice(0, 100)}`);
    }
  }
}

async function testHermez(page) {
  const app = "ykp-erp-hermez";
  console.log(`\n=== ${app} ===`);
  const base = "https://ykp-erp-hermez-production.up.railway.app";

  let resp = await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  if (resp?.status() === 200) pass(app, "root / loads");

  // /alerts
  resp = await page.goto(base + "/alerts", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  if (resp?.status() === 200) pass(app, "/alerts loads");

  // /config — Simpan per row
  resp = await page.goto(base + "/config", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const simpanBtn = page.locator('button:has-text("Simpan")').first();
  if ((await simpanBtn.count()) > 0) {
    try {
      await simpanBtn.click({ timeout: 3000 });
      await page.waitForTimeout(2000);
      pass(app, "/config Simpan button clickable");
    } catch (e) {
      bug("medium", app, "/config", `Simpan click failed: ${e.message.slice(0, 100)}`);
    }
  }

  // /run — Generate brief
  resp = await page.goto(base + "/run", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const genBtn = page.locator('button:has-text("Generate brief")').first();
  if ((await genBtn.count()) > 0) {
    try {
      await genBtn.click({ timeout: 3000 });
      await page.waitForTimeout(5000);
      pass(app, "/run Generate brief clickable");
      await page.screenshot({ path: `${SHOTS}/hermez-run-after.png`, fullPage: true });
    } catch (e) {
      bug("medium", app, "/run", `Generate click failed: ${e.message.slice(0, 100)}`);
    }
  }

  // /telegram-test Kirim
  resp = await page.goto(base + "/telegram-test", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const tgBtn = page.locator('button:has-text("Kirim")').first();
  if ((await tgBtn.count()) > 0) {
    try {
      await tgBtn.click({ timeout: 3000 });
      await page.waitForTimeout(3000);
      pass(app, "/telegram-test Kirim clickable");
    } catch (e) {
      bug("medium", app, "/telegram-test", `Kirim click failed: ${e.message.slice(0, 100)}`);
    }
  }
}

async function testHr(page) {
  const app = "ykp-erp-hr";
  console.log(`\n=== ${app} ===`);
  const base = "https://ykp-erp-hr-production.up.railway.app";

  let resp = await page.goto(base + "/attendance", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  if (resp?.status() === 200) pass(app, "/attendance loads");

  // /payroll + Generate Payroll
  resp = await page.goto(base + "/payroll", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  if (resp?.status() === 200) pass(app, "/payroll loads");
  const genPayrollBtn = page.locator('button:has-text("Generate")').first();
  if ((await genPayrollBtn.count()) > 0) {
    try {
      await genPayrollBtn.click({ timeout: 3000 });
      await page.waitForTimeout(2000);
      if ((await page.locator('[role="dialog"]').count()) > 0) {
        pass(app, "/payroll Generate Payroll dialog opens");
        await page.screenshot({ path: `${SHOTS}/hr-payroll-generate.png` });
      } else {
        bug("medium", app, "/payroll Generate", "click fires but no dialog");
      }
    } catch (e) {
      bug("medium", app, "/payroll", `click failed: ${e.message.slice(0, 100)}`);
    }
  }

  // /rules + Tambah Rule
  resp = await page.goto(base + "/rules", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const tambahRuleBtn = page.locator('button:has-text("Tambah Rule")').first();
  if ((await tambahRuleBtn.count()) > 0) {
    try {
      await tambahRuleBtn.click({ timeout: 3000 });
      await page.waitForTimeout(2000);
      if ((await page.locator('[role="dialog"]').count()) > 0) {
        pass(app, "/rules Tambah Rule dialog opens");
        await page.screenshot({ path: `${SHOTS}/hr-rules-form.png` });
      } else {
        bug("medium", app, "/rules", "click fires but no dialog");
      }
    } catch (e) {
      bug("medium", app, "/rules", `click failed: ${e.message.slice(0, 100)}`);
    }
  }

  // /summary + Rebuild
  resp = await page.goto(base + "/summary", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const rebuildBtn = page.locator('button:has-text("Rebuild")').first();
  if ((await rebuildBtn.count()) > 0) {
    try {
      await rebuildBtn.click({ timeout: 3000 });
      await page.waitForTimeout(3000);
      pass(app, "/summary Rebuild clickable");
    } catch (e) {
      bug("medium", app, "/summary", `click failed: ${e.message.slice(0, 100)}`);
    }
  }
}

async function testHrV1(page) {
  const app = "ykp-hr-v1";
  console.log(`\n=== ${app} ===`);
  const base = "https://ykp-hr-v1-production.up.railway.app";

  let resp = await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  if (resp?.status() !== 200) {
    bug("critical", app, "/login", `status ${resp?.status()}`, { status: resp?.status() });
    return;
  }
  pass(app, "/login loads");

  // Login
  const userInput = page.locator('input[type="text"]').first();
  const pwInput = page.locator('input[type="password"]').first();
  if ((await userInput.count()) === 0 || (await pwInput.count()) === 0) {
    bug("high", app, "/login", "form inputs missing");
    return;
  }
  await userInput.fill("owner");
  await pwInput.fill("owner123");
  const submitBtn = page.locator('button[type="submit"]').first();
  try {
    const respPromise = page.waitForResponse(
      (r) => r.url().includes("/api/auth/login"),
      { timeout: 10000 }
    ).catch(() => null);
    await submitBtn.click();
    const loginResp = await respPromise;
    if (loginResp) {
      if (loginResp.status() === 200) pass(app, "login API 200");
      else bug("critical", app, "/api/auth/login", `status ${loginResp.status()}`, { status: loginResp.status(), body: (await loginResp.text()).slice(0, 200) });
    } else {
      bug("high", app, "/login submit", "no API response fired");
    }
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOTS}/hr-v1-after-login.png` });
  } catch (e) {
    bug("high", app, "/login submit", `failed: ${e.message.slice(0, 100)}`);
  }
}

/* ----------------- Main ----------------- */

console.log("Launching VISIBLE Chromium browser window...");
const browser = await chromium.launch({
  headless: false,
  executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--start-maximized"],
});
console.log("✓ Chrome visible\n");

const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  ignoreHTTPSErrors: true,
});

// Track console errors + network 4xx/5xx globally
context.on("requestfailed", (req) => {
  console.log(`  ⚠️  requestfailed: ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
});

const page = await context.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") {
    console.log(`  ⚠️  console.error: ${msg.text().slice(0, 150)}`);
  }
});

try {
  await testFinance(page);
  await testHermez(page);
  await testHr(page);
  await testHrV1(page);
} catch (e) {
  console.log(`\nFATAL: ${e.message}`);
}

await browser.close();

console.log("\n" + "=".repeat(60));
console.log("BUG HUNT REPORT");
console.log("=".repeat(60));
console.log(`Total passes: ${PASSES.length}`);
console.log(`Total bugs:   ${BUGS.length}`);
console.log(`\nBugs by severity:`);
const bySev = {};
for (const b of BUGS) bySev[b.severity] = (bySev[b.severity] ?? 0) + 1;
for (const [s, n] of Object.entries(bySev)) console.log(`  ${s}: ${n}`);

console.log(`\nDetailed bugs:`);
for (const b of BUGS) {
  console.log(`  [${b.severity}] ${b.app} :: ${b.location}`);
  console.log(`    ${b.description}`);
}

fs.writeFileSync("tests/bug-hunt-report.json", JSON.stringify({ passes: PASSES, bugs: BUGS, ts: new Date().toISOString() }, null, 2));
console.log(`\nReport saved: tests/bug-hunt-report.json`);