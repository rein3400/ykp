/**
 * Hub Buka button redirect test.
 * Verifies each module card's primary "Buka" button opens the module URL
 * in a new tab (target=_blank). Plus regression checks for login/dashboard.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const HUB = "https://ykp-hub-production.up.railway.app";
const OUT = path.resolve("tests/hub-redirect-debug");
fs.mkdirSync(OUT, { recursive: true });

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const findings = [];
const note = (s, a, m) => { findings.push({ s, a, m }); log(`  ${s.toUpperCase()} ${a}: ${m}`); };

async function shot(page, name) {
  const file = path.join(OUT, `${String(++shot.i).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  log(`📸 ${path.basename(file)}`);
}
shot.i = 0;

async function loginViaUI(page) {
  await page.goto(HUB, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.locator("input[autocomplete='username']").fill("owner");
  await page.locator("input[autocomplete='current-password']").fill("owner123");
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(2500);
  return await page.locator("h2:has-text('Selamat')").isVisible();
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => note("error", "console", `pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") note("error", "console", m.text());
  });

  // === A. Login + Buka buttons ===
  log("\n=== A. Login + Buka buttons open new tabs ===");
  const ok = await loginViaUI(page);
  if (!ok) {
    note("fail", "login", "could not log in");
    await browser.close();
    return;
  }
  await shot(page, "A-dashboard");

  const modules = [
    { name: "Finance", expect: "ykp-erp-finance-production" },
    { name: "HR Production", expect: "ykp-erp-hr-production" },
    { name: "Hermez AI", expect: "ykp-erp-hermez-production" },
    { name: "HR Pilot", expect: "ykp-hr-v1-standalone-production" }
  ];

  for (const m of modules) {
    log(`\n--- ${m.name}: Buka ---`);
    // Listen for new tab/page
    const newPagePromise = ctx.waitForEvent("page", { timeout: 8000 }).catch(() => null);
    const buka = page.locator(`a[aria-label='Buka ${m.name} di tab baru']`).first();
    const bukaCount = await buka.count();
    log(`Buka button found: ${bukaCount}`);
    if (bukaCount === 0) {
      note("fail", "module", `${m.name}: Buka button not found`);
      continue;
    }
    const href = await buka.getAttribute("href");
    log(`href: ${href}`);
    if (!href?.includes(m.expect)) note("fail", "module", `${m.name}: href missing expected host`);

    await buka.click();
    const newPage = await newPagePromise;
    if (!newPage) {
      note("fail", "redirect", `${m.name}: no new tab opened`);
      continue;
    }
    log(`New tab opened: ${newPage.url()}`);
    // Wait for the new page to load
    await newPage.waitForLoadState("domcontentloaded").catch(() => {});
    await newPage.waitForTimeout(2500);
    await shot(newPage, `B-${m.name.replace(/\s+/g, "-").toLowerCase()}-newtab`);
    const newUrl = newPage.url();
    log(`Final URL: ${newUrl}`);
    if (!newUrl.includes(m.expect)) note("fail", "redirect", `${m.name}: redirected away from expected host`);

    // Confirm we're still on hub (original tab untouched)
    if (!page.url().includes(HUB)) {
      note("warn", "redirect", `${m.name}: hub tab navigated away`);
    }
    await newPage.close();
  }

  // === B. Preview button opens iframe view ===
  log("\n=== B. Preview button -> iframe ===");
  // Dashboard has Preview buttons too — try HR Pilot (iframes work, will redirect to its own /login)
  const previewBtn = page.locator(`button[aria-label='Preview HR Pilot di hub']`).first();
  if (await previewBtn.count()) {
    await previewBtn.click();
    await page.waitForTimeout(2000);
    await shot(page, "B-preview-hrpilot");
    const iframeCount = await page.locator("iframe").count();
    log(`iframes after Preview: ${iframeCount}`);
    if (iframeCount === 0) note("fail", "preview", "Preview did not show iframe");
    // Back
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(1000);
  } else {
    note("warn", "preview", "Preview button not found");
  }

  // === C. Cmd+K palette Buka equivalent ===
  log("\n=== C. Cmd+K palette selection ===");
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(500);
  await shot(page, "C-palette");
  // Press Enter on first result (default selection)
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
  await shot(page, "C-after-palette-select");
  const onModuleView = await page.locator("iframe").count();
  log(`Module view after palette select: ${onModuleView} iframes`);

  // === D. Logout returns to login ===
  log("\n=== D. Logout ===");
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(500);
  await page.locator("button[aria-label='Logout']").first().click();
  await page.waitForTimeout(1500);
  await shot(page, "D-after-logout");
  const onLogin = await page.locator("h1:has-text('YKP ERP')").isVisible();
  if (!onLogin) note("fail", "logout", "did not return to login");
  else log("✅ Logout returned to login");

  // ===== SUMMARY =====
  log("\n===== SUMMARY =====");
  log(`Findings: ${findings.length}`);
  const fails = findings.filter((f) => f.s === "fail");
  const warns = findings.filter((f) => f.s === "warn");
  const errs = findings.filter((f) => f.s === "error");
  log(`  fails: ${fails.length}, warns: ${warns.length}, errors: ${errs.length}`);
  for (const f of [...errs, ...fails]) log(`  ❌ [${f.a}] ${f.m}`);
  for (const w of warns) log(`  ⚠️  [${w.a}] ${w.m}`);

  fs.writeFileSync(
    path.join("tests", "hub-redirect-report.json"),
    JSON.stringify({ ts: new Date().toISOString(), findings }, null, 2)
  );

  await browser.close();
  process.exit(fails.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});