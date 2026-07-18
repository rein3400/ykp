/**
 * POST /api/warehouse/telegram-test
 * Manual smoke test for Telegram delivery (HIGH/CRITICAL alert path).
 * Auth: session + can(view, telegram). Owner/super_admin always pass.
 */
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, handler } from '@/lib/http';
import { can, type Role } from '@/lib/rbac';
import { sendTelegram } from '@/lib/telegram';

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'telegram')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text =
    typeof body.text === 'string' && body.text.trim().length > 0
      ? body.text.trim()
      : `YKP Warehouse Telegram test — ${new Date().toISOString()}`;

  if (text.length > 3500) return badRequest('text too long');

  const envChat = process.env.TELEGRAM_CHAT_ID ?? '';
  const envToken = process.env.TELEGRAM_BOT_TOKEN ?? '';

  const result = await sendTelegram({
    sourceModule: 'telegram_test',
    sourceReferenceId: `test-${Date.now()}`,
    messageType: 'TEST',
    recipient: envChat,
    text: `<b>Warehouse Telegram Test</b>\n${text}`,
  });

  return ok({
    deliveryId: result.deliveryId,
    status: result.status,
    sent: result.status === 'SENT',
    messageId: result.messageId ?? null,
    error: result.error ?? null,
  });
});
