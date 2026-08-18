/**
 * Hermez 500 reproduction. Visits each dashboard page, captures errors.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const HUB = "https://ykp-hub-production.up.railway.app";
const HERMEZ = "https://ykp-erp-hermez-production.up.railway.app";
const OUT = path.resolve("tests/hermez-debug");
fs.mkdirSync(OUT, { recursive: true });

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const findings = [];
const note = (s, a, m) => { findings.push({ s, a, m }); log(`  ${s.toUpperCase()} ${a}: ${m}`); };

async function shot(page, name) {
  const file = path.join(OUT, `${String(++shot.i).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  log(`📸 ${path.basename(file)}`);
}
shot.i = 0;

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } }); // mobile size to mimic the screenshot
  const page = await ctx.newPage();
  page.on("pageerror", (e) => note("error", "page", `pageerror: ${e.message}`));
  page.on("response", async (r) => {
    if (r.status() >= 500) {
      let body = "";
      try { body = (await r.text()).slice(0, 200); } catch {}
      note("error", "http5xx", `${r.status()} ${r.url()} body=${body}`);
    }
  });

  // Login via hub (has CORS-safe proxy)
  log("\n=== Login via hub proxy ===");
  await page.goto(HUB, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.locator("input[autocomplete='username']").fill("owner");
  await page.locator("input[autocomplete='current-password']").fill("owner123");
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(2500);
  await shot(page, "login-done");

  // Visit each Hermez route directly
  const routes = ["/", "/alerts", "/config", "/run", "/telegram-test"];
  for (const r of routes) {
    log(`\n--- ${HERMEZ}${r} ---`);
    await page.goto(HERMEZ + r, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await shot(page, `route-${r.replace(/\//g, "_") || "root"}`);

    // Check for "This page couldn't load" text
    const errorPage = await page.locator("text=/couldn't load|This page could not be found/i").first().isVisible().catch(() => false);
    if (errorPage) {
      const errorText = await page.locator("body").textContent();
      note("fail", "render", `${r}: error page rendered. text: ${errorText?.slice(0, 200)}`);
    }

    // Check for ERROR code on page
    const errorCode = await page.locator("text=/ERROR \\d+/").first().textContent().catch(() => "");
    if (errorCode) note("fail", "render", `${r}: shows ${errorCode}`);
  }

  // ===== SUMMARY =====
  log("\n===== SUMMARY =====");
  log(`Findings: ${findings.length}`);
  const fails = findings.filter((f) => f.s === "fail");
  const errs = findings.filter((f) => f.s === "error");
  log(`  fails: ${fails.length}, errors: ${errs.length}`);
  for (const f of [...errs, ...fails]) log(`  ❌ [${f.a}] ${f.m}`);
  fs.writeFileSync(
    path.join("tests", "hermez-debug-report.json"),
    JSON.stringify({ ts: new Date().toISOString(), findings }, null, 2)
  );
  await browser.close();
  process.exit(fails.length + errs.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(2); });