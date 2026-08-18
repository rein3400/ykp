/**
 * Visual check: open deployed apps, see if data shows on UI.
 * No login required for pages that show data anonymously.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
fs.mkdirSync("tests/screenshots/data-state", { recursive: true });

const URLS = [
  { name: "finance-home", url: "https://ykp-erp-finance-production.up.railway.app" },
  { name: "hr-attendance", url: "https://ykp-erp-hr-production.up.railway.app/attendance" },
  { name: "hermez-alerts", url: "https://ykp-erp-hermez-production.up.railway.app/alerts" },
];

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox"],
  });
  for (const u of URLS) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const resp = await page.goto(u.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    const status = resp?.status();
    const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 800);
    const buttons = await page.locator("button").count();
    const tables = await page.locator("table").count();
    await page.screenshot({ path: `tests/screenshots/data-state/${u.name}.png` });
    console.log(`\n${u.name} (${u.url}):`);
    console.log(`  status=${status} buttons=${buttons} tables=${tables}`);
    console.log(`  body preview: ${bodyText.replace(/\s+/g, " ").slice(0, 200)}`);
    await ctx.close();
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
