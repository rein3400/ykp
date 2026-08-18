/**
 * Verify after-action: every "add" button actually creates data.
 * Test cycle: read-before → submit → read-after → diff.
 */
import { chromium } from "playwright-core";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SHOTS = "tests/screenshots/verify-after";
fs.mkdirSync(SHOTS, { recursive: true });

const BASE = "https://ykp-hr-v1-standalone-production.up.railway.app";
const SHEET_ID = "1rdKV6BJMsDr3lKhIoxQXA8hbto9s8p0rOajHFYNsPVg";

const TEST_RESULTS = [];

function result(name, before, after, status, body, screenshot) {
  const success = status && status >= 200 && status < 300;
  const added = after > before;
  TEST_RESULTS.push({ name, before, after, added, delta: after - before, success, status, screenshot });
  const ok = success && added;
  console.log(`  ${ok ? "✓" : "✗"} ${name}: ${before} → ${after} (Δ${after - before}) status=${status ?? "n/a"}`);
  if (body) console.log(`    body: ${String(body).slice(0, 200)}`);
  if (screenshot) console.log(`    screenshot: ${screenshot}`);
}

// Read Sheets tab count via child process (googleapis in ykp-hr-v1 deps)
function countTab(tab) {
  const out = spawnSync("node", ["-e", `
    import("googleapis").then(async ({google}) => {
      const fs = await import("node:fs");
      const creds = JSON.parse(fs.readFileSync("D:/Users/stefa/Downloads/ykp-hr-v1-7786e7ed8655.json", "utf-8"));
      const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
      const sheets = google.sheets({ version: "v4", auth });
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: "${SHEET_ID}", range: "${tab}!A:A" });
      process.stdout.write("COUNT:" + (r.data.values?.length || 0));
    }).catch(e => { process.stderr.write("ERR:" + e.message); process.exit(1); });
  `], { cwd: "D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER/ykp-hr-v1", encoding: "utf8" });
  // Parse "COUNT:N" from stdout
  const m = (out.stdout || "").match(/COUNT:(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

async function main() {
  // Login first
  console.log("Launching VISIBLE Chrome...");
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
  const page = await context.newPage();

  // Clear any cached session cookies
  await context.clearCookies();

  console.log("Logging in as owner...");
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.locator('input').first().fill("owner");
  await page.locator('input[type="password"]').first().fill("owner123");
  const loginRespP = page.waitForResponse(
    (r) => r.url().includes("/api/auth/login"),
    { timeout: 15000 }
  ).catch(() => null);
  await page.locator('button[type="submit"]').first().click();
  const loginResp = await loginRespP;
  console.log(`  login: ${loginResp?.status()}\n`);

  // ═══════════════════════════════════════════════════════════
  // Test 1: Add Employee
  // ═══════════════════════════════════════════════════════════
  console.log("═══ Test 1: Add Employee ═══");
  const empBefore = await countTab("master_employee");
  console.log(`  master_employee before: ${empBefore}`);

  const testEmpId = `EMP-T${Date.now().toString().slice(-6)}`; // unique ID
  await page.goto(BASE + "/hr/employees/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Fill required fields based on form inspection
  const inputs = await page.locator('input').all();
  console.log(`  found ${inputs.length} input fields`);

  // Use pressSequentially to trigger React onChange (fill may not on controlled inputs)
  async function setField(locator, value) {
    if ((await locator.count()) > 0) {
      await locator.click({ clickCount: 3 }).catch(() => {}); // select all
      await locator.fill("").catch(() => {});
      await locator.type(value, { delay: 30 }).catch(() => {});
    }
  }

  // Fill by label
  await setField(page.locator('input').nth(0), "Test User Auto"); // Nama Lengkap
  await setField(page.locator('input[type="email"]').first(), "test@ykp.local");
  await setField(page.locator('input[type="number"]').first(), "4000000");
  await setField(page.locator('input[type="date"]').first(), "2026-07-01");

  // Select dropdowns
  const gender = page.locator('select').first();
  if ((await gender.count()) > 0) await gender.selectOption("M");
  const role = page.locator('select').nth(1);
  if ((await role.count()) > 0) await role.selectOption("staff");
  const brand = page.locator('select').nth(2);
  if ((await brand.count()) > 0) await brand.selectOption({ index: 1 });
  // Outlet: need to find by label "Outlet ID"
  const outletInput = page.locator('input').filter({ hasText: "" }).nth(4); // 5th input
  // Try better: find by sibling label
  const outletLocator = page.locator('label:has-text("Outlet ID") input, label:has-text("Outlet") input').first();
  await setField(outletLocator, "OL-001");

  await page.screenshot({ path: `${SHOTS}/add-employee-filled.png` });

  // Submit
  const empRespP = page.waitForResponse(
    (r) => r.url().includes("/api/hr/employees") && r.request().method() === "POST",
    { timeout: 15000 }
  ).catch(() => null);
  await page.locator('button[type="submit"]').first().click();
  const empResp = await empRespP;
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SHOTS}/add-employee-after.png` });

  let empBody = null;
  if (empResp) {
    try { empBody = await empResp.text(); } catch (e) {}
  }

  // Verify via Sheets
  await page.waitForTimeout(2000);
  const empAfter = await countTab("master_employee");
  console.log(`  master_employee after: ${empAfter}`);
  result("Add Employee", empBefore, empAfter, empResp?.status(), empBody, `${SHOTS}/add-employee-after.png`);

  // ═══════════════════════════════════════════════════════════
  // Test 2: Add Leave Request
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ Test 2: Add Leave Request ═══");
  const leavesBefore = await countTab("hr_leave_request");
  console.log(`  hr_leave_request before: ${leavesBefore}`);

  await page.goto(BASE + "/hr/leaves", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Fill leave form
  const leaveForm = page.locator('form').first();
  if ((await leaveForm.count()) > 0) {
    const empSelect = page.locator('select').first();
    if ((await empSelect.count()) > 0) {
      const options = await empSelect.locator('option').all();
      console.log(`  found ${options.length} employee options`);
      if (options.length > 1) await empSelect.selectOption({ index: 1 });
    }
    const typeSelect = page.locator('select').nth(1);
    if ((await typeSelect.count()) > 0) await typeSelect.selectOption("ANNUAL_LEAVE");
    const startDate = page.locator('input[type="date"]').first();
    if ((await startDate.count()) > 0) await startDate.fill("2026-07-15");
    const endDate = page.locator('input[type="date"]').nth(1);
    if ((await endDate.count()) > 0) await endDate.fill("2026-07-16");
    const reason = page.locator('textarea').first();
    if ((await reason.count()) > 0) await reason.fill("Test leave auto");

    await page.screenshot({ path: `${SHOTS}/add-leave-filled.png` });

    const leaveRespP = page.waitForResponse(
      (r) => r.url().includes("/api/hr/leaves") && r.request().method() === "POST",
      { timeout: 15000 }
    ).catch(() => null);
    await page.locator('button[type="submit"]').first().click();
    const leaveResp = await leaveRespP;
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOTS}/add-leave-after.png` });

    let leaveBody = null;
    if (leaveResp) try { leaveBody = await leaveResp.text(); } catch (e) {}

    const leavesAfter = await countTab("hr_leave_request");
    console.log(`  hr_leave_request after: ${leavesAfter}`);
    result("Add Leave", leavesBefore, leavesAfter, leaveResp?.status(), leaveBody, `${SHOTS}/add-leave-after.png`);
  } else {
    console.log("  No form found, skip");
  }

  // ═══════════════════════════════════════════════════════════
  // Test 3: Add Adjustment
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ Test 3: Add Adjustment ═══");
  const adjBefore = await countTab("hr_adjustment");
  console.log(`  hr_adjustment before: ${adjBefore}`);

  await page.goto(BASE + "/hr/adjustments", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const adjForm = page.locator('form').first();
  if ((await adjForm.count()) > 0) {
    const empSelect = page.locator('select').first();
    if ((await empSelect.count()) > 0) {
      const options = await empSelect.locator('option').all();
      if (options.length > 1) await empSelect.selectOption({ index: 1 });
    }
    const typeSelect = page.locator('select').nth(1);
    if ((await typeSelect.count()) > 0) await typeSelect.selectOption("BONUS");
    const amount = page.locator('input[type="number"]').first();
    if ((await amount.count()) > 0) await amount.fill("100000");
    const reason = page.locator('textarea').first();
    if ((await reason.count()) > 0) await reason.fill("Test bonus auto");

    await page.screenshot({ path: `${SHOTS}/add-adjustment-filled.png` });

    const adjRespP = page.waitForResponse(
      (r) => r.url().includes("/api/hr/adjustments") && r.request().method() === "POST",
      { timeout: 15000 }
    ).catch(() => null);
    await page.locator('button[type="submit"]').first().click();
    const adjResp = await adjRespP;
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOTS}/add-adjustment-after.png` });

    let adjBody = null;
    if (adjResp) try { adjBody = await adjResp.text(); } catch (e) {}

    const adjAfter = await countTab("hr_adjustment");
    console.log(`  hr_adjustment after: ${adjAfter}`);
    result("Add Adjustment", adjBefore, adjAfter, adjResp?.status(), adjBody, `${SHOTS}/add-adjustment-after.png`);
  }

  // ═══════════════════════════════════════════════════════════
  // Test 4: Generate Daily Summary
  // ═══════════════════════════════════════════════════════════
  console.log("\n═══ Test 4: Generate Daily Summary ═══");
  const summaryBefore = await countTab("hr_daily_summary");
  console.log(`  hr_daily_summary before: ${summaryBefore}`);

  await page.goto(BASE + "/hr/summary", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Fill date
  const dateInput = page.locator('input[type="date"]').first();
  if ((await dateInput.count()) > 0) await dateInput.fill("2026-07-10");

  await page.screenshot({ path: `${SHOTS}/summary-before.png` });

  const regenBtn = page.locator('button:has-text("Regenerate"), button:has-text("regenerate")').first();
  if ((await regenBtn.count()) > 0) {
    const regenRespP = page.waitForResponse(
      (r) => r.url().includes("/api/hr/summary/regenerate") || (r.url().includes("/api/hr/summary") && r.request().method() === "POST"),
      { timeout: 30000 }
    ).catch(() => null);
    await regenBtn.click();
    const regenResp = await regenRespP;
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOTS}/summary-after.png` });

    let regenBody = null;
    if (regenResp) try { regenBody = await regenResp.text(); } catch (e) {}

    const summaryAfter = await countTab("hr_daily_summary");
    console.log(`  hr_daily_summary after: ${summaryAfter}`);
    result("Generate Daily Summary", summaryBefore, summaryAfter, regenResp?.status(), regenBody, `${SHOTS}/summary-after.png`);
  } else {
    console.log("  No regenerate button found");
  }

  await browser.close();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("AFTER-ACTION VERIFICATION REPORT");
  console.log("=".repeat(60));
  console.log(`Tests: ${TEST_RESULTS.length}`);
  const passed = TEST_RESULTS.filter((r) => r.success && r.added).length;
  console.log(`Passed: ${passed}/${TEST_RESULTS.length}`);
  for (const r of TEST_RESULTS) {
    const status = r.success ? (r.added ? "✓ ADDED" : "✗ NO CHANGE") : "✗ FAILED";
    console.log(`  ${r.name}: ${status} (${r.before} → ${r.after}, HTTP ${r.status ?? "n/a"})`);
  }
  fs.writeFileSync("tests/after-action-report.json", JSON.stringify(TEST_RESULTS, null, 2));
  console.log("\nReport saved: tests/after-action-report.json");
}

main().catch((e) => { console.error(e); process.exit(1); });