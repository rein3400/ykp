/**
 * POST /api/warehouse/telegram/link
 * Authenticated (session). Generates a 6-char link code bound to the current
 * user. The user then DMs the Hermez bot with `/link <code>` to bind their
 * Telegram chat id to their account.
 */
import { getSession } from '@/lib/session';
import { handler, ok, unauthorized } from '@/lib/http';
import { createLinkCode } from '@/lib/telegram';

export const POST = handler(async (req) => {
  const s = await getSession();
  if (!s) return unauthorized();
  const code = createLinkCode(s.userId);
  return ok({ code, expiresInSeconds: 600 });
});
