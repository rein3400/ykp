/**
 * ykp-hub UI polish test suite.
 * Walks through every visible UI element + interaction, captures screenshots
 * for visual verification, and asserts key behavior.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const HUB = "https://ykp-hub-production.up.railway.app";
const OUT = path.resolve("tests/hub-polish-screens");
fs.mkdirSync(OUT, { recursive: true });

const findings = [];
function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }
function note(severity, area, message) {
  findings.push({ severity, area, message });
  log(`  ${severity.toUpperCase()} ${area}: ${message}`);
}

async function shot(page, name) {
  const file = path.join(OUT, `${String(++shot.i).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  log(`📸 ${path.basename(file)}`);
}
shot.i = 0;

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => note("error", "console", `pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") note("error", "console", m.text());
  });

  // 1. LOAD LOGIN
  log("\n=== 1. Login screen ===");
  await page.goto(HUB, { waitUntil: "networkidle" });
  await page.waitForTimeout(800); // let animations settle
  await shot(page, "login-light");

  // Check key elements
  const loginTitle = await page.locator("h1").first().textContent();
  log(`Title: "${loginTitle}"`);
  if (!loginTitle?.includes("YKP ERP")) note("fail", "login", "missing YKP ERP title");

  // gradient-mesh + grid-pattern utilities applied
  const meshEl = await page.locator(".gradient-mesh").count();
  const gridEl = await page.locator(".grid-pattern").count();
  log(`gradient-mesh: ${meshEl}, grid-pattern: ${gridEl}`);
  if (meshEl === 0) note("fail", "login", "missing .gradient-mesh");
  if (gridEl === 0) note("fail", "login", "missing .grid-pattern");

  // Form fields
  await page.locator("input[autocomplete='username']").fill("owner");
  await page.locator("input[autocomplete='current-password']").fill("owner123");
  await shot(page, "login-filled");

  // Submit
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(2000); // health probe + render
  await shot(page, "dashboard-light");

  // 2. DASHBOARD
  log("\n=== 2. Dashboard ===");

  // Welcome banner
  const welcome = await page.locator("h2").first().textContent();
  log(`Welcome: "${welcome}"`);
  if (!welcome?.toLowerCase().includes("selamat")) note("fail", "dashboard", "no time-of-day greeting");

  // Status banner — must show N/N online
  const statusBanner = await page.locator("text=/All systems operational|Partial degradation|All systems down|Probing/").first().textContent();
  log(`Status banner: "${statusBanner}"`);
  if (!statusBanner) note("fail", "dashboard", "missing status banner");

  // Module cards (4 expected)
  const moduleButtons = await page.locator("button:has-text('Open')").count();
  log(`Module cards: ${moduleButtons}`);
  if (moduleButtons < 4) note("fail", "dashboard", `expected 4 module cards, got ${moduleButtons}`);

  // KPI numbers present in cards
  const hasPing = await page.locator("text=/\\d+ms/").count();
  const hasRows = await page.locator("text=/rows/").count();
  log(`Ping labels: ${hasPing}, Rows labels: ${hasRows}`);
  if (hasPing === 0) note("fail", "dashboard", "no ping ms labels");
  if (hasRows === 0) note("warn", "dashboard", "no rows labels (hr-v1 should have count)");

  // System status list with sparklines
  const sparklines = await page.locator("svg polyline").count();
  log(`Sparkline polylines: ${sparklines}`);
  if (sparklines < 4) note("warn", "dashboard", `expected 4 sparklines, got ${sparklines}`);

  // 3. THEME TOGGLE CYCLE: system → light → dark → system
  log("\n=== 3. Theme cycle (system → light → dark → system) ===");
  const themeBtn = page.locator("button[aria-label='Toggle theme']").first();
  const t0 = await themeBtn.getAttribute("title");
  log(`Initial: ${t0}`);

  // Click 1: system → light
  await themeBtn.click();
  await page.waitForTimeout(300);
  const t1 = await themeBtn.getAttribute("title");
  const d1 = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  log(`After 1 click: ${t1}, html.dark=${d1}`);
  if (t1 !== "Theme: light") note("fail", "theme", `expected 'light' after 1 click, got: ${t1}`);
  if (d1) note("fail", "theme", "html.dark should be false after 1 click (light mode)");

  // Click 2: light → dark
  await themeBtn.click();
  await page.waitForTimeout(300);
  await shot(page, "dashboard-dark");
  const t2 = await themeBtn.getAttribute("title");
  const d2 = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  log(`After 2 clicks: ${t2}, html.dark=${d2}`);
  if (t2 !== "Theme: dark") note("fail", "theme", `expected 'dark' after 2 clicks, got: ${t2}`);
  if (!d2) note("fail", "theme", "html.dark should be true after 2 clicks");

  // Click 3: dark → system
  await themeBtn.click();
  await page.waitForTimeout(300);
  const t3 = await themeBtn.getAttribute("title");
  log(`After 3 clicks: ${t3}`);
  if (t3 !== "Theme: system") note("fail", "theme", `expected 'system' after 3 clicks, got: ${t3}`);

  // Click 4: back to light
  await themeBtn.click();
  await page.waitForTimeout(300);
  const t4 = await themeBtn.getAttribute("title");
  const d4 = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  log(`After 4 clicks (back to start): ${t4}, html.dark=${d4}`);
  if (t4 !== "Theme: light") note("fail", "theme", `cycle didn't return to light, got: ${t4}`);

  // 4. COMMAND PALETTE (Cmd+K)
  log("\n=== 4. Command palette ===");
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(400);
  await shot(page, "palette-open");
  const paletteVisible = await page.locator("input[placeholder*='Cari']").isVisible();
  log(`Palette visible: ${paletteVisible}`);
  if (!paletteVisible) note("fail", "palette", "Cmd+K did not open palette");

  // Type to filter
  await page.keyboard.type("finance");
  await page.waitForTimeout(300);
  await shot(page, "palette-filtered");
  const visibleAfterFilter = await page.locator("button:has-text('Finance')").count();
  log(`Finance buttons after filter: ${visibleAfterFilter}`);

  // Esc closes
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const paletteClosed = !(await page.locator("input[placeholder*='Cari']").isVisible());
  log(`Palette closed via Esc: ${paletteClosed}`);
  if (!paletteClosed) note("fail", "palette", "Esc did not close");

  // 5. CLICK MODULE → IFRAME VIEW
  log("\n=== 5. Module click → iframe ===");
  await page.locator("button:has-text('HR Pilot')").first().click();
  await page.waitForTimeout(800);
  await shot(page, "module-hrv1-loading");

  // Wait for iframe to load or error to appear
  await page.waitForTimeout(3000);
  await shot(page, "module-hrv1-loaded");

  // Verify iframe is present
  const iframeCount = await page.locator("iframe").count();
  log(`Iframes on module view: ${iframeCount}`);
  if (iframeCount === 0) note("fail", "module-view", "no iframe");

  // Verify Back button + breadcrumb
  const backBtn = await page.locator("button[aria-label='Back']").count();
  log(`Back button: ${backBtn}`);
  if (backBtn === 0) note("fail", "module-view", "no Back button");

  // 6. RELOAD + OPEN IN NEW TAB (just check elements exist)
  const reloadBtn = await page.locator("button[title='Reload']").count();
  const newTabLink = await page.locator("a[title='Open in new tab']").count();
  log(`Reload button: ${reloadBtn}, New-tab link: ${newTabLink}`);
  if (reloadBtn === 0) note("fail", "module-view", "no Reload button");
  if (newTabLink === 0) note("fail", "module-view", "no Open in new tab");

  // 7. BACK VIA KEYBOARD
  log("\n=== 7. ArrowLeft back ===");
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(500);
  const backOnDashboard = await page.locator("h2:has-text('Selamat')").isVisible();
  log(`Back on dashboard via keyboard: ${backOnDashboard}`);
  if (!backOnDashboard) note("fail", "nav", "ArrowLeft did not return to dashboard");

  // 8. HOVER ON MODULE CARD → CHECK LIFT
  log("\n=== 8. Card hover micro-interaction ===");
  const card = page.locator("button[aria-label*='Open Finance']").first();
  const initialTransform = await card.evaluate((el) => getComputedStyle(el).transform);
  log(`Initial transform: ${initialTransform}`);
  await card.hover();
  await page.waitForTimeout(400);
  const hoverTransform = await card.evaluate((el) => getComputedStyle(el).transform);
  log(`Hover transform: ${hoverTransform}`);
  if (initialTransform === hoverTransform) note("warn", "hover", "card transform did not change on hover");

  // 9. FOOTER
  log("\n=== 9. Footer ===");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await shot(page, "footer");
  const footerText = await page.locator("footer").textContent();
  log(`Footer contains 'YKP Developer': ${footerText?.includes("YKP Developer")}`);
  log(`Footer contains 'Repository': ${footerText?.includes("Repository")}`);
  if (!footerText?.includes("YKP Developer")) note("warn", "footer", "missing brand");
  if (!footerText?.includes("Repository")) note("warn", "footer", "missing repo link");

  // 10. PERSISTENCE — reload and verify still logged in
  log("\n=== 10. Reload — session persists ===");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const stillLoggedIn = await page.locator("h2:has-text('Selamat')").isVisible();
  log(`Still logged in after reload: ${stillLoggedIn}`);
  if (!stillLoggedIn) note("fail", "session", "session lost after reload");

  // 11. LOGOUT FLOW
  log("\n=== 11. Logout ===");
  await page.locator("button[aria-label='Logout']").first().click();
  await page.waitForTimeout(800);
  await shot(page, "logout-back-to-login");
  const loginAgain = await page.locator("h1:has-text('YKP ERP')").isVisible();
  log(`Back to login: ${loginAgain}`);
  if (!loginAgain) note("fail", "logout", "did not return to login");

  // 12. BAD LOGIN
  log("\n=== 12. Bad credentials ===");
  await ctx.clearCookies();
  await page.goto(HUB, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.locator("input[autocomplete='username']").fill("owner");
  await page.locator("input[autocomplete='current-password']").fill("WRONG");
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(3000);
  await shot(page, "login-error");
  // Look for the rose-colored error box
  const errorBox = await page.locator(".text-rose-700, .bg-rose-50").count();
  const errorText = await page.locator(".bg-rose-50").textContent().catch(() => "");
  log(`Error box count: ${errorBox}, text: "${errorText}"`);
  if (errorBox === 0) note("fail", "login", "no error box on bad credentials");

  // 13. DARK MODE PERSISTENCE
  log("\n=== 13. Dark mode FOUC prevention ===");
  // Wait for any prior requests to settle, then login back with good creds
  await page.waitForTimeout(2000);
  // Clear stale cookies/state to avoid transient 500s
  await ctx.clearCookies();
  await page.goto(HUB, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.locator("input[autocomplete='username']").fill("owner");
  await page.locator("input[autocomplete='current-password']").fill("owner123");
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(2500);
  const onDash = await page.locator("h2:has-text('Selamat')").isVisible();
  if (!onDash) {
    note("warn", "theme", "could not log back in for dark test");
    await shot(page, "dark-after-reload-failed");
  } else {
    // Click theme toggle until dark
    for (let i = 0; i < 3; i++) {
      const t = await page.locator("button[aria-label='Toggle theme']").first().getAttribute("title");
      if (t === "Theme: dark") break;
      await page.locator("button[aria-label='Toggle theme']").first().click();
      await page.waitForTimeout(300);
    }
    // Reload
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, "dark-after-reload");
    const darkAfterReload = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    log(`Dark persisted across reload: ${darkAfterReload}`);
    if (!darkAfterReload) note("fail", "theme", "dark mode lost on reload");
  }

  // ===== SUMMARY =====
  log("\n===== SUMMARY =====");
  log(`Findings: ${findings.length}`);
  const errors = findings.filter((f) => f.severity === "error");
  const fails = findings.filter((f) => f.severity === "fail");
  const warns = findings.filter((f) => f.severity === "warn");
  log(`  errors: ${errors.length}`);
  log(`  fails:  ${fails.length}`);
  log(`  warns:  ${warns.length}`);
  for (const f of [...errors, ...fails]) log(`  ❌ [${f.area}] ${f.message}`);
  for (const w of warns) log(`  ⚠️  [${w.area}] ${w.message}`);

  fs.writeFileSync(
    path.join("tests", "hub-polish-report.json"),
    JSON.stringify({ ts: new Date().toISOString(), findings, total: findings.length }, null, 2)
  );

  await browser.close();
  process.exit(errors.length + fails.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});