// ============================================================
// @ykp/engine — Telegram sender
// ------------------------------------------------------------
// Sends a message via Telegram Bot API. Retries once on
// transient failure. No external SDK — uses native fetch.
// ============================================================

const API = "https://api.telegram.org";

export type TelegramSendResult =
  | { ok: true; messageId: number }
  | { ok: false; error: string };

/**
 * Send a Telegram message to a chat. Token and chatId required.
 * Returns ok:true with messageId on success, ok:false on any failure.
 * Retries once on network/5xx errors.
 */
export async function sendTelegramMessage(
  token: string,
  chatId: string | number,
  text: string,
): Promise<TelegramSendResult> {
  if (!token || !chatId) {
    return { ok: false, error: "missing_token_or_chat_id" };
  }
  if (text.length > 4096) {
    return { ok: false, error: `text_too_long_${text.length}` };
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
        if (attempt === MAX_ATTEMPTS) return { ok: false, error: `http_${res.status}:${detail.slice(0, 200)}` };
        await sleep(BACKOFF_MS[attempt - 1] ?? 4000);
        continue;
      }
      const json = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
      if (!json.ok) {
        return { ok: false, error: json.description ?? "telegram_returned_not_ok" };
      }
      return { ok: true, messageId: json.result?.message_id ?? 0 };
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      await sleep(BACKOFF_MS[attempt - 1] ?? 4000);
    }
  }
  return { ok: false, error: "exhausted_retries" };
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