/**
 * Real browser test with valid owner session — see if dashboard shows non-zero values.
 */
import { chromium } from "playwright-core";
import { createHmac } from "node:crypto";

const SECRET = "ykp-erp-pilot-session-secret-change-me-to-32+chars-please";
const h = Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url");
const b = Buffer.from(JSON.stringify({id:"X",email:"x",name:"x",role:"OWNER",iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString("base64url");
const s = createHmac("sha256",SECRET).update(h+"."+b).digest("base64url");
const TOKEN = `${h}.${b}.${s}`;

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addCookies([
  { name: "ykp_session", value: TOKEN, domain: ".railway.app", path: "/", httpOnly: true, secure: true },
]);
const page = await ctx.newPage();
await page.goto("https://ykp-erp-finance-production.up.railway.app/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
await page.screenshot({ path: "tests/screenshots/finance-with-session.png", fullPage: true });
const text = await page.evaluate(() => document.body.innerText);
const amounts = (text.match(/Rp [0-9.,]+/g) || []).slice(0, 20);
console.log("Amounts visible:", amounts);
const buttonCount = await page.locator("button").count();
console.log("Buttons:", buttonCount);
await browser.close();
