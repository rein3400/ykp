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

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
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
      allowed_updates: ['message']
    });
  } catch (e) {
    // Network hiccup: caller backs off and retries.
    console.error('[telegram] poll error:', e instanceof Error ? e.message : e);
    return [];
  }
}

/** Send text (HTML), chunked to Telegram's 4096-char limit. */
export async function sendMessage(chatId: number, text: string): Promise<void> {
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
      parse_mode: 'HTML',
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
