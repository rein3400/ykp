/**
 * UI-only bug hunt. Tests layout, button visibility, form interactions
 * without auth. Real bugs that user can see in browser.
 */

import { chromium } from "playwright-core";
import fs from "node:fs";

const SHOTS = "tests/screenshots/ui-bugs";
fs.mkdirSync(SHOTS, { recursive: true });

const BUGS = [];
const PASSES = [];

function bug(severity, app, location, description) {
  BUGS.push({ severity, app, location, description, ts: new Date().toISOString() });
  console.log(`  🐛 [${severity}] ${app} :: ${location} :: ${description}`);
}
function pass(app, location, note) {
  PASSES.push({ app, location, note });
  console.log(`  ✓ ${app} :: ${location} ${note}`);
}

const APPS = [
  { name: "ykp-erp-finance", base: "https://ykp-erp-finance-production.up.railway.app" },
  { name: "ykp-erp-hermez", base: "https://ykp-erp-hermez-production.up.railway.app" },
  { name: "ykp-erp-hr", base: "https://ykp-erp-hr-production.up.railway.app" },
];

async function testApp(browser, app) {
  console.log(`\n${"=".repeat(60)}\n=== ${app.name} ===\n${"=".repeat(60)}`);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // Track console errors (only meaningful ones, ignore noise)
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const txt = msg.text();
      // Skip noise: Failed to load resource (already in network)
      // Skip 401/403/404 (expected for unauth)
      if (txt.includes("Failed to load resource")) return;
      if (txt.match(/\b(401|403|404|429)\b/)) return;
      bug("low", app.name, "console", `${msg.type()}: ${txt.slice(0, 200)}`);
    }
  });

  // Visit each known route
  const routes = {
    "ykp-erp-finance": ["/", "/pos", "/suppliers", "/petty-cash", "/expenses", "/summary", "/analytics", "/settings"],
    "ykp-erp-hermez": ["/", "/alerts", "/config", "/run", "/telegram-test"],
    "ykp-erp-hr": ["/attendance", "/payroll", "/rules", "/employees", "/summary"],
  }[app.name] || ["/"];

  for (const route of routes) {
    const resp = await page.goto(app.base + route, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    const status = resp?.status() ?? 0;
    const title = await page.title();
    const buttonCount = await page.locator("button").count();
    const inputCount = await page.locator("input").count();
    const linkCount = await page.locator("a").count();
    const formCount = await page.locator("form").count();
    const hasError = await page.locator("text=/error|gagal|not found|404|500/i").count();
    const hasErrorOverlay = await page.evaluate(() => {
      const txt = document.body?.innerText || "";
      return /Application failed|500: Internal|404: This page|Fatal Error/i.test(txt);
    });

    const safeRoute = route.replace(/[^a-z0-9]/gi, "_") || "root";
    await page.screenshot({ path: `${SHOTS}/${app.name}${safeRoute}.png`, fullPage: false });

    const summary = `status=${status} title="${title}" buttons=${buttonCount} inputs=${inputCount} links=${linkCount} forms=${formCount}`;
    console.log(`\n  ${route}:`);
    console.log(`    ${summary}`);

    if (status >= 500 && status !== 502) {
      bug("high", app.name, route, `HTTP ${status} (server error)`);
    } else if (hasErrorOverlay) {
      bug("high", app.name, route, "Error overlay visible (500/404/fatal)");
    } else if (status === 200 || status === 307) {
      pass(app.name, route, summary);
    } else {
      bug("medium", app.name, route, `unexpected status ${status}`);
    }

    if (hasError > 0 && !hasErrorOverlay) {
      // Visible error text — could be 429 rate limit or empty data message
      // Get sample
      const errText = await page.locator("text=/error|gagal/i").first().textContent().catch(() => "");
      if (errText && !errText.match(/^\s*$/)) {
        // Skip 429 rate limit messages (test artifact)
        if (errText.includes("rate_limited") || errText.includes("Too many")) {
          console.log(`    [info] rate limit error visible (test artifact)`);
        } else {
          bug("low", app.name, route, `error text visible: ${errText.slice(0, 100)}`);
        }
      }
    }
  }

  // Test button clickability (where visible)
  console.log(`\n  --- Button clickability ---`);
  await page.goto(app.base, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const buttons = await page.locator("button:visible").all();
  console.log(`  Found ${buttons.length} visible buttons on home page`);

  for (let i = 0; i < Math.min(buttons.length, 5); i++) {
    const btn = buttons[i];
    const text = (await btn.textContent())?.slice(0, 50) || "(no text)";
    const isDisabled = await btn.isDisabled();
    if (isDisabled) {
      console.log(`    [skip] "${text}" (disabled)`);
      continue;
    }
    try {
      // Click + wait briefly
      await btn.click({ timeout: 3000, trial: true });
      pass(app.name, `button "${text}"`, "clickable");
    } catch (e) {
      bug("low", app.name, `button "${text}"`, `not clickable: ${e.message.slice(0, 80)}`);
    }
  }

  await context.close();
}

async function main() {
  console.log("Launching VISIBLE Chromium...");
  const browser = await chromium.launch({
    headless: false,
    executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--start-maximized"],
  });
  console.log("✓ Chrome visible\n");

  for (const app of APPS) {
    try {
      await testApp(browser, app);
    } catch (e) {
      console.log(`\nFATAL ${app.name}: ${e.message}`);
    }
  }

  await browser.close();

  console.log("\n" + "=".repeat(60));
  console.log("UI-ONLY BUG REPORT");
  console.log("=".repeat(60));
  console.log(`Total passes: ${PASSES.length}`);
  console.log(`Total bugs:   ${BUGS.length}`);

  const bySev = {};
  for (const b of BUGS) bySev[b.severity] = (bySev[b.severity] ?? 0) + 1;
  console.log(`\nBugs by severity:`);
  for (const [s, n] of Object.entries(bySev)) console.log(`  ${s}: ${n}`);

  console.log(`\nAll bugs:`);
  for (const b of BUGS) {
    console.log(`  [${b.severity}] ${b.app} :: ${b.location}`);
    console.log(`    ${b.description}`);
  }

  fs.writeFileSync("tests/ui-bugs-report.json", JSON.stringify({ passes: PASSES, bugs: BUGS, ts: new Date().toISOString() }, null, 2));
  console.log(`\nReport saved: tests/ui-bugs-report.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });