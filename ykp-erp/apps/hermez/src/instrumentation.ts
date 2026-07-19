/**
 * Next.js instrumentation hook — runs once per server process at boot.
 * Auto-starts the Hermez Telegram dialog bot in this web process when
 * credentials are configured, so the owner can chat without first
 * pressing Start in the UI. Single consumer (no co-launched worker),
 * so no getUpdates conflict. Disable with HERMEZ_BOT_DISABLED=true.
 */
export async function register() {
  // Only in the Node.js runtime (not edge), and not during build.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.HERMEZ_BOT_DISABLED === "true") return;

  try {
    const { initDbClients } = await import("@ykp/schema");
    initDbClients();
    const { startTelegramBot } = await import("@ykp/engine/telegram-bot");
    const res = await startTelegramBot();
    if (res.started) {
      console.log("[hermez-bot] auto-started (polling)");
    } else {
      console.log(`[hermez-bot] not auto-started: ${res.reason ?? "unknown"}`);
    }
  } catch (e) {
    // Never block boot on bot failure.
    console.error("[hermez-bot] auto-start failed:", e instanceof Error ? e.message : e);
  }
}
