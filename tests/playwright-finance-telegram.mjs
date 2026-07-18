/**
 * Playwright-only: Finance Settings "Telegram Test Send" button.
 * Hub login → SSO OWNER → /settings → Kirim → assert Terkirim. message_id=
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const HUB = "https://ykp-hub-production.up.railway.app";
const FINANCE = "https://ykp-erp-finance-production.up.railway.app";
const OUT = path.resolve("tests/playwright-finance-telegram");
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
  const results = { ok: false, messageId: null, resultText: null, error: null, roleTried: null };

  try {
    log("1. Login via Hub ...");
    await page.goto(HUB, { waitUntil: "networkidle" });
    await page.locator("input[autocomplete='username']").fill("owner");
    await page.locator("input[autocomplete='current-password']").fill("owner123");
    await page.locator("button[type='submit']").click();
    await page.waitForTimeout(2000);
    await shot(page, "hub-logged-in");

    // Finance requires OWNER (or SUPER_ADMIN / FINANCE_ADMIN) for telegram-test.
    // Try OWNER first (finance primary role), then SUPER_ADMIN.
    const roles = ["OWNER", "SUPER_ADMIN"];
    let cardVisible = false;
    for (const role of roles) {
      results.roleTried = role;
      log(`2. SSO Finance role=${role} → /settings ...`);
      await page.goto(`${FINANCE}/api/auth/login?role=${role}&redirect=/settings`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(2000);
      await shot(page, `sso-${role.toLowerCase()}`);

      const title = page.locator("text=Telegram Test Send").first();
      cardVisible = await title.isVisible().catch(() => false);
      if (cardVisible) {
        log(`   card visible with role=${role}`);
        break;
      }
      log(`   card not visible with role=${role}, body: ${(await page.locator("body").textContent())?.slice(0, 200)}`);
    }
    if (!cardVisible) throw new Error("Telegram Test Send card not visible after SSO attempts");

    const testMsg = `🧪 Finance Playwright test — ${new Date().toISOString()}`;
    log(`3. Fill message: ${testMsg}`);
    // Card input is the first (only) input inside the Telegram Test Send card area.
    // Settings page has one free-standing Input for telegram (tabs use tables, not free inputs).
    const telegramInput = page.locator("input").last();
    await telegramInput.fill(testMsg);
    await shot(page, "message-filled");

    log("4. Click Kirim ...");
    await page.locator("button:has-text('Kirim')").first().click();

    // Wait for success or error text
    const resultLocator = page.locator("p.mt-3.text-sm").filter({ hasText: /Terkirim|Gagal/ }).first();
    await resultLocator.waitFor({ timeout: 20000 });
    const resultText = await resultLocator.textContent();
    results.resultText = resultText;
    log(`   result: ${resultText}`);

    const match = resultText?.match(/message_id[=:\s]+(\d+)/i);
    if (match) results.messageId = Number(match[1]);
    results.ok = Boolean(resultText?.includes("Terkirim") && results.messageId != null);
    await shot(page, "after-send");

    // Best-effort Telegram API cross-check (group -5437367893)
    if (results.messageId && process.env.TELEGRAM_BOT_TOKEN) {
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/copyMessage`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              chat_id: "-5437367893",
              from_chat_id: "-5437367893",
              message_id: results.messageId,
            }),
          },
        );
        const json = await res.json();
        results.telegramApiOk = json.ok;
        results.telegramApiDetail = json.ok
          ? `copied to ${json.result.message_id}`
          : json.description;
      } catch (e) {
        results.telegramApiDetail = String(e);
      }
    }
  } catch (e) {
    results.error = e instanceof Error ? e.message : String(e);
    log(`ERROR: ${results.error}`);
    await shot(page, "error").catch(() => {});
  }

  fs.writeFileSync(
    path.join(OUT, "report.json"),
    JSON.stringify({ ts: new Date().toISOString(), results }, null, 2),
  );
  await browser.close();
  log(`\nRESULT: ok=${results.ok} messageId=${results.messageId} ${results.telegramApiDetail ?? ""}`);
  process.exit(results.ok ? 0 : 1);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
