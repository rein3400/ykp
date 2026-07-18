/**
 * Playwright: Warehouse /api/warehouse/telegram-test endpoint (authenticated).
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const WAREHOUSE = "https://ykp-warehouse-v1.vercel.app";
const OUT = path.resolve("tests/playwright-warehouse-telegram-test");
fs.mkdirSync(OUT, { recursive: true });

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const shot = async (page, name) => {
  const file = path.join(OUT, `${String(++shot.i).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  log(`📸 ${path.basename(file)}`);
};
shot.i = 0;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const results = { ok: false, status: null, sent: false, deliveryId: null, error: null };

  try {
    log("1. Navigate to warehouse origin ...");
    await page.goto(WAREHOUSE, { waitUntil: "domcontentloaded", timeout: 60000 });
    await shot(page, "warehouse-root");

    log("2. Login via API (same origin) ...");
    const login = await page.evaluate(async () => {
      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "owner", password: "owner123" }),
        credentials: "include",
      });
      return { status: res.status };
    });
    log(`   login status=${login.status}`);
    if (login.status !== 200) throw new Error(`login failed ${login.status}`);

    log("3. POST /api/warehouse/telegram-test ...");
    const test = await page.evaluate(async () => {
      const res = await fetch(`/api/warehouse/telegram-test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: `🧪 Warehouse Playwright test ${new Date().toISOString()}` }),
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    });
    log(`   status=${test.status} body=${JSON.stringify(test.body)}`);
    await shot(page, "after-test");
    results.status = test.status;
    results.sent = Boolean(test.body?.data?.sent ?? test.body?.sent);
    results.deliveryId = test.body?.data?.deliveryId ?? test.body?.deliveryId ?? null;
    results.ok = test.status === 200 && results.sent;
  } catch (e) {
    results.error = e instanceof Error ? e.message : String(e);
    log(`ERROR: ${results.error}`);
    await shot(page, "error").catch(() => {});
  }

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ ts: new Date().toISOString(), results }, null, 2));
  await browser.close();
  log(`\nRESULT: ok=${results.ok} status=${results.status} sent=${results.sent} deliveryId=${results.deliveryId}`);
  process.exit(results.ok ? 0 : 1);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
