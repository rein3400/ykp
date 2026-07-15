import { chromium } from "playwright-core";
const browser = await chromium.launch({ headless: true, executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe", args: ["--no-sandbox"] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto("https://ykp-hr-v1-standalone-production.up.railway.app/login");
await page.locator('input').first().fill("owner");
await page.locator('input[type="password"]').first().fill("owner123");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(3000);
// Call POST with full valid body
const resp = await page.request.post("https://ykp-hr-v1-standalone-production.up.railway.app/api/hr/employees", {
  headers: { "Content-Type": "application/json" },
  data: {
    full_name: "Debug User",
    nickname: "",
    gender: "M",
    phone: "",
    email: "debug@ykp.local",
    role: "staff",
    position: "Tester",
    brand_id: "BR-001",
    outlet_id: "OL-001",
    basic_salary: "4000000",
    salary_type: "MONTHLY",
    employment_status: "PROBATION",
    join_date: "2026-07-10"
  }
});
console.log("Status:", resp.status());
console.log("Body:", (await resp.text()).substring(0, 300));
await browser.close();
