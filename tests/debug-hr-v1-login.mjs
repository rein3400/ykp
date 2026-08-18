import { chromium } from "playwright-core";
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();

// Probe login API + capture response headers + body
const resp = await page.request.post("https://ykp-hr-v1.vercel.app/api/auth/login", {
  headers: { "Content-Type": "application/json" },
  data: { username: "owner", password: "owner123" },
});
console.log("status:", resp.status());
console.log("headers:", JSON.stringify(Object.fromEntries(Object.entries(await resp.headers())), null, 2));
console.log("body:", await resp.text());

// Probe other endpoints to see if any work
console.log("\n--- /api/hermez/config ---");
const r2 = await page.request.get("https://ykp-erp-hermez.vercel.app/api/hermez/config");
console.log("status:", r2.status(), "body[:200]:", (await r2.text()).slice(0, 200));

await browser.close();