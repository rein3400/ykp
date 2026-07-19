/**
 * Hermez Telegram outbound sender.
 *
 * Hermez does not need a persistent bot listener; it only sends briefs
 * and alerts to OWNER_CHAT_ID (group chat preferred). This worker simply
 * ensures environment variables are loaded and a test message can be sent.
 *
 * Token/chat resolution: hermez_config (owner-set via UI) wins; env fallback:
 *   HERMEZ_TELEGRAM_BOT_TOKEN > TELEGRAM_BOT_TOKEN
 *   OWNER_CHAT_ID > TELEGRAM_OWNER_CHAT_ID
 */
import { sendTelegramMessage } from "@ykp/engine/telegram";
import { resolveTelegramCredentials } from "@ykp/engine/integrations";

export async function sendHermezTelegramMessage(text: string) {
  const { token, chatId } = await resolveTelegramCredentials();
  if (!token || !chatId) {
    return { ok: false, error: "missing_token_or_chat_id" } as const;
  }
  return sendTelegramMessage(token, chatId, text);
}

// Standalone run support: node workers/telegram-bot.ts "test message"
if (require.main === module) {
  const text = process.argv[2] || "🧠 YKP Hermez Telegram test message";
  void sendHermezTelegramMessage(text).then((res) => {
    if (res.ok) {
      console.log("[telegram-bot] sent", res.messageId);
      process.exit(0);
    }
    console.error("[telegram-bot] failed:", res.error);
    process.exit(1);
  });
}
