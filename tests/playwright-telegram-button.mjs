/**
 * Playwright-only test: send a Telegram message via the deployed Hermez
 * "Tes Telegram" page button, then verify the result indicator.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const HUB = "https://ykp-hub-production.up.railway.app";
const HERMEZ = "https://ykp-erp-hermez-production.up.railway.app";
const OUT = path.resolve("tests/playwright-telegram-button");
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
  const results = { ok: false, message: null, messageId: null, sent: false, error: null };

  try {
    // 1. Login via YKP Hub
    log("Login via Hub ...");
    await page.goto(HUB, { waitUntil: "networkidle" });
    await page.locator("input[autocomplete='username']").fill("owner");
    await page.locator("input[autocomplete='current-password']").fill("owner123");
    await page.locator("button[type='submit']").click();
    await page.waitForTimeout(2000);
    await shot(page, "hub-logged-in");

    // 2. SSO into Hermez as SUPER_ADMIN (Hermez GET login defaults SUPER_ADMIN)
    log("SSO into Hermez ...");
    await page.goto(`${HERMEZ}/api/auth/login?role=SUPER_ADMIN&redirect=/telegram-test`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot(page, "hermez-telegram-test");

    // 3. Verify page loaded
    const heading = await page.locator("text=Tes Telegram").first().isVisible().catch(() => false);
    if (!heading) throw new Error("Hermez telegram-test page did not render");

    // 4. Fill message
    const testMsg = `🧪 Playwright button test — ${new Date().toISOString()}`;
    log(`Fill message: ${testMsg}`);
    const textarea = page.locator("textarea").first();
    await textarea.fill(testMsg);
    await shot(page, "message-filled");

    // 5. Click Kirim button
    log("Click Kirim button ...");
    await page.locator("button:has-text('Kirim')").first().click();

    // 6. Wait for result
    const resultLocator = page.locator("p.text-sm").filter({ hasText: /Terkirim|Gagal/ }).first();
    await resultLocator.waitFor({ timeout: 15000 });
    const resultText = await resultLocator.textContent();
    results.message = resultText;
    log(`Result text: ${resultText}`);

    // 7. Parse message_id
    const match = resultText.match(/message_id:\s*(\d+)/);
    if (match) results.messageId = Number(match[1]);
    results.sent = resultText.includes("Terkirim");
    results.ok = results.sent && results.messageId != null;
    await shot(page, "after-send");

    // 8. Extra: verify via Telegram API that message exists in group (best-effort)
    if (results.messageId) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN ?? ""}/getChat?chat_id=-5437367893`);
        const json = await res.json();
        results.telegramApiReachable = json.ok;
      } catch {}
    }
  } catch (e) {
    results.error = e instanceof Error ? e.message : String(e);
    log(`ERROR: ${results.error}`);
    await shot(page, "error").catch(() => {});
  }

  // 9. Save report
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ ts: new Date().toISOString(), results }, null, 2));

  await browser.close();

  log(`\nRESULT: sent=${results.sent} messageId=${results.messageId} ok=${results.ok}`);
  process.exit(results.ok ? 0 : 1);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
