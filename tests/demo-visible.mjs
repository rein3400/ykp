/**
 * Demo: Playwright with HEADLESS=FALSE so Chrome window is visible.
 * Navigates to 4 live URLs, takes screenshots, allows 10s inspection time each.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";

const SHOTS = "tests/screenshots/visible";
fs.mkdirSync(SHOTS, { recursive: true });

const URLS = [
  { name: "ykp-erp-finance", url: "https://ykp-erp-finance-production.up.railway.app", wait: 6000 },
  { name: "ykp-erp-hermez", url: "https://ykp-erp-hermez-production.up.railway.app", wait: 6000 },
  { name: "ykp-erp-hr", url: "https://ykp-erp-hr-production.up.railway.app", wait: 6000 },
  { name: "ykp-hr-v1", url: "https://ykp-hr-v1-production.up.railway.app", wait: 6000 },
];

console.log("Launching VISIBLE Chromium browser window...");
const browser = await chromium.launch({
  headless: false,
  executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--start-maximized",
  ],
});
console.log("✓ Browser launched — Chrome window should be visible on desktop\n");

const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();
console.log("✓ Page opened\n");

for (const target of URLS) {
  console.log(`=== ${target.name} ===`);
  console.log(`  Navigating to: ${target.url}`);
  try {
    const resp = await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const status = resp?.status() ?? 0;
    await page.waitForTimeout(target.wait);

    const title = await page.title();
    const buttonCount = await page.locator("button").count();
    const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 150);

    await page.screenshot({ path: `${SHOTS}/${target.name}.png`, fullPage: false });

    console.log(`  → status=${status} title="${title}"`);
    console.log(`  → buttons=${buttonCount}`);
    console.log(`  → preview: ${bodyText.replace(/\s+/g, " ").slice(0, 80)}...`);
    console.log(`  → Inspect for ${target.wait/1000}s. Screenshot: ${SHOTS}/${target.name}.png\n`);
  } catch (e) {
    console.log(`  → ERROR: ${e.message}\n`);
  }
}

console.log("Keeping browser open 10s for final inspection...");
await page.waitForTimeout(10000);

await browser.close();
console.log("✓ Browser closed");