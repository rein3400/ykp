import { env } from '../config/env.js';
import { logger } from './logger.js';
import type { InlineKeyboardMarkup } from 'grammy/types';

const TG_API = 'https://api.telegram.org';

export interface TelegramSendOptions {
  chatId?: string;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
  replyMarkup?: InlineKeyboardMarkup;
  retry?: boolean;
}

export async function sendTelegram(opts: TelegramSendOptions): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = opts.chatId ?? env.TELEGRAM_OWNER_CHAT_ID;
  if (!token || !chatId) {
    const err = 'TELEGRAM_BOT_TOKEN or TELEGRAM_OWNER_CHAT_ID not configured';
    logger.warn({ err }, 'telegram.send skipped');
    return { ok: false, error: err };
  }
  const url = `${TG_API}/bot${token}/sendMessage`;
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: opts.text,
      parse_mode: opts.parseMode ?? 'HTML',
      disable_web_page_preview: true
    };
    if (opts.replyMarkup) body.reply_markup = opts.replyMarkup;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json() as { ok: boolean; result?: { message_id: number }; description?: string };
    if (json.ok && json.result) {
      return { ok: true, messageId: json.result.message_id };
    }
    if (opts.retry !== false) {
      await new Promise((r) => setTimeout(r, 500));
      return sendTelegram({ ...opts, retry: false });
    }
    return { ok: false, error: json.description ?? 'unknown' };
  } catch (err) {
    logger.error({ err }, 'telegram.send failed');
    if (opts.retry !== false) {
      await new Promise((r) => setTimeout(r, 1000));
      return sendTelegram({ ...opts, retry: false });
    }
    return { ok: false, error: (err as Error).message };
  }
}