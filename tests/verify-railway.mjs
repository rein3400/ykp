/**
 * Final Railway verification: each app, follow redirects, check buttons on key pages.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";

const SHOTS = "tests/screenshots/railway";
fs.mkdirSync(SHOTS, { recursive: true });

const APPS = [
  { name: "ykp-erp-finance", base: "https://ykp-erp-finance-production.up.railway.app", paths: ["/", "/petty-cash", "/expenses"] },
  { name: "ykp-erp-hermez", base: "https://ykp-erp-hermez-production.up.railway.app", paths: ["/", "/alerts", "/config"] },
  { name: "ykp-erp-hr", base: "https://ykp-erp-hr-production.up.railway.app", paths: ["/", "/attendance"] },
  { name: "ykp-hr-v1", base: "https://ykp-hr-v1-production.up.railway.app", paths: ["/login", "/hr"] },
];

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const results = [];
  for (const app of APPS) {
    console.log(`\n=== ${app.name} ===`);
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();

    for (const path of app.paths) {
      const resp = await page.goto(app.base + path, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
      const status = resp?.status() ?? 0;
      const finalUrl = page.url();
      const buttons = await page.locator("button").count();
      const csp = (resp?.headers() ?? {})["content-security-policy"] ?? "";

      const shotName = `${app.name}-${path.replace(/[^a-z0-9]/gi, "_") || "root"}.png`;
      await page.screenshot({ path: `${SHOTS}/${shotName}`, fullPage: false });

      const r = { path, status, finalUrl: finalUrl.replace(app.base, ""), buttons, csp: csp.includes("unsafe-inline") ? "CSP_FIXED" : "CSP_OLD" };
      results.push({ app: app.name, ...r });
      console.log(`  ${path.padEnd(15)} status=${status} → ${r.finalUrl.padEnd(20)} buttons=${buttons} csp=${r.csp}`);
    }

    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync("tests/railway-verify.json", JSON.stringify(results, null, 2));

  // Summary
  console.log("\n=== SUMMARY ===");
  const byApp = {};
  for (const r of results) {
    if (!byApp[r.app]) byApp[r.app] = [];
    byApp[r.app].push(r);
  }
  for (const [app, rs] of Object.entries(byApp)) {
    const allOk = rs.every((r) => r.status === 200 || r.status === 307);
    const cspOk = rs.every((r) => r.csp === "CSP_FIXED");
    const totalButtons = rs.reduce((s, r) => s + r.buttons, 0);
    console.log(`  ${app}: ${allOk ? "✓" : "✗"} csp=${cspOk ? "FIXED" : "OLD"} totalButtons=${totalButtons}`);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });