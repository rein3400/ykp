/**
 * POST /api/ops/telegram/webhook
 * Dedicated OPS bot webhook (separate bot token from HR). Outlet staff report
 * operational events here. Verified by Telegram's secret header, replies through
 * the Ops bot. Reuses the in-app `/api/ops/telegram/report` capability.
 */
import { NextRequest } from 'next/server';
import { handler, ok, unauthorized } from '@/lib/http';
import { POST as reportPOST } from '@/app/api/ops/telegram/report/route';
import { POST as linkConsumePOST } from '@/app/api/ops/telegram/link/consume/route';
import { routeOpsUpdate } from '@/lib/ops-telegram';
import { sendTelegram } from '@/lib/telegram';
import { timingSafeEqual } from 'node:crypto';

function webhookSecretOk(req: Request): boolean {
  const secret = (process.env.TELEGRAM_OPS_WEBHOOK_SECRET ?? '').trim();
  if (!secret) return false;
  const header = (req.headers.get('x-telegram-bot-api-secret-token') ?? '').trim();
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const CTX = { params: Promise.resolve({} as Record<string, string>) };

async function callInternal(path: string, fn: (req: NextRequest, ctx: typeof CTX) => Promise<Response>, body: unknown): Promise<{ status: number; data?: Record<string, unknown> }> {
  const req = new NextRequest(`http://127.0.0.1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bot-secret': process.env.TELEGRAM_BOT_SECRET ?? '' },
    body: JSON.stringify(body)
  });
  const res = await fn(req, CTX).catch(() => null);
  if (!res) return { status: 500 };
  const json = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown> };
  return { status: res.status, data: json.data };
}

async function reply(chatId: string, text: string): Promise<void> {
  await sendTelegram({ sourceModule: 'ops_bot', sourceReferenceId: `chat-${chatId}`, messageType: 'REPLY', recipient: chatId, text }).catch(() => null);
}

/** Telegram retries updates; ignore ids we've already handled in this process. */
const seenUpdateIds = new Set<number>();

export const POST = handler(async (req: NextRequest) => {
  if (!webhookSecretOk(req)) return unauthorized('Invalid or missing webhook secret');
  const update = (await req.json().catch(() => ({}))) as {
    update_id?: number;
    message?: { chat?: { id?: number }; text?: string };
  };
  const updateId = update.update_id;
  if (typeof updateId === 'number') {
    if (seenUpdateIds.has(updateId)) return ok({ skipped: true });
    if (seenUpdateIds.size > 500) seenUpdateIds.clear();
    seenUpdateIds.add(updateId);
  }
  const chatId = update.message?.chat?.id;
  if (chatId === undefined) return ok({ ignored: true });
  const chat = String(chatId);
  const route = routeOpsUpdate(update.message?.text);
  switch (route.kind) {
    case 'menu':
      await reply(chat, (await callInternal('/api/ops/telegram/report', reportPOST, { telegram_chat_id: chat, action: 'menu' })).data?.text as string ?? 'Menu tidak tersedia.');
      break;
    case 'briefing':
      await reply(chat, (await callInternal('/api/ops/telegram/report', reportPOST, { telegram_chat_id: chat, action: 'briefing' })).data?.text as string ?? 'Briefing tidak tersedia.');
      break;
    case 'incident': {
      const result = await callInternal('/api/ops/telegram/report', reportPOST, { telegram_chat_id: chat, action: 'incident', text: route.text });
      await reply(chat, (result.data?.text as string) ?? 'Gagal mencatat insiden. Sertakan judul: /insiden TEKS');
      break;
    }
    case 'link': {
      const result = await callInternal('/api/ops/telegram/link/consume', linkConsumePOST, { code: route.code, telegram_chat_id: chat });
      await reply(chat, result.status === 200 ? '✅ Akun Telegram kamu berhasil dihubungkan ke Operasional.' : '❌ Kode tidak valid atau kedaluwarsa. Ambil kode baru dari aplikasi web YKP.');
      break;
    }
    default:
      await reply(chat, 'Perintah tidak dikenal. Ketik /menu untuk daftar menu Operasional.');
  }
  return ok({ handled: true });
});
