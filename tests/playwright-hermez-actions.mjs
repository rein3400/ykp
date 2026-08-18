/**
 * Playwright: /actions create flow — verify sourceAlertId validation.
 * Steps:
 *  1. Login via Hub + SSO SUPER_ADMIN → /actions
 *  2. Open Create dialog, fill title + a VALID open alert id → expect success
 *  3. Open Create dialog again, fill title + INVALID alert id → expect the
 *     "sourceAlertId does not reference an existing alert" error on page.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const HUB = "https://ykp-hub-production.up.railway.app";
const HERMEZ = "https://ykp-erp-hermez-production.up.railway.app";
const OUT = path.resolve("tests/playwright-hermez-actions");
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
  const results = { validCreate: null, invalidError: null };

  try {
    // Login
    log("Login via Hub ...");
    await page.goto(HUB, { waitUntil: "networkidle" });
    await page.locator("input[autocomplete='username']").fill("owner");
    await page.locator("input[autocomplete='current-password']").fill("owner123");
    await page.locator("button[type='submit']").click();
    await page.waitForTimeout(2000);

    // SSO to actions
    log("SSO into Hermez /actions ...");
    await page.goto(`${HERMEZ}/api/auth/login?role=SUPER_ADMIN&redirect=/actions`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, "actions-page");

    // Fetch a real open alert id via API in-page
    const alerts = await page.evaluate(async (url) => {
      const res = await fetch(`${url}/api/hermez/alerts`);
      return res.json();
    }, HERMEZ);
    const openAlert = alerts?.data?.items?.find((a) => a.status === "open") ?? alerts?.data?.items?.[0];
    const validAlertId = openAlert?.alertId ?? "HZAL-20260715-013";
    log(`Using valid alert id: ${validAlertId}`);

    // ---- Create with VALID sourceAlertId ----
    log("Open Create dialog (valid) ...");
    await page.locator("button:has-text('Action')").first().click().catch(async () => {
      // fallback: dialog trigger may be a different label
      await page.locator("text=/Tambah|Create|\\+/i").first().click();
    });
    await page.waitForTimeout(800);
    await shot(page, "create-dialog-open");

    const titleInput = page.locator("input[placeholder*='title' i], input").first();
    await page.locator("input").nth(0).fill("Playwright valid action");
    // Find sourceAlertId input by placeholder/label
    const srcInput = page.locator("input").filter({ hasText: "" }).nth(0);
    // Fill all relevant fields by index: title, brand, outlet, assignedTo, sourceAlertId
    const inputs = page.locator("input");
    const count = await inputs.count();
    log(`dialog has ${count} inputs`);
    // Fill title (first), sourceAlertId (last text input typically)
    await inputs.nth(0).fill("Playwright valid action");
    // find sourceAlertId input by placeholder containing "alert"
    const srcField = page.locator("input[placeholder*='alert' i]");
    if (await srcField.count() > 0) {
      await srcField.first().fill(validAlertId);
      log(`Filled sourceAlertId field with ${validAlertId}`);
    } else {
      // fallback: fill last input
      await inputs.nth(count - 1).fill(validAlertId);
      log(`Filled last input (#${count - 1}) with ${validAlertId}`);
    }
    await shot(page, "valid-form-filled");

    await page.locator("button:has-text('Simpan')").first().click().catch(async () => {
      await page.locator("button[type='submit']").first().click();
    });
    await page.waitForTimeout(2000);
    await shot(page, "valid-after-submit");
    const validErr = await page.locator("p.text-destructive").first().textContent().catch(() => null);
    const validActionRow = await page.locator("text=Playwright valid action").first().isVisible().catch(() => false);
    results.validCreate = { error: validErr, actionRowVisible: validActionRow };
    log(`valid result: error=${validErr} rowVisible=${validActionRow}`);

    // ---- Create with INVALID sourceAlertId ----
    log("Open Create dialog (invalid) ...");
    // close any open dialog first
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(500);
    await page.goto(`${HERMEZ}/actions`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.locator("button:has-text('Action')").first().click().catch(async () => {
      await page.locator("text=/Tambah|Create|\\+/i").first().click();
    });
    await page.waitForTimeout(800);

    const inputs2 = page.locator("input");
    const count2 = await inputs2.count();
    await inputs2.nth(0).fill("Playwright invalid action");
    const srcField2 = page.locator("input[placeholder*='alert' i]");
    if (await srcField2.count() > 0) {
      await srcField2.first().fill("HZAL-99999999-999");
    } else {
      await inputs2.nth(count2 - 1).fill("HZAL-99999999-999");
    }
    await shot(page, "invalid-form-filled");

    await page.locator("button:has-text('Simpan')").first().click().catch(async () => {
      await page.locator("button[type='submit']").first().click();
    });
    await page.waitForTimeout(2000);
    await shot(page, "invalid-after-submit");
    const invalidErr = await page.locator("p.text-destructive").first().textContent().catch(() => null);
    results.invalidError = invalidErr;
    log(`invalid result error: ${invalidErr}`);
  } catch (e) {
    results.fatal = e instanceof Error ? e.message : String(e);
    log(`FATAL: ${results.fatal}`);
    await shot(page, "error").catch(() => {});
  }

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ ts: new Date().toISOString(), results }, null, 2));
  await browser.close();
  log(`\nRESULTS: ${JSON.stringify(results, null, 2)}`);
  process.exit(0);
}

main().catch((e) => { console.error("[fatal]", e); process.exit(1); });