/**
 * Minimal Telegram Bot API client — long polling, no dependencies.
 * Long polling (not webhook) so the service works behind NAT/Tunnel with
 * zero network config. DRY-RUN (no token): logs instead of sending.
 */
import { CONFIG, DRY_RUN } from './config.js';

export interface TgMessage {
  message_id: number;
  from?: { id: number; first_name?: string; username?: string };
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
  voice?: { file_id: string; duration: number; mime_type?: string };
  photo?: { file_id: string; width: number; height: number }[];
  date: number;
}

/** Inline-keyboard button press (approval buttons, Fase 4). */
export interface TgCallbackQuery {
  id: string;
  from?: { id: number; first_name?: string; username?: string };
  /** The message the button was attached to (may be absent for old messages). */
  message?: { message_id: number; chat: { id: number; type: string }; text?: string };
  data?: string;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

/** Inline keyboard markup (approval buttons, Fase 4). */
export interface InlineKeyboard {
  inline_keyboard: { text: string; callback_data: string }[][];
}

const API = () => `https://api.telegram.org/bot${CONFIG.botToken}`;

async function api<T>(method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API()}/${method}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const json = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
  return json.result;
}

/** Long-poll for updates. Returns [] on timeout (normal). */
export async function pollUpdates(offset: number, timeoutSec = 30): Promise<TgUpdate[]> {
  try {
    return await api<TgUpdate[]>('getUpdates', {
      offset,
      timeout: timeoutSec,
      allowed_updates: ['message', 'callback_query']
    });
  } catch (e) {
    // Network hiccup: caller backs off and retries.
    console.error('[telegram] poll error:', e instanceof Error ? e.message : e);
    return [];
  }
}

/** Strip malformed HTML that Telegram can't parse.
 *  Telegram supports a strict subset: <b>, <i>, <u>, <s>, <strong>, <em>, <ins>, <strike>, <del>,
 *  <span>, <tg-spoiler>, <a href="...">, <pre>, <code>, <br>.
 *  Any `<` that's NOT part of one of these tags breaks parse_mode=HTML. */
function escapeHtmlTags(text: string): string {
  return text
    // Escape all `<` and `>` first
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Restore whitelisted valid tags
    .replace(/&lt;(\/?)(b|strong|i|em|u|ins|s|strike|del|span|tg-spoiler|pre|code|br)(\s[^&]*?)?&gt;/gi, '<$1$2$3>')
    .replace(/&lt;a(\s+href=&quot;.*?&quot;[^&]*?)?&gt;(.*?)&lt;\/a&gt;/gi, '<a$1>$2</a>');
}

/** Send text (HTML), chunked to Telegram's 4096-char limit. */
export async function sendMessage(chatId: number, text: string, replyMarkup?: unknown): Promise<number | null> {
  const chunks: string[] = [];
  let rest = escapeHtmlTags(text);
  while (rest.length > CONFIG.telegramChunk) {
    let cut = rest.lastIndexOf('\n', CONFIG.telegramChunk);
    if (cut < CONFIG.telegramChunk / 2) cut = CONFIG.telegramChunk;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  chunks.push(rest);

  // Inline keyboard only on the LAST chunk — buttons belong at the end.
  const markup = replyMarkup && chunks.length > 0 ? { reply_markup: replyMarkup } : {};

  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    if (DRY_RUN) {
      console.log(`\n[DRY-RUN telegram → ${chatId}]\n${chunks[i]}\n`);
      continue;
    }
    try {
      const sent = await api<{ message_id: number }>('sendMessage', {
        chat_id: chatId,
        text: chunks[i],
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(isLast ? markup : {})
      });
      if (isLast) return sent.message_id;
    } catch (e) {
      // If HTML parsing still fails, fall back to plain text (markup kept)
      console.warn('[telegram] HTML parse failed, falling back to plain text:', e instanceof Error ? e.message : e);
      const sent = await api<{ message_id: number }>('sendMessage', {
        chat_id: chatId,
        text: chunks[i],
        disable_web_page_preview: true,
        ...(isLast ? markup : {})
      });
      if (isLast) return sent.message_id;
    }
  }
  return null;
}

/** Acknowledge a callback-query button press (stops the client spinner). */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  if (DRY_RUN) return;
  await api('answerCallbackQuery', { callback_query_id: callbackQueryId, ...(text ? { text } : {}) })
    .catch((e) => console.error('[telegram] answerCallbackQuery failed:', e instanceof Error ? e.message : e));
}

/** Replace an existing message's text + keyboard (used after a decision). */
export async function editMessageText(chatId: number, messageId: number, text: string, replyMarkup?: unknown): Promise<void> {
  if (DRY_RUN) {
    console.log(`\n[DRY-RUN telegram edit → ${chatId}/${messageId}]\n${text}\n`);
    return;
  }
  await api('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: escapeHtmlTags(text),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  }).catch(async (e) => {
    // editMessageText fails when the new text equals the old one; ignore that case.
    console.warn('[telegram] editMessageText failed:', e instanceof Error ? e.message : e);
  });
}

/** Send plain text (no parse_mode) — for LLM replies that may contain
 *  markdown/HTML-ish characters. Chunked to Telegram's 4096-char limit. */
export async function sendMessagePlain(chatId: number, text: string): Promise<void> {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > CONFIG.telegramChunk) {
    let cut = rest.lastIndexOf('\n', CONFIG.telegramChunk);
    if (cut < CONFIG.telegramChunk / 2) cut = CONFIG.telegramChunk;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  chunks.push(rest);

  for (const chunk of chunks) {
    if (DRY_RUN) {
      console.log(`\n[DRY-RUN telegram → ${chatId}]\n${chunk}\n`);
      continue;
    }
    await api('sendMessage', {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: true
    });
  }
}

export async function sendToOwners(text: string): Promise<void> {
  for (const id of CONFIG.ownerIds) {
    await sendMessage(Number(id), text).catch((e) =>
      console.error(`[telegram] send to ${id} failed:`, e instanceof Error ? e.message : e)
    );
  }
}

/** Download a file (voice/photo) as Buffer. Picks largest photo size. */
export async function downloadFile(fileId: string): Promise<{ data: Buffer; path: string }> {
  const file = await api<{ file_path: string }>('getFile', { file_id: fileId });
  const url = `https://api.telegram.org/file/bot${CONFIG.botToken}/${file.file_path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`file download failed: HTTP ${res.status}`);
  return { data: Buffer.from(await res.arrayBuffer()), path: file.file_path };
}

/** Verify the token works and return the bot username (startup check). */
export async function getMe(): Promise<string> {
  if (DRY_RUN) return '(dry-run)';
  const me = await api<{ username: string }>('getMe');
  return me.username;
}
