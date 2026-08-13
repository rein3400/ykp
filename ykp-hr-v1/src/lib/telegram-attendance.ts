/**
 * Telegram absen bridge (brief §6.3 "Telegram bot jika sudah ada").
 *
 * Pure command/text helpers plus a small Telegram Bot API client. The webhook
 * route composes these with attendance-service so the exact same clock-in/out
 * path (radius, lateness, idempotency) runs for Telegram and web.
 */

export interface TelegramLocation {
  latitude: number;
  longitude: number;
}

export interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    chat?: { id?: number; username?: string };
    text?: string;
    location?: TelegramLocation;
  };
}

export type AbsenIntent = 'clock-in' | 'clock-out' | 'help' | 'unknown';

/** Map a Telegram text message to an absen intent. */
export function parseAbsenIntent(text: string | undefined): AbsenIntent {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return 'unknown';
  if (/^\/(start|help|bantuan|mulai)\b/.test(t)) return 'help';
  if (/^\/(masuk|absen|clockin|clock_in|checkin|check_in)\b/.test(t)) return 'clock-in';
  if (/^\/(pulang|keluar|clockout|clock_out|checkout|check_out)\b/.test(t)) return 'clock-out';
  return 'unknown';
}

export const HELP_TEXT = [
  'YKP HR Absen Bot',
  '',
  '/masuk — absen masuk (kirim lokasi atau langsung /masuk)',
  '/pulang — absen pulang',
  '/help — bantuan',
  '',
  'Untuk deteksi lokasi: kirim lokasi Telegram, atau /masuk lalu tekan tombol "Kirim Lokasi".'
].join('\n');

/** Send a Telegram message. Returns sent message id, or null on failure. */
export async function sendTelegramText(
  token: string,
  chatId: number,
  text: string,
  replyMarkup?: unknown
): Promise<string | null> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    })
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: { message_id?: number } };
  if (!data.ok) return null;
  return String(data.result?.message_id ?? '');
}

/** Inline keyboard / reply-keyboard asking the user to share their location. */
export function locationReplyMarkup(): unknown {
  return {
    keyboard: [[{ text: 'Kirim Lokasi', request_location: true }]],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

/** HTML-escape user-controlled content before embedding in Telegram HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
