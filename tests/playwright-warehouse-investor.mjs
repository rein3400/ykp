/**
 * Visible Playwright test — Warehouse + Investor V1
 * User can watch Chrome do the clicking.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const SHOTS = path.resolve("tests/screenshots/warehouse-investor-2026-07-13");
fs.mkdirSync(SHOTS, { recursive: true });

const CHROME = "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe";

const APPS = [
  {
    name: "warehouse",
    base: "http://localhost:3005",
    pages: [
      "/login",
      "/warehouse",
      "/warehouse/items",
      "/warehouse/penerimaan",
      "/warehouse/stok",
      "/warehouse/pemakaian",
      "/warehouse/waste",
      "/warehouse/closing",
      "/warehouse/dashboard",
      "/warehouse/summary",
    ],
    login: { user: "owner", pw: "owner123" },
  },
  {
    name: "investor",
    base: "http://localhost:3006",
    pages: [
      "/login",
      "/investor",
      "/investor/portfolio",
      "/investor/capital",
      "/investor/dividend",
      "/investor/returns",
    ],
    login: { user: "owner", pw: "owner123" },
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function testApp(browser, app) {
  console.log(`\n========== ${app.name.toUpperCase()} ==========`);
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  const results = [];
  const net5xx = [];
  const consoleErrors = [];
  page.on("response", (r) => {
    if (r.status() >= 500) net5xx.push(`${r.status()} ${r.url()}`);
  });
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  });

  // 1. Login page
  console.log(`\n1. Login page...`);
  try {
    await page.goto(app.base + "/login", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await sleep(1500);
    await page.screenshot({
      path: path.join(SHOTS, `${app.name}-01-login.png`),
      fullPage: false,
    });
    const title = await page.title();
    const bodyText = await page.locator("body").innerText().catch(() => "");
    console.log(`   title: "${title}"`);
    console.log(`   body: ${bodyText.slice(0, 150).replace(/\s+/g, " ")}`);

    // Fill login
    const inputs = await page.locator("input").count();
    console.log(`   inputs: ${inputs}`);
    if (inputs >= 2) {
      await page.locator("input").first().fill(app.login.user);
      await page
        .locator('input[type="password"]')
        .first()
        .fill(app.login.pw);
      await page.screenshot({
        path: path.join(SHOTS, `${app.name}-02-login-filled.png`),
        fullPage: false,
      });

      // Submit
      const submitBtn = page.locator('button[type="submit"]').first();
      const loginRespP = page
        .waitForResponse(
          (r) => r.url().includes("/api/auth/login"),
          { timeout: 15000 }
        )
        .catch(() => null);
      await submitBtn.click();
      const loginResp = await loginRespP;
      await sleep(2500);
      console.log(
        `   login response: ${loginResp?.status()} → url: ${page.url().replace(app.base, "")}`
      );
      await page.screenshot({
        path: path.join(SHOTS, `${app.name}-03-after-login.png`),
        fullPage: false,
      });
    }
  } catch (e) {
    console.log(`   ERROR: ${String(e.message || e).slice(0, 150)}`);
    results.push({ page: "/login", error: String(e.message || e).slice(0, 200) });
  }

  // 2. Navigate each page
  for (const p of app.pages) {
    if (p === "/login") continue;
    console.log(`\n2. ${p}...`);
    net5xx.length = 0;
    consoleErrors.length = 0;
    try {
      const resp = await page.goto(app.base + p, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await sleep(2000);
      const status = resp?.status() ?? 0;
      const url = page.url();
      const title = await page.title().catch(() => "");
      const bodyText = await page.locator("body").innerText().catch(() => "");
      const buttons = await page.locator("button").count();
      const inputs = await page
        .locator("input, select, textarea")
        .count();
      const errorVisible = await page
        .locator("text=/error|gagal|forbidden|unauthorized|500|internal/i")
        .count();
      const safeName = p.replace(/[^a-z0-9]+/gi, "_") || "root";
      await page.screenshot({
        path: path.join(SHOTS, `${app.name}${safeName}.png`),
        fullPage: false,
      });

      const row = {
        page: p,
        status,
        url: url.replace(app.base, ""),
        title,
        buttons,
        inputs,
        errorVisible,
        net5xx: net5xx.length,
        consoleErrors: consoleErrors.length,
        bodySnippet: bodyText.slice(0, 200).replace(/\s+/g, " "),
      };
      results.push(row);
      console.log(
        `   HTTP${status} btn=${buttons} in=${inputs} errTxt=${errorVisible} 5xx=${net5xx.length} cErr=${consoleErrors.length}`
      );
      console.log(`   body: ${row.bodySnippet}`);

      if (status >= 500) {
        console.log(`   ⚠ 5xx!`);
      }
      if (net5xx.length) {
        console.log(`   ⚠ network 5xx: ${net5xx.slice(0, 3).join(" | ")}`);
      }
      if (consoleErrors.length) {
        console.log(`   ⚠ console errors: ${consoleErrors.slice(0, 2).join(" | ")}`);
      }

      // Click a few buttons if present
      if (buttons > 0 && status < 400) {
        const btnLabels = await page.evaluate(() =>
          Array.from(document.querySelectorAll("button"))
            .map((b) => (b.textContent || "").trim().slice(0, 40))
            .filter(Boolean)
            .slice(0, 8)
        );
        console.log(`   buttons: ${btnLabels.join(" | ")}`);

        // Click first non-logout button
        const toClick = btnLabels.find(
          (t) => !/logout|keluar/i.test(t)
        );
        if (toClick) {
          try {
            const beforeUrl = page.url();
            await page.evaluate((txt) => {
              const b = Array.from(
                document.querySelectorAll("button")
              ).find((x) => (x.textContent || "").trim().includes(txt));
              b?.click();
            }, toClick);
            await sleep(1500);
            const afterUrl = page.url();
            const dialogOpen = await page.evaluate(
              () =>
                !!document.querySelector(
                  '[role="dialog"]:not([data-state="closed"]), [data-state="open"][role="dialog"], .modal, [aria-modal="true"]'
                )
            );
            console.log(
              `   click "${toClick}" → ${dialogOpen ? "dialog opened" : afterUrl !== beforeUrl ? "navigated" : "no visible effect"}`
            );
            if (dialogOpen) {
              await page.screenshot({
                path: path.join(
                  SHOTS,
                  `${app.name}${safeName}-dialog.png`
                ),
                fullPage: false,
              });
              await page.keyboard.press("Escape").catch(() => null);
              await sleep(300);
            }
          } catch (e) {
            console.log(`   click error: ${String(e.message || e).slice(0, 80)}`);
          }
        }
      }
    } catch (e) {
      console.log(`   CRASH: ${String(e.message || e).slice(0, 150)}`);
      results.push({
        page: p,
        error: String(e.message || e).slice(0, 200),
      });
    }
  }

  await ctx.close();
  return results;
}

async function main() {
  console.log("Launching VISIBLE Chrome...");
  const browser = await chromium.launch({
    headless: false,
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--start-maximized"],
  });
  console.log("✓ Chrome visible — watch the show!\n");

  const allResults = {};
  for (const app of APPS) {
    // Quick health check first
    try {
      const hc = await fetch(app.base + "/login", { method: "HEAD" });
      console.log(`${app.name} health: ${hc.status}`);
    } catch {
      console.log(
        `${app.name}: NOT RUNNING. Start with: cd ykp-${app.name}-v1 && npm run dev`
      );
      allResults[app.name] = [{ error: "server not running" }];
      continue;
    }

    allResults[app.name] = await testApp(browser, app);
  }

  await browser.close();

  // Summary
  console.log("\n========== SUMMARY ==========");
  for (const [name, results] of Object.entries(allResults)) {
    const ok = results.filter(
      (r) => r.status >= 200 && r.status < 400 && !r.error
    ).length;
    const total = results.length;
    const errs = results.filter((r) => r.error).length;
    console.log(
      `${name}: ${ok}/${total} pages OK, ${errs} errors`
    );
  }
  console.log(`Screenshots: ${SHOTS}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
