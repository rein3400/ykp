import { chromium } from "playwright-core";
const browser = await chromium.launch({ headless: true, executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe", args: ["--no-sandbox"] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto("https://ykp-hr-v1-standalone-production.up.railway.app/login");
await page.locator('input').first().fill("owner");
await page.locator('input[type="password"]').first().fill("owner123");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(3000);
const resp = await page.request.post("https://ykp-hr-v1-standalone-production.up.railway.app/api/hr/employees", {
  headers: { "Content-Type": "application/json" },
  data: { full_name: "x" }  // missing required
});
console.log("Status:", resp.status());
console.log("Body:", await resp.text());
await browser.close();
