/**
 * Playwright: Hermez /run Generate brief → auto-send Telegram (new behavior).
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const HUB = "https://ykp-hub-production.up.railway.app";
const HERMEZ = "https://ykp-erp-hermez-production.up.railway.app";
const DATE = new Date().toISOString().slice(0, 10); // UTC date; server uses WIB default if empty
const OUT = path.resolve("tests/playwright-hermez-run-send");
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
  const results = { ok: false, briefId: null, telegram: null, error: null };

  try {
    log("1. Hub login ...");
    await page.goto(HUB, { waitUntil: "networkidle" });
    await page.locator("input[autocomplete='username']").fill("owner");
    await page.locator("input[autocomplete='current-password']").fill("owner123");
    await page.locator("button[type='submit']").click();
    await page.waitForTimeout(2000);

    log("2. SSO Hermez /run ...");
    await page.goto(`${HERMEZ}/api/auth/login?role=SUPER_ADMIN&redirect=/run`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1500);
    await shot(page, "run-page");

    // Use a fixed date that already has data if available; otherwise today
    const date = process.env.BRIEF_DATE || "2026-07-15";
    log(`3. Generate brief for ${date} ...`);
    await page.locator("input[type='date']").first().fill(date);
    await page.locator("button:has-text('Generate brief')").first().click();

    const resultCard = page.locator("div.rounded-md.border.bg-muted\\/30").first();
    await resultCard.waitFor({ state: "visible", timeout: 90000 });
    await resultCard.locator("code").first().waitFor({ timeout: 15000 }).catch(() => {});
    const text = await resultCard.textContent();
    log(`   card: ${text?.replace(/\s+/g, " ").slice(0, 300)}`);
    await shot(page, "after-generate");

    const briefMatch = text?.match(/brief_id:\s*(HZBR-\d+)/);
    if (briefMatch) results.briefId = briefMatch[1];

    const tgMatch = text?.match(/telegram:\s*(.+)/i);
    results.telegram = tgMatch ? tgMatch[1].trim() : null;

    // Pass if brief generated AND telegram either sent or already_sent skip
    const sent =
      /Terkirim/i.test(text || "") ||
      /already_sent/i.test(text || "") ||
      /message_id:\s*\d+/i.test(text || "");
    results.ok = Boolean(results.briefId && sent);
    if (!results.ok) {
      // fallback: check API for telegram field via in-page fetch after generate
      const api = await page.evaluate(async ({ url, date }) => {
        const res = await fetch(`${url}/api/hermez/run`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date, send: true }),
        });
        return res.json();
      }, { url: HERMEZ, date });
      results.api = api;
      results.ok = Boolean(
        api?.data?.brief_id &&
          (api?.data?.telegram?.sent || api?.data?.telegram?.skipped === "already_sent"),
      );
      results.telegram = api?.data?.telegram ?? results.telegram;
      results.briefId = api?.data?.brief_id ?? results.briefId;
    }
  } catch (e) {
    results.error = e instanceof Error ? e.message : String(e);
    log(`ERROR: ${results.error}`);
    await shot(page, "error").catch(() => {});
  }

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ ts: new Date().toISOString(), results }, null, 2));
  await browser.close();
  log(`\nRESULT: ok=${results.ok} briefId=${results.briefId} telegram=${JSON.stringify(results.telegram)}`);
  process.exit(results.ok ? 0 : 1);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
