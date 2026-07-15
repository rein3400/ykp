import { chromium } from "playwright-core";
const browser = await chromium.launch({ headless: true, executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe", args: ["--no-sandbox"] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto("https://ykp-hr-v1-standalone-production.up.railway.app/login");
await page.locator('input').first().fill("owner");
await page.locator('input[type="password"]').first().fill("owner123");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(3000);
// Now try to access /api/hr/employees (server-rendered)
const resp = await page.request.get("https://ykp-hr-v1-standalone-production.up.railway.app/api/hr/employees");
console.log("GET /api/hr/employees:", resp.status());
const cookies = await ctx.cookies();
console.log("Cookies:", cookies.map(c => c.name).join(", "));
const sess = cookies.find(c => c.name === "ykp_hr_session");
if (sess) {
  // Try with cookie directly
  const resp2 = await page.request.get("https://ykp-hr-v1-standalone-production.up.railway.app/api/hr/employees", {
    headers: { "Cookie": `ykp_hr_session=${sess.value}` }
  });
  console.log("With explicit cookie:", resp2.status(), (await resp2.text()).substring(0, 200));
}
await browser.close();
