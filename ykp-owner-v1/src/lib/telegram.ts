/**
 * Telegram reporting for Owner V1 — delivery-only, same conventions as the
 * sibling modules (finance/hr): no log table in this app, delivery failures
 * resolve (never throw) so the request path never breaks, and callers log
 * results in their own domain stores. Auth uses the bot token + broadcast
 * chat from env (owner broadcast); delivery itself never writes to Sheets.
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_CHAT_ID, TELEGRAM_BOT_SECRET
 * If not configured, sends resolve FAILED (no crash).
 */

function clean(v: string | undefined): string {
  return (v ?? '').trim();
}

const TOKEN = () => clean(process.env.TELEGRAM_BOT_TOKEN);
const CHAT_ID = () => clean(process.env.TELEGRAM_BOT_CHAT_ID);

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export interface OwnerDailyBriefPayload {
  date: string;
  text: string;
  sourceReferenceId?: string;
}

export interface OwnerTelegramResult {
  status: 'SENT' | 'SKIPPED' | 'FAILED';
  chatId: string;
  messageId?: string;
  error?: string;
}

/** Send the composed owner daily brief to the broadcast chat. */
export async function sendOwnerDailyBrief(payload: OwnerDailyBriefPayload): Promise<OwnerTelegramResult> {
  const token = TOKEN();
  const chatId = CHAT_ID();
  if (!token || !chatId) {
    return { status: 'FAILED', chatId: '', error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_CHAT_ID not configured' };
  }
  try {
    const res = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: payload.text, parse_mode: 'HTML', disable_web_page_preview: true })
      },
      12_000
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { status: 'FAILED', chatId, error: `Telegram HTTP ${res.status}: ${text.slice(0, 160)}` };
    }
    const json = (await res.json()) as { ok?: boolean; result?: { message_id?: number }; description?: string };
    if (!json.ok) {
      return { status: 'FAILED', chatId, error: json.description ?? 'Telegram API rejected the message' };
    }
    return { status: 'SENT', chatId, messageId: String(json.result?.message_id ?? '') };
  } catch (e) {
    return { status: 'FAILED', chatId, error: e instanceof Error ? e.message : 'Unknown send error' };
  }
}
