/**
 * Playwright: probe Hermez /alerts, /actions, /warehouse pages live.
 * Captures API errors + page errors for each route.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const HUB = "https://ykp-hub-production.up.railway.app";
const HERMEZ = "https://ykp-erp-hermez-production.up.railway.app";
const OUT = path.resolve("tests/playwright-hermez-pages");
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
  const apiCalls = [];
  page.on("response", async (r) => {
    const u = r.url();
    if (u.includes("/api/hermez/")) {
      let body = "";
      try { if (r.status() >= 400) body = (await r.text()).slice(0, 300); } catch {}
      apiCalls.push({ url: u.replace(HERMEZ, ""), status: r.status(), body });
    }
  });

  // Login via Hub + SSO
  log("Login via Hub ...");
  await page.goto(HUB, { waitUntil: "networkidle" });
  await page.locator("input[autocomplete='username']").fill("owner");
  await page.locator("input[autocomplete='current-password']").fill("owner123");
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(2000);
  await page.goto(`${HERMEZ}/api/auth/login?role=SUPER_ADMIN&redirect=/alerts`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // /alerts
  log("\n=== /alerts ===");
  await page.goto(`${HERMEZ}/alerts`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await shot(page, "alerts");
  const alertsBody = await page.locator("body").textContent();
  log("alerts page text (first 400): " + (alertsBody?.slice(0, 400).replace(/\s+/g, " ")));

  // Try open the "Ubah" dialog on first alert row if present
  const ubahBtn = page.locator("button:has-text('Ubah')").first();
  if (await ubahBtn.isVisible().catch(() => false)) {
    log("Clicking Ubah on first alert ...");
    await ubahBtn.click();
    await page.waitForTimeout(800);
    await shot(page, "alerts-ubah-dialog");
    // fill action taken + save
    const ta = page.locator("textarea#action-taken");
    if (await ta.isVisible().catch(() => false)) {
      await ta.fill("Playwright test action note");
      await page.locator("button:has-text('Simpan')").first().click();
      await page.waitForTimeout(2000);
      await shot(page, "alerts-after-save");
      const errText = await page.locator("p.text-destructive").first().textContent().catch(() => null);
      log("alerts save error text: " + errText);
    }
  } else {
    log("No Ubah button visible (no alerts or not loaded)");
  }

  // /actions
  log("\n=== /actions ===");
  await page.goto(`${HERMEZ}/actions`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await shot(page, "actions");
  const actionsBody = await page.locator("body").textContent();
  log("actions page text (first 400): " + (actionsBody?.slice(0, 400).replace(/\s+/g, " ")));

  // /warehouse
  log("\n=== /warehouse ===");
  await page.goto(`${HERMEZ}/warehouse`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await shot(page, "warehouse");
  const whBody = await page.locator("body").textContent();
  log("warehouse page text (first 500): " + (whBody?.slice(0, 500).replace(/\s+/g, " ")));

  log("\n=== API calls observed ===");
  for (const c of apiCalls) log(`  ${c.status} ${c.url} ${c.body ? "| " + c.body : ""}`);

  fs.writeFileSync(path.join(OUT, "api-calls.json"), JSON.stringify(apiCalls, null, 2));
  await browser.close();
  process.exit(0);
}

main().catch((e) => { console.error("[fatal]", e); process.exit(1); });