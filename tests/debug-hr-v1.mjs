import { chromium } from "playwright-core";
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const consoleErrs = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text()); });
page.on("pageerror", (e) => consoleErrs.push("pageerror: " + e.message));
console.log("goto hr-v1 /hr/employees…");
await page.goto("https://ykp-hr-v1.vercel.app/hr/employees", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
console.log("buttons:", await page.locator("button").count());
console.log("body length:", (await page.content()).length);
console.log("body text[:300]:", (await page.evaluate(() => document.body.innerText)).slice(0, 300));
console.log("csp header:", await page.evaluate(() => {
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  return meta ? meta.content : "none-in-meta";
}));
console.log("--- console errors ---");
consoleErrs.slice(0, 8).forEach((e) => console.log("  " + e.slice(0, 250)));
await page.screenshot({ path: "tests/screenshots/debug-hr-v1.png", fullPage: true });
await browser.close();