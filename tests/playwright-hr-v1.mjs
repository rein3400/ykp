/**
 * Verify ykp-hr-v1 via Playwright (real browser).
 * Tests all 4 live URLs + login flow on hr-v1.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";

const SHOTS = "tests/screenshots/present";
fs.mkdirSync(SHOTS, { recursive: true });

const APPS = [
  { name: "ykp-erp-finance", url: "https://ykp-erp-finance-production.up.railway.app" },
  { name: "ykp-erp-hermez", url: "https://ykp-erp-hermez-production.up.railway.app" },
  { name: "ykp-erp-hr", url: "https://ykp-erp-hr-production.up.railway.app" },
  { name: "ykp-hr-v1", url: "https://ykp-hr-v1-production.up.railway.app" },
];

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const results = [];
  for (const app of APPS) {
    console.log(`\n=== ${app.name} ===`);
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();

    const resp = await page.goto(app.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000);
    const status = resp?.status() ?? 0;
    const finalUrl = page.url();
    const bodyLen = (await page.content()).length;
    const buttonCount = await page.locator("button").count();
    const title = await page.title();

    await page.screenshot({ path: `${SHOTS}/${app.name}-root.png`, fullPage: false });

    console.log(`  status=${status} url=${finalUrl.replace(app.url, "")} body=${bodyLen}B buttons=${buttonCount} title="${title}"`);
    results.push({ app: app.name, status, finalUrl, bodyLen, buttonCount, title });

    // Special test for hr-v1: try login
    if (app.name === "ykp-hr-v1" && status === 200) {
      await page.goto(app.url + "/login", { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);
      const hasLoginForm = await page.locator('input[type="password"]').count() > 0;
      console.log(`  hr-v1 login form present: ${hasLoginForm}`);
      if (hasLoginForm) {
        await page.locator('input[type="text"]').first().fill("owner");
        await page.locator('input[type="password"]').first().fill("owner123");
        const submit = page.locator('button[type="submit"]').first();
        await submit.click();
        await page.waitForTimeout(3000);
        const afterLoginUrl = page.url();
        console.log(`  after login: ${afterLoginUrl}`);
        await page.screenshot({ path: `${SHOTS}/hr-v1-after-login.png`, fullPage: false });
      }
    }

    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync("tests/present-verify.json", JSON.stringify(results, null, 2));

  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    const ok = r.status === 200 || r.status === 307;
    console.log(`  ${ok ? "✓" : "✗"} ${r.app}: status=${r.status} buttons=${r.buttonCount}`);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });