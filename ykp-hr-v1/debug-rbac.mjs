import { chromium } from "playwright-core";
const browser = await chromium.launch({ headless: true, executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe", args: ["--no-sandbox"] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto("https://ykp-hr-v1-standalone-production.up.railway.app/login");
await page.locator('input').first().fill("owner");
await page.locator('input[type="password"]').first().fill("owner123");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(3000);
const cookies = await ctx.cookies();
const sess = cookies.find(c => c.name === "ykp_hr_session");
if (sess) {
  console.log("Session value:", sess.value.substring(0, 50) + "...");
  // Decode payload
  const payload = sess.value.split('.')[1];
  const decoded = Buffer.from(payload, "base64url").toString();
  console.log("Decoded payload:", decoded);
}
const resp = await page.request.post("https://ykp-hr-v1-standalone-production.up.railway.app/api/hr/employees", {
  headers: { "Content-Type": "application/json" },
  data: { full_name: "Test Debug", brand_id: "BR-001", outlet_id: "OL-001", basic_salary: "4000000", role: "staff", join_date: "2026-07-10", gender: "M" }
});
console.log("Response status:", resp.status());
console.log("Response body:", (await resp.text()).substring(0, 200));
await browser.close();
