/**
 * Hermez Telegram dialog bot worker.
 *
 * Long-polls Telegram getUpdates and replies to owner commands
 * (/brief /omzet /hr /alerts /sop) plus free-text AI dialog via
 * the owner-configured LLM (Konfigurasi → Integrasi).
 *
 * Started alongside `next start` in the Docker CMD (unless
 * HERMEZ_BOT_DISABLED=true). Safe to run standalone:
 *   node apps/hermez/src/workers/bot-worker.cjs
 */
/* eslint-disable @typescript-eslint/no-var-requires */

// Load engine dist via workspace node_modules.
const { startTelegramBot, getBotStatus } = require("@ykp/engine/telegram-bot");
const { initDbClients } = require("@ykp/schema");

async function main() {
  if (process.env.HERMEZ_BOT_DISABLED === "true") {
    console.log("[hermez-bot] HERMEZ_BOT_DISABLED=true — not starting.");
    return;
  }
  try {
    initDbClients();
  } catch (e) {
    console.error("[hermez-bot] initDbClients failed:", e);
    process.exit(1);
  }
  const res = await startTelegramBot();
  if (res.started) {
    console.log("[hermez-bot] polling started", JSON.stringify(getBotStatus()));
  } else {
    console.log(`[hermez-bot] not started: ${res.reason ?? "unknown"}`);
    // Don't crash the container — the web app keeps running; owner may
    // not have set telegram credentials yet. Exit 0 so the shell `&`
    // chain stays quiet.
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("[hermez-bot] fatal:", e);
  process.exit(1);
});
