/**
 * Playwright-only end-to-end: generate Hermez daily brief, then send the
 * actual brief text to the Telegram group via the deployed website's
 * "Tes Telegram" button.
 *
 * Steps:
 *  1. Login via YKP Hub
 *  2. SSO into Hermez as SUPER_ADMIN
 *  3. Visit /run, generate brief for 2026-07-15
 *  4. Fetch briefText from /api/hermez/brief?date= inside the page
 *  5. Visit /telegram-test, paste briefText, click "Kirim"
 *  6. Assert result shows "Terkirim (message_id: <number>)"
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const HUB = "https://ykp-hub-production.up.railway.app";
const HERMEZ = "https://ykp-erp-hermez-production.up.railway.app";
const DATE = "2026-07-15";
const OUT = path.resolve("tests/playwright-telegram-daily-brief");
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
  const results = { ok: false, briefId: null, messageId: null, error: null };

  try {
    // 1. Login via YKP Hub
    log("1. Login via Hub ...");
    await page.goto(HUB, { waitUntil: "networkidle" });
    await page.locator("input[autocomplete='username']").fill("owner");
    await page.locator("input[autocomplete='current-password']").fill("owner123");
    await page.locator("button[type='submit']").click();
    await page.waitForTimeout(2000);
    await shot(page, "hub-logged-in");

    // 2. SSO into Hermez as SUPER_ADMIN
    log("2. SSO into Hermez ...");
    await page.goto(`${HERMEZ}/api/auth/login?role=SUPER_ADMIN&redirect=/run`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, "hermez-run");

    // 3. Generate brief via /run page
    log(`3. Generate brief for ${DATE} via button ...`);
    await page.locator("input[type='date']").first().fill(DATE);
    await shot(page, "run-before-generate");
    await page.locator("button:has-text('Generate brief')").first().click();
    // Result card appears with brief_id text. Brief generation can take a few
    // seconds (reads 4 DBs + runs 7 triggers across outlets). Wait up to 60s.
    const resultCard = page.locator("div.rounded-md.border.bg-muted\\/30").first();
    try {
      await resultCard.waitFor({ state: "visible", timeout: 60000 });
      await resultCard.locator("code").first().waitFor({ timeout: 10000 });
    } catch {
      await shot(page, "run-generate-timeout");
      const bodyText = await page.locator("body").textContent();
      throw new Error(`brief result card not visible. body: ${bodyText?.slice(0, 300)}`);
    }
    const runResult = await resultCard.textContent();
    const briefIdMatch = runResult.match(/brief_id:\s*(HZBR-\d+)/);
    if (!briefIdMatch) throw new Error(`brief_id not found in run result: ${runResult?.slice(0, 200)}`);
    results.briefId = briefIdMatch[1];
    log(`   generated ${results.briefId}`);
    await shot(page, "brief-generated");

    // 4. Fetch briefText via API inside browser context
    log("4. Fetch briefText from API inside browser ...");
    const brief = await page.evaluate(async ({ url, date }) => {
      const res = await fetch(`${url}/api/hermez/brief?date=${date}`);
      return res.json();
    }, { url: HERMEZ, date: DATE });
    if (!brief?.data?.brief?.briefText) throw new Error("briefText missing from API response");
    const briefText = brief.data.brief.briefText;
    log(`   briefText length ${briefText.length}, level ${brief.data.brief.alertLevel}, alerts unknown`);

    // 5. Go to telegram-test and send the real brief
    log("5. Navigate to Telegram test page ...");
    await page.goto(`${HERMEZ}/telegram-test`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await shot(page, "telegram-test-before");

    const textarea = page.locator("textarea").first();
    await textarea.fill(briefText);
    await shot(page, "telegram-test-filled");

    log("6. Click Kirim button ...");
    await page.locator("button:has-text('Kirim')").first().click();

    const resultLocator = page.locator("p.text-sm").filter({ hasText: /Terkirim|Gagal/ }).first();
    await resultLocator.waitFor({ timeout: 15000 });
    const resultText = await resultLocator.textContent();
    results.resultText = resultText;
    log(`   result: ${resultText}`);

    const msgMatch = resultText.match(/message_id:\s*(\d+)/);
    if (msgMatch) results.messageId = Number(msgMatch[1]);
    results.ok = resultText.includes("Terkirim") && results.messageId != null;
    await shot(page, "telegram-test-after");

    // 7. Best-effort verify via Telegram API
    if (results.messageId) {
      try {
        const token = process.env.TELEGRAM_BOT_TOKEN || "";
        const res = await fetch(`https://api.telegram.org/bot${token}/copyMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: "-5437367893", from_chat_id: "-5437367893", message_id: results.messageId }),
        });
        const json = await res.json();
        results.telegramApiOk = json.ok;
        results.telegramApiDetail = json.ok ? `copied to ${json.result.message_id}` : json.description;
      } catch (e) {
        results.telegramApiDetail = String(e);
      }
    }
  } catch (e) {
    results.error = e instanceof Error ? e.message : String(e);
    log(`ERROR: ${results.error}`);
    await shot(page, "error").catch(() => {});
  }

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ ts: new Date().toISOString(), results }, null, 2));
  await browser.close();

  log(`\nRESULT: ok=${results.ok} briefId=${results.briefId} messageId=${results.messageId} ${results.telegramApiDetail ?? ""}`);
  process.exit(results.ok ? 0 : 1);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
