import { chromium } from "playwright-core";
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();
page.on("response", (r) => {
  if (r.url().includes("/api/") || r.url().includes("/login")) {
    console.log(`[${r.status()}] ${r.request().method()} ${r.url()}`);
  }
});
console.log("goto /login…");
const r = await page.goto("https://ykp-erp-finance.vercel.app/login", { waitUntil: "domcontentloaded" });
console.log("status:", r?.status(), "finalUrl:", page.url());
await page.waitForTimeout(3000);
const html = await page.content();
console.log("html length:", html.length);
console.log("body innerText (first 800):");
console.log(await page.evaluate(() => document.body.innerText.slice(0, 800)));
console.log("input fields:", await page.locator("input").count());
console.log("button fields:", await page.locator("button").count());
console.log("form fields:", await page.locator("form").count());
await page.screenshot({ path: "tests/screenshots/debug-finance-login.png", fullPage: true });
await browser.close();