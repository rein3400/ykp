/**
 * POST /api/ops/telegram/link/consume
 * Bot-authenticated (x-bot-secret header, shared with the Hermez service).
 * The Hermez bot calls this after a user DMs `/link <code>`: it passes the
 * code + the user's Telegram chat id, and we bind chat_id ↔ user_id.
 */
import { handler, ok, unauthorized, badRequest } from '@/lib/http';
import { consumeLinkCode } from '@/lib/telegram';

function botAuthorized(req: Request): boolean {
  const secret = process.env.TELEGRAM_BOT_SECRET;
  if (!secret) return false;
  const header = req.headers.get('x-bot-secret') ?? '';
  return header === secret;
}

export const POST = handler(async (req) => {
  if (!botAuthorized(req)) return unauthorized('Invalid or missing x-bot-secret');
  const body = (await req.json().catch(() => ({}))) as { code?: string; telegram_chat_id?: string };
  const code = (body.code ?? '').trim();
  const chatId = (body.telegram_chat_id ?? '').trim();
  if (!code || !chatId) return badRequest('code and telegram_chat_id required');
  const userId = await consumeLinkCode(code, chatId);
  if (!userId) return badRequest('Invalid or expired link code');
  return ok({ userId });
});
