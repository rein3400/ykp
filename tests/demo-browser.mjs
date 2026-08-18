/**
 * Demo: Playwright launches system Chrome, navigates to live URL,
 * captures screenshot + extracts visible content.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";

const SHOTS = "tests/screenshots/demo";
fs.mkdirSync(SHOTS, { recursive: true });

const URLS = [
  "https://ykp-erp-finance-production.up.railway.app",
  "https://ykp-erp-hermez-production.up.railway.app",
  "https://ykp-erp-hr-production.up.railway.app",
  "https://ykp-hr-v1-production.up.railway.app",
];

console.log("Launching Playwright Chromium with system Chrome...");
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
console.log("✓ Browser launched\n");

const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();
console.log("✓ New page opened\n");

for (const url of URLS) {
  const start = Date.now();
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const status = resp?.status() ?? 0;
    const elapsed = Date.now() - start;

    // Wait for content to render
    await page.waitForTimeout(3000);

    const finalUrl = page.url();
    const title = await page.title();
    const buttonCount = await page.locator("button").count();
    const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 200);
    const hostname = await page.evaluate(() => location.hostname);

    const safeName = url.replace(/https?:\/\//, "").replace(/[^a-z0-9]/gi, "_");
    const screenshotPath = `${SHOTS}/${safeName}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });

    console.log(`[${elapsed}ms] ${url}`);
    console.log(`  → status=${status} finalUrl=${finalUrl.replace("https://", "")}`);
    console.log(`  → title="${title}" hostname=${hostname}`);
    console.log(`  → buttons=${buttonCount}`);
    console.log(`  → preview: ${bodyText.replace(/\s+/g, " ").slice(0, 100)}...`);
    console.log(`  → screenshot: ${screenshotPath}\n`);
  } catch (e) {
    console.log(`[ERR] ${url}: ${e.message}\n`);
  }
}

await browser.close();
console.log("✓ Browser closed");
console.log("\nScreenshots saved to:", SHOTS);