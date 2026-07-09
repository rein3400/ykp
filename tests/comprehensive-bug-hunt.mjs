/**
 * COMPREHENSIVE bug hunt across finance, hermez, hr.
 * Tests every page + button + form. Capture all errors with screenshot.
 *
 * Mode: VISIBLE Chrome (lo bisa lihat interaksi).
 */

import { chromium } from "playwright-core";
import fs from "node:fs";

const SHOTS = "tests/screenshots/comprehensive";
fs.mkdirSync(SHOTS, { recursive: true });

const BUGS = [];
const PASSES = [];
const NETWORK_LOG = [];

function bug(severity, app, location, description, evidence = {}) {
  const entry = { severity, app, location, description, ...evidence, ts: new Date().toISOString() };
  BUGS.push(entry);
  console.log(`  🐛 [${severity}] ${app} :: ${location} :: ${description}`);
  if (evidence.url) console.log(`     URL: ${evidence.url}`);
  if (evidence.status) console.log(`     Status: ${evidence.status}`);
  if (evidence.body) console.log(`     Body: ${String(evidence.body).slice(0, 250)}`);
  if (evidence.screenshot) console.log(`     Screenshot: ${evidence.screenshot}`);
}

function pass(app, location, note = "") {
  PASSES.push({ app, location, note });
  console.log(`  ✓ ${app} :: ${location} ${note}`);
}

/* ----------------- Test runner per app ----------------- */

async function testFinance(page) {
  const app = "ykp-erp-finance";
  const base = "https://ykp-erp-finance-production.up.railway.app";
  console.log(`\n${"=".repeat(60)}\n=== ${app} ===\n${"=".repeat(60)}`);

  const routes = [
    "/",
    "/petty-cash",
    "/pos",
    "/suppliers",
    "/expenses",
    "/summary",
    "/analytics",
    "/settings",
  ];

  for (const route of routes) {
    const resp = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    const status = resp?.status() ?? 0;
    const title = await page.title();
    const buttonCount = await page.locator("button").count();
    const inputCount = await page.locator("input").count();
    const dialogCount = await page.locator('[role="dialog"]').count();
    const errorCount = await page.locator('text=/error|forbidden|rate.?limit/i').count();
    const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 300);

    console.log(`\n  Route ${route}:`);
    console.log(`    status=${status} buttons=${buttonCount} inputs=${inputCount} dialogs=${dialogCount} errors=${errorCount}`);

    if (status >= 400 && status !== 307) bug("high", app, route, `HTTP ${status}`, { status, url: base + route });
    else pass(app, route, `${status} buttons=${buttonCount} inputs=${inputCount}`);

    if (errorCount > 0) {
      bug("medium", app, route, `${errorCount} error text(s) visible`, { body: bodyText });
    }

    await page.screenshot({ path: `${SHOTS}/finance${route.replace(/\//g, "_") || "_root"}.png`, fullPage: false });
  }

  // Tambah Expense form fill + submit
  console.log(`\n  --- Form test: Tambah Expense ---`);
  await page.goto(base + "/expenses", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const tambah = page.locator('button:has-text("Tambah Expense")').first();
  if ((await tambah.count()) > 0) {
    await tambah.click();
    await page.waitForTimeout(1500);

    // Fill form
    const dateIn = page.locator('input[type="date"]').last();
    if ((await dateIn.count()) > 0) await dateIn.fill("2026-07-10");

    const numIn = page.locator('input[type="number"]').last();
    if ((await numIn.count()) > 0) await numIn.fill("50000");

    const descIn = page.locator('input[placeholder*="ATK" i], input[placeholder*="deskripsi" i]').first();
    if ((await descIn.count()) > 0) await descIn.fill("Test expense bug hunt");

    await page.screenshot({ path: `${SHOTS}/finance-expense-form-filled.png` });

    const submitBtn = page.locator('button:has-text("Simpan")').last();
    if ((await submitBtn.count()) > 0) {
      try {
        const respP = page.waitForResponse(
          (r) => r.url().includes("/api/fin/expense") && r.request().method() === "POST",
          { timeout: 10000 }
        ).catch(() => null);
        await submitBtn.click();
        const r = await respP;
        if (r) {
          if (r.status() < 400) pass(app, "Tambah Expense submit", `status=${r.status()}`);
          else bug("high", app, "Tambah Expense submit", `HTTP ${r.status()}`, { status: r.status(), body: (await r.text()).slice(0, 200) });
        } else {
          bug("medium", app, "Tambah Expense submit", "no API response");
        }
      } catch (e) {
        bug("medium", app, "Tambah Expense submit", e.message.slice(0, 100));
      }
    }
  }

  // Export test
  console.log(`\n  --- Export test ---`);
  await page.goto(base + "/expenses", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const exp = page.locator('button:has-text("Export")').first();
  if ((await exp.count()) > 0) {
    await exp.click();
    await page.waitForTimeout(800);
    for (const fmt of ["PDF", "CSV"]) {
      const item = page.locator(`[role="menuitem"]:has-text("${fmt}")`).first();
      if ((await item.count()) > 0) {
        try {
          const respP = page.waitForResponse(
            (r) => r.url().includes("/export/") && r.request().method() === "POST",
            { timeout: 8000 }
          ).catch(() => null);
          await item.click();
          const r = await respP;
          if (r) {
            if (r.status() < 400) pass(app, `Export ${fmt}`, `status=${r.status()}`);
            else bug("high", app, `Export ${fmt}`, `HTTP ${r.status()}`, { status: r.status(), body: (await r.text()).slice(0, 200) });
          } else {
            bug("medium", app, `Export ${fmt}`, "no API response");
          }
        } catch (e) {
          bug("medium", app, `Export ${fmt}`, e.message.slice(0, 100));
        }
      } else {
        bug("low", app, `Export ${fmt}`, "menuitem not in DOM");
      }
    }
    await page.keyboard.press("Escape");
  }
}

async function testHermez(page) {
  const app = "ykp-erp-hermez";
  const base = "https://ykp-erp-hermez-production.up.railway.app";
  console.log(`\n${"=".repeat(60)}\n=== ${app} ===\n${"=".repeat(60)}`);

  const routes = ["/", "/alerts", "/config", "/run", "/telegram-test"];

  for (const route of routes) {
    const resp = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    const status = resp?.status() ?? 0;
    const buttonCount = await page.locator("button").count();
    const inputCount = await page.locator("input").count();
    const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 300);

    console.log(`\n  Route ${route}:`);
    console.log(`    status=${status} buttons=${buttonCount} inputs=${inputCount}`);

    if (status >= 400 && status !== 307) bug("high", app, route, `HTTP ${status}`, { status });
    else pass(app, route, `${status} buttons=${buttonCount} inputs=${inputCount}`);

    await page.screenshot({ path: `${SHOTS}/hermez${route.replace(/\//g, "_") || "_root"}.png`, fullPage: false });

    // Specific test for /config — edit + save
    if (route === "/config") {
      const simpan = page.locator('button:has-text("Simpan")').first();
      if ((await simpan.count()) > 0) {
        try {
          const respP = page.waitForResponse(
            (r) => r.url().includes("/api/hermez/config") && r.request().method() === "PUT",
            { timeout: 10000 }
          ).catch(() => null);
          await simpan.click();
          const r = await respP;
          if (r) {
            if (r.status() < 400) pass(app, "/config Simpan submit", `status=${r.status()}`);
            else bug("high", app, "/config Simpan", `HTTP ${r.status()}`, { status: r.status(), body: (await r.text()).slice(0, 200) });
          } else {
            bug("medium", app, "/config Simpan", "no API response");
          }
        } catch (e) {
          bug("medium", app, "/config", e.message.slice(0, 100));
        }
      }
    }

    // /run Generate brief
    if (route === "/run") {
      const dateIn = page.locator('input[type="date"]').first();
      if ((await dateIn.count()) > 0) await dateIn.fill("2026-07-10");
      const gen = page.locator('button:has-text("Generate brief"), button:has-text("Generate")').first();
      if ((await gen.count()) > 0) {
        try {
          const respP = page.waitForResponse(
            (r) => r.url().includes("/api/hermez/run"),
            { timeout: 30000 }
          ).catch(() => null);
          await gen.click();
          const r = await respP;
          if (r) {
            const j = await r.json().catch(() => null);
            if (r.status() < 400 && j?.data?.brief_id) {
              pass(app, "/run Generate", `brief_id=${j.data.brief_id}`);
            } else {
              bug("high", app, "/run Generate", `status=${r.status()}`, { status: r.status(), body: JSON.stringify(j).slice(0, 200) });
            }
          } else {
            bug("medium", app, "/run Generate", "no API response");
          }
        } catch (e) {
          bug("medium", app, "/run", e.message.slice(0, 100));
        }
      }
    }

    // /telegram-test Kirim
    if (route === "/telegram-test") {
      const kirim = page.locator('button:has-text("Kirim")').first();
      if ((await kirim.count()) > 0) {
        try {
          const respP = page.waitForResponse(
            (r) => r.url().includes("/telegram/test"),
            { timeout: 10000 }
          ).catch(() => null);
          await kirim.click();
          const r = await respP;
          if (r) {
            const j = await r.json().catch(() => null);
            if (j?.data?.sent === true) pass(app, "/telegram-test", `sent=true`);
            else if (j?.error?.message?.includes("token")) {
              pass(app, "/telegram-test", `API works (token not configured: ${j.error.message.slice(0, 50)})`);
            } else {
              bug("medium", app, "/telegram-test", `response: ${JSON.stringify(j).slice(0, 100)}`);
            }
          }
        } catch (e) {
          bug("medium", app, "/telegram-test", e.message.slice(0, 100));
        }
      }
    }
  }
}

async function testHr(page) {
  const app = "ykp-erp-hr";
  const base = "https://ykp-erp-hr-production.up.railway.app";
  console.log(`\n${"=".repeat(60)}\n=== ${app} ===\n${"=".repeat(60)}`);

  const routes = ["/attendance", "/payroll", "/rules", "/employees", "/summary"];

  for (const route of routes) {
    const resp = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    const status = resp?.status() ?? 0;
    const buttonCount = await page.locator("button").count();
    const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 300);

    console.log(`\n  Route ${route}:`);
    console.log(`    status=${status} buttons=${buttonCount}`);

    if (status >= 400 && status !== 307) bug("high", app, route, `HTTP ${status}`, { status });
    else pass(app, route, `${status} buttons=${buttonCount}`);

    await page.screenshot({ path: `${SHOTS}/hr${route.replace(/\//g, "_") || "_root"}.png`, fullPage: false });

    // /payroll Generate
    if (route === "/payroll") {
      const gen = page.locator('button:has-text("Generate")').first();
      if ((await gen.count()) > 0) {
        await gen.click();
        await page.waitForTimeout(1500);
        if ((await page.locator('[role="dialog"]').count()) > 0) {
          pass(app, "/payroll Generate dialog");
          const dateIn = page.locator('input[type="date"]').last();
          if ((await dateIn.count()) > 0) await dateIn.fill("2026-07-01");
          const submit = page.locator('button:has-text("Generate"), button[type="submit"]').last();
          if ((await submit.count()) > 0) {
            try {
              const respP = page.waitForResponse(
                (r) => r.url().includes("/api/hr/payroll") && r.request().method() === "POST",
                { timeout: 30000 }
              ).catch(() => null);
              await submit.click();
              const r = await respP;
              if (r) {
                if (r.status() < 400) pass(app, "/payroll Generate submit", `status=${r.status()}`);
                else bug("high", app, "/payroll Generate", `HTTP ${r.status()}`, { status: r.status(), body: (await r.text()).slice(0, 200) });
              } else {
                bug("medium", app, "/payroll Generate", "no API response");
              }
            } catch (e) {
              bug("medium", app, "/payroll", e.message.slice(0, 100));
            }
          }
        }
      }
    }

    // /rules Tambah Rule
    if (route === "/rules") {
      const tambah = page.locator('button:has-text("Tambah Rule")').first();
      if ((await tambah.count()) > 0) {
        await tambah.click();
        await page.waitForTimeout(1500);
        if ((await page.locator('[role="dialog"]').count()) > 0) {
          pass(app, "/rules Tambah Rule dialog");
          const outletIn = page.locator('input[placeholder*="OL" i]').first();
          if ((await outletIn.count()) > 0) await outletIn.fill("OL-001");
          const shiftIn = page.locator('input[placeholder*="shift" i]').first();
          if ((await shiftIn.count()) > 0) await shiftIn.fill("Pagi");
          const submit = page.locator('button:has-text("Buat"), button[type="submit"]').last();
          if ((await submit.count()) > 0) {
            try {
              const respP = page.waitForResponse(
                (r) => r.url().includes("/api/hr/rules") && r.request().method() === "POST",
                { timeout: 10000 }
              ).catch(() => null);
              await submit.click();
              const r = await respP;
              if (r) {
                if (r.status() < 400) pass(app, "/rules Tambah submit", `status=${r.status()}`);
                else bug("high", app, "/rules Tambah", `HTTP ${r.status()}`, { status: r.status(), body: (await r.text()).slice(0, 200) });
              }
            } catch (e) {
              bug("medium", app, "/rules", e.message.slice(0, 100));
            }
          }
        }
      }
    }

    // /summary Rebuild
    if (route === "/summary") {
      const dateIn = page.locator('input[type="date"]').first();
      if ((await dateIn.count()) > 0) await dateIn.fill("2026-07-10");
      const rebuild = page.locator('button:has-text("Rebuild")').first();
      if ((await rebuild.count()) > 0) {
        try {
          const respP = page.waitForResponse(
            (r) => r.url().includes("/api/hr/summary") && r.request().method() === "POST",
            { timeout: 30000 }
          ).catch(() => null);
          await rebuild.click();
          const r = await respP;
          if (r) {
            if (r.status() < 400) pass(app, "/summary Rebuild", `status=${r.status()}`);
            else bug("high", app, "/summary Rebuild", `HTTP ${r.status()}`, { status: r.status(), body: (await r.text()).slice(0, 200) });
          }
        } catch (e) {
          bug("medium", app, "/summary", e.message.slice(0, 100));
        }
      }
    }
  }
}

/* ----------------- Main ----------------- */

console.log("Launching VISIBLE Chromium browser window...");
const browser = await chromium.launch({
  headless: false,
  executablePath: "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--start-maximized"],
});
console.log("✓ Chrome visible — press Enter if browser doesn't appear\n");

const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  ignoreHTTPSErrors: true,
});

// Inject owner session cookie (signed JWT for testing)
import { spawnSync } from "node:child_process";
const seedOut = spawnSync("node", ["tests/../ykp-erp/tests/seed-session.mjs"], {
  cwd: "D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER",
  encoding: "utf8",
});
const sessionCookie = seedOut.stdout?.match(/ykp_session=([^.\s]+(?:\.[^.\s]+){2})/)?.[1];
if (sessionCookie) {
  await context.addCookies([
    {
      name: "ykp_session",
      value: sessionCookie,
      domain: ".railway.app",
      path: "/",
      httpOnly: true,
      secure: true,
    },
  ]);
  console.log(`✓ Injected session cookie: ${sessionCookie.slice(0, 30)}...`);
} else {
  console.log(`⚠ Failed to extract session cookie. Tests will run unauthenticated.`);
}

// Track all network responses
context.on("response", async (resp) => {
  if (resp.status() >= 400 && resp.url().includes("/api/")) {
    NETWORK_LOG.push({
      url: resp.url(),
      status: resp.status(),
      method: resp.request().method(),
    });
  }
});

const page = await context.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") {
    const txt = msg.text();
    if (!txt.includes("Failed to load resource")) {
      // skip noise from network errors (already captured above)
    }
  }
});

try {
  await testFinance(page);
  await testHermez(page);
  await testHr(page);
} catch (e) {
  console.log(`\nFATAL: ${e.message}\n${e.stack}`);
}

await browser.close();

console.log("\n" + "=".repeat(60));
console.log("COMPREHENSIVE BUG REPORT");
console.log("=".repeat(60));
console.log(`Total passes: ${PASSES.length}`);
console.log(`Total bugs:   ${BUGS.length}`);
console.log(`Network 4xx/5xx captured: ${NETWORK_LOG.length}`);

console.log(`\nBugs by severity:`);
const bySev = {};
for (const b of BUGS) bySev[b.severity] = (bySev[b.severity] ?? 0) + 1;
for (const [s, n] of Object.entries(bySev)) console.log(`  ${s}: ${n}`);

console.log(`\nAll network errors:`);
for (const n of NETWORK_LOG) {
  console.log(`  ${n.status} ${n.method} ${n.url}`);
}

console.log(`\nAll bugs:`);
for (const b of BUGS) {
  console.log(`  [${b.severity}] ${b.app} :: ${b.location}`);
  console.log(`    ${b.description}`);
  if (b.body) console.log(`    Body: ${String(b.body).slice(0, 150)}`);
}

fs.writeFileSync("tests/comprehensive-bug-report.json", JSON.stringify({
  passes: PASSES,
  bugs: BUGS,
  network_log: NETWORK_LOG,
  ts: new Date().toISOString(),
}, null, 2));
console.log(`\nReport saved: tests/comprehensive-bug-report.json`);