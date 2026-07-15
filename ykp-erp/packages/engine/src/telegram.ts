// ============================================================
// @ykp/engine — Telegram sender
// ------------------------------------------------------------
// Sends a message via Telegram Bot API. Retries with exponential
// backoff on transient failure. No external SDK — uses native
// fetch. Every terminal outcome is written to hermez_telegram_log
// (best-effort; never fails the caller).
// ============================================================

import { getHermezDb, hermezTelegramLog } from "@ykp/schema";

const API = "https://api.telegram.org";

export type TelegramSendResult =
  | { ok: true; messageId: number }
  | { ok: false; error: string };

/**
 * Send a Telegram message to a chat. Token and chatId required.
 * Returns ok:true with messageId on success, ok:false on any failure.
 * Retries with exponential backoff on network/5xx errors.
 * Always attempts to insert a hermez_telegram_log row on terminal outcome.
 */
export async function sendTelegramMessage(
  token: string,
  chatId: string | number,
  text: string,
  channel: "owner" | "group" = "owner",
): Promise<TelegramSendResult> {
  if (!token || !chatId) {
    const result: TelegramSendResult = { ok: false, error: "missing_token_or_chat_id" };
    await logTelegramDelivery(chatId, channel, result, 0);
    return result;
  }
  if (text.length > 4096) {
    const result: TelegramSendResult = { ok: false, error: `text_too_long_${text.length}` };
    await logTelegramDelivery(chatId, channel, result, 0);
    return result;
  }

  const url = `${API}/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });

  // Exponential backoff: 1s, 2s, 4s between attempts.
  const BACKOFF_MS = [1000, 2000, 4000];
  const MAX_ATTEMPTS = BACKOFF_MS.length + 1;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        if (attempt === MAX_ATTEMPTS) {
          const result: TelegramSendResult = {
            ok: false,
            error: `http_${res.status}:${detail.slice(0, 200)}`,
          };
          await logTelegramDelivery(chatId, channel, result, attempt - 1);
          return result;
        }
        await sleep(BACKOFF_MS[attempt - 1] ?? 4000);
        continue;
      }
      const json = (await res.json()) as {
        ok: boolean;
        result?: { message_id: number };
        description?: string;
      };
      if (!json.ok) {
        const result: TelegramSendResult = {
          ok: false,
          error: json.description ?? "telegram_returned_not_ok",
        };
        await logTelegramDelivery(chatId, channel, result, attempt - 1);
        return result;
      }
      const result: TelegramSendResult = {
        ok: true,
        messageId: json.result?.message_id ?? 0,
      };
      await logTelegramDelivery(chatId, channel, result, attempt - 1);
      return result;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        const result: TelegramSendResult = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
        await logTelegramDelivery(chatId, channel, result, attempt - 1);
        return result;
      }
      await sleep(BACKOFF_MS[attempt - 1] ?? 4000);
    }
  }
  const result: TelegramSendResult = { ok: false, error: "exhausted_retries" };
  await logTelegramDelivery(chatId, channel, result, MAX_ATTEMPTS - 1);
  return result;
}

/**
 * Best-effort insert into hermez_telegram_log.
 * Silently no-ops when the Hermez DB client is not initialised
 * (e.g. unit tests, finance telegram-test without hermez schema).
 */
async function logTelegramDelivery(
  chatId: string | number,
  channel: "owner" | "group",
  result: TelegramSendResult,
  retryCount: number,
): Promise<void> {
  try {
    const db = getHermezDb();
    await db.insert(hermezTelegramLog).values({
      logId: crypto.randomUUID(),
      messageId: result.ok ? String(result.messageId) : null,
      recipient: String(chatId ?? ""),
      channel,
      status: result.ok ? "sent" : "failed",
      sentAt: new Date(),
      errorMessage: result.ok ? null : result.error,
      retryCount,
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[telegram] failed to write delivery log:", e);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** HTML escape for user-controlled content embedded in Telegram HTML messages. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}