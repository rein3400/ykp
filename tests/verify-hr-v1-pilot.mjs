/**
 * Pilot verification — login + navigate + screenshot.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";

const SHOTS = "tests/screenshots/pilot";
fs.mkdirSync(SHOTS, { recursive: true });

const BASE = "https://ykp-hr-v1-standalone-production.up.railway.app";

async function main() {
  console.log("Launching VISIBLE Chrome...");
  const browser = await chromium.launch({
    headless: false,
    executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--start-maximized"],
  });
  console.log("✓ Chrome visible\n");

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Capture network errors
  const errors = [];
  page.on("response", (r) => {
    if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
  });

  // 1. Login page
  console.log("1. Login page...");
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/01-login.png` });
  const loginTitle = await page.title();
  console.log(`   title: ${loginTitle}`);

  // 2. Fill login form
  console.log("\n2. Fill login form...");
  await page.locator('input').first().fill("owner");
  await page.locator('input[type="password"]').first().fill("owner123");
  await page.screenshot({ path: `${SHOTS}/02-login-filled.png` });

  // 3. Submit
  console.log("\n3. Submit login...");
  const submitBtn = page.locator('button[type="submit"]').first();
  const respPromise = page.waitForResponse(
    (r) => r.url().includes("/api/auth/login"),
    { timeout: 15000 }
  ).catch(() => null);
  await submitBtn.click();
  const loginResp = await respPromise;
  if (loginResp) {
    console.log(`   login status: ${loginResp.status()}`);
  } else {
    console.log("   no login response captured");
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SHOTS}/03-after-login.png` });
  console.log(`   after login URL: ${page.url()}`);

  // 4. Navigate to each page
  const pages = ["/hr", "/hr/employees", "/hr/attendance", "/hr/roster", "/hr/lateness", "/hr/leaves", "/hr/payroll", "/hr/adjustments", "/hr/summary"];
  for (const p of pages) {
    console.log(`\n4. ${p}...`);
    const resp = await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const status = resp?.status() ?? 0;
    const buttons = await page.locator("button").count();
    const inputs = await page.locator("input").count();
    const errorText = await page.locator("text=/error|gagal/i").count();
    const safeName = p.replace(/\//g, "_") || "root";
    await page.screenshot({ path: `${SHOTS}/page${safeName}.png` });
    console.log(`   status=${status} buttons=${buttons} inputs=${inputs} errorText=${errorText}`);
  }

  // 5. Test sidebar nav
  console.log("\n5. Sidebar nav...");
  await page.goto(BASE + "/hr", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const navLinks = await page.locator('nav a, aside a').all();
  console.log(`   Found ${navLinks.length} nav links`);
  for (let i = 0; i < Math.min(navLinks.length, 3); i++) {
    const text = (await navLinks[i].textContent())?.slice(0, 30) || "";
    const href = await navLinks[i].getAttribute("href") || "";
    console.log(`   ${i+1}. "${text}" → ${href}`);
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Captured ${errors.length} 5xx errors:`);
  for (const e of errors.slice(0, 10)) console.log(`  ${e}`);
  console.log(`Screenshots: ${SHOTS}/`);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });