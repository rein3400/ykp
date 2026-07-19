/**
 * Hermez Telegram dialog bot worker (standalone Railway service).
 *
 * This is the single getUpdates consumer for the bot token. The web service
 * only sends outbound messages and never long-polls, so there is no
 * two-consumer conflict. Long-polls and replies to owner commands
 * (/brief /omzet /hr /alerts /sop) plus free-text AI dialog via the
 * owner-configured LLM (Konfigurasi → Integrasi).
 *
 * Required env (same as web service): YKP_HERMEZ_DATABASE_URL,
 * YKP_HR_DATABASE_URL, YKP_FINANCE_DATABASE_URL (+ master if used).
 * Telegram/LLM creds are read from hermez_config (UI), env as fallback.
 *
 * Optional: HERMEZ_BOT_DISABLED=true to no-op.
 */
/* eslint-disable @typescript-eslint/no-var-requires */

const REQUIRED_ENV = [
  "YKP_HERMEZ_DATABASE_URL",
  "YKP_HR_DATABASE_URL",
  "YKP_FINANCE_DATABASE_URL",
];

function checkEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[hermez-bot] missing env: ${missing.join(", ")}`);
    return false;
  }
  return true;
}

async function run() {
  if (process.env.HERMEZ_BOT_DISABLED === "true") {
    console.log("[hermez-bot] HERMEZ_BOT_DISABLED=true — not starting.");
    return;
  }
  if (!checkEnv()) {
    // Exit non-zero so Railway restarts with a clear log; env fix required.
    process.exit(1);
  }

  const { initDbClients } = require("@ykp/schema");
  const { startTelegramBot, getBotStatus } = require("@ykp/engine/telegram-bot");

  try {
    initDbClients();
  } catch (e) {
    console.error("[hermez-bot] initDbClients failed:", e);
    process.exit(1);
  }

  const res = await startTelegramBot();
  if (!res.started) {
    console.log(`[hermez-bot] not started: ${res.reason ?? "unknown"}`);
    // Credentials not set yet — exit 0 and let the owner set them in the UI,
    // then Railway restart (or a manual redeploy) picks them up. Exiting 1
    // would crash-loop the service on a fresh deploy before config exists.
    process.exit(0);
  }
  console.log("[hermez-bot] polling started", JSON.stringify(getBotStatus()));

  // Keepalive: log status every 5 min so Railway logs show the worker is alive.
  const t = setInterval(() => {
    const s = getBotStatus();
    console.log(
      `[hermez-bot] alive polls=${s.pollCycles} updates=${s.updatesSeen} handled=${s.messagesHandled} lastErr=${s.lastError ?? "-"}`,
    );
  }, 5 * 60 * 1000);
  t.unref?.();
}

run().catch((e) => {
  console.error("[hermez-bot] fatal:", e);
  process.exit(1);
});
