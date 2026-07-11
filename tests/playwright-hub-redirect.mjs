/**
 * Hub redirect debug — reproduce "gak bisa redirect" issue.
 * Tests:
 *   A) Login form submit when fields empty -> browser native validation, no submit
 *   B) Login with bad creds -> 401 -> error displayed, still on /
 *   C) Login with good creds -> cookie set, redirected to dashboard
 *   D) Click module -> iframe loads -> after 12s check if app redirected to its own /login
 *   E) Browser back from iframe -> dashboard
 *   F) Hard reload on dashboard while logged in -> session restores
 *   G) Logout -> back to /
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

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => note("error", "console", `pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") note("error", "console", m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes(HUB)) {
      note("warn", "http", `${r.status()} ${r.url()}`);
    }
  });

  // === A. Empty form submit ===
  log("\n=== A. Empty form submit ===");
  await page.goto(HUB, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "A-login-initial");
  const url0 = page.url();
  log(`URL: ${url0}`);
  // Try clicking submit with empty password
  await page.locator("input[autocomplete='username']").fill("");
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(800);
  const url0b = page.url();
  log(`URL after empty submit: ${url0b}`);
  if (url0 !== url0b) note("warn", "redirect", `URL changed on empty submit: ${url0} -> ${url0b}`);

  // === B. Bad credentials ===
  log("\n=== B. Bad credentials ===");
  await page.locator("input[autocomplete='username']").fill("owner");
  await page.locator("input[autocomplete='current-password']").fill("WRONG");
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(2500);
  await shot(page, "B-bad-creds");
  const urlB = page.url();
  log(`URL after bad creds: ${urlB}`);
  if (!urlB.includes(HUB + "/")) note("fail", "redirect", `navigated away from hub after bad creds: ${urlB}`);

  // === C. Good credentials ===
  log("\n=== C. Good credentials + dashboard ===");
  await page.locator("input[autocomplete='current-password']").fill("owner123");
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(2500);
  await shot(page, "C-dashboard");
  const urlC = page.url();
  log(`URL after login: ${urlC}`);
  const onDashboard = await page.locator("h2:has-text('Selamat')").isVisible();
  log(`Dashboard visible: ${onDashboard}`);
  if (!onDashboard) note("fail", "redirect", "did not reach dashboard after login");

  // === D. Click module -> iframe -> check if iframe redirects to its own /login ===
  log("\n=== D. Iframe navigation check ===");
  // List of modules to test
  const modules = [
    { name: "Finance", expect: "ykp-erp-finance-production" },
    { name: "HR Production", expect: "ykp-erp-hr-production" },
    { name: "Hermez AI", expect: "ykp-erp-hermez-production" },
    { name: "HR Pilot", expect: "ykp-hr-v1-standalone-production" }
  ];

  for (const m of modules) {
    log(`\n--- ${m.name} ---`);
    // Click the module card
    const card = page.locator(`button[aria-label*='Open ${m.name}']`).first();
    if (!(await card.count())) {
      note("warn", "module", `${m.name}: card not found`);
      continue;
    }
    await card.click();
    await page.waitForTimeout(2000);
    await shot(page, `D-${m.name.replace(/\s+/g, "-").toLowerCase()}-initial`);

    // Check iframe src
    const iframeSrc = await page.locator("iframe").first().getAttribute("src");
    log(`iframe src: ${iframeSrc}`);
    if (!iframeSrc?.includes(m.expect)) {
      note("fail", "redirect", `${m.name}: iframe src doesn't match expected app`);
    }

    // Wait for iframe to potentially load its own login page
    await page.waitForTimeout(5000);
    await shot(page, `D-${m.name.replace(/\s+/g, "-").toLowerCase()}-loaded`);

    // Try to peek at iframe URL — but cross-origin so only via element
    // Just check that we're still in module view (not redirected to /login)
    const onModuleView = await page.locator("iframe").count();
    log(`iframes on module view: ${onModuleView}`);
    if (onModuleView === 0) note("fail", "redirect", `${m.name}: iframe disappeared`);

    // Try to access iframe content (will likely fail due to cross-origin)
    const frames = page.frames();
    log(`Frames: ${frames.length}`);
    const iframeFrame = frames.find((f) => f !== page.mainFrame());
    if (iframeFrame) {
      try {
        const iframeUrl = iframeFrame.url();
        log(`iframe URL: ${iframeUrl}`);
        if (iframeUrl.includes("/login") || iframeUrl.endsWith("/login")) {
          note("warn", "redirect", `${m.name}: iframe is showing /login (no SSO cookie shared)`);
        }
      } catch (e) {
        log(`  (cross-origin, can't read iframe URL)`);
      }
    }

    // Back to dashboard
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(1000);
  }

  // === E. Hard reload while logged in ===
  log("\n=== E. Hard reload dashboard ===");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await shot(page, "E-after-reload");
  const stillIn = await page.locator("h2:has-text('Selamat')").isVisible();
  log(`Still on dashboard after reload: ${stillIn}`);
  if (!stillIn) note("fail", "redirect", "dashboard lost after reload");

  // === F. Logout ===
  log("\n=== F. Logout ===");
  await page.locator("button[aria-label='Logout']").first().click();
  await page.waitForTimeout(2000);
  await shot(page, "F-after-logout");
  const urlF = page.url();
  log(`URL after logout: ${urlF}`);
  const onLogin = await page.locator("h1:has-text('YKP ERP')").isVisible();
  log(`Login screen visible: ${onLogin}`);
  if (!onLogin) note("fail", "redirect", "did not return to login after logout");

  // === G. Direct /login URL access ===
  log("\n=== G. Direct /login URL access ===");
  // We don't have a /login route in hub - it's the root
  await page.goto(HUB + "/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "G-direct-login-url");
  const urlG = page.url();
  log(`URL after /login goto: ${urlG}`);
  const stillLogin = await page.locator("h1:has-text('YKP ERP')").isVisible();
  log(`Login visible: ${stillLogin}`);
  // Hub doesn't have a /login route — should 404 OR redirect to root
  if (urlG.includes("/login") && !urlG.endsWith("/")) {
    log(`Note: /login URL kept (404 expected since hub has no /login route)`);
  }

  // === H. Module click from a state where iframe app needs login (y kp-hr-v1) ===
  log("\n=== H. Module with possible auth redirect ===");
  // Login again
  await page.locator("input[autocomplete='username']").fill("owner");
  await page.locator("input[autocomplete='current-password']").fill("owner123");
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(2500);

  // HR Pilot requires hub session? Try opening in new tab
  log("Opening HR Pilot in new tab (cookie should be shared if same domain)");
  const hrPilotUrl = "https://ykp-hr-v1-standalone-production.up.railway.app";
  const newPage = await ctx.newPage();
  await newPage.goto(hrPilotUrl, { waitUntil: "networkidle" });
  await newPage.waitForTimeout(2000);
  await shot(newPage, "H-hrpilot-newtab");
  const newUrl = newPage.url();
  log(`New tab URL: ${newUrl}`);
  if (newUrl.includes("/login")) {
    log("New tab landed on /login — SSO not shared cross-domain (expected)");
  }
  await newPage.close();

  // Now from inside hub, click HR Pilot — iframe gets cross-origin context
  const hrCard = page.locator(`button[aria-label*='Open HR Pilot']`).first();
  await hrCard.click();
  await page.waitForTimeout(8000); // give iframe time to potentially redirect
  await shot(page, "H-hrpilot-iframe-after-8s");
  const stillOnHub = page.url().includes(HUB);
  log(`Hub still showing: ${stillOnHub}`);
  if (!stillOnHub) note("fail", "redirect", `Hub navigated away during iframe wait: ${page.url()}`);

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
    JSON.stringify({ ts: new Date().toISOString(), urlHUB: HUB, findings }, null, 2)
  );

  await browser.close();
  process.exit(fails.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});