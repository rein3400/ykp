/**
 * GET /api/hr/telegram-recipients?roles=owner,brand_manager[&brand_id=BR-001]
 *
 * Recipient resolution for the Hermez notification gateway. Given a comma-
 * separated role list (plus optional brand scope), returns every active
 * linked chat id so the gateway can fan out notifications dynamically from
 * the users table instead of a hardcoded TELEGRAM_CHAT_ID env var.
 *
 * Auth: x-bot-secret header (shared secret with the Hermez service).
 */
import { readTab, TABS } from '@/db/sheets';
import { ok, badRequest, unauthorized, handler } from '@/lib/http';
import { safeEqual } from '@/lib/cron';

/** Rows that are NOT explicitly disabled count as active (empty = legacy row). */
function isActive(status: string | undefined): boolean {
  const s = (status ?? '').trim().toLowerCase();
  return s === '' || s === 'active';
}

export const GET = handler(async (req) => {
  const botSecret = process.env.TELEGRAM_BOT_SECRET ?? '';
  if (!botSecret || !safeEqual(req.headers.get('x-bot-secret') ?? '', botSecret)) {
    return unauthorized('Invalid bot secret');
  }

  const q = new URL(req.url).searchParams;
  const rolesParam = (q.get('roles') ?? '').trim();
  if (!rolesParam) return badRequest('roles required');
  const roles = new Set(rolesParam.split(',').map((r) => r.trim().toLowerCase()).filter(Boolean));

  const brandScope = (q.get('brand_id') ?? '').trim();

  const users = await readTab<Record<string, string>>(TABS.users);

  interface Recipient {
    user_id: string;
    telegram_id: string;
    role: string;
    brand_id: string;
    outlet_id: string;
  }
  const byChatId = new Map<string, Recipient>();

  for (const u of users) {
    const chatId = (u.telegram_id ?? '').trim();
    if (!chatId || !/^\d+$/.test(chatId)) continue;
    const role = (u.role ?? '').trim().toLowerCase();
    if (!roles.has(role)) continue;
    if (!isActive(u.active_status)) continue;
    // Brand scoping: blank brand_id rows are HQ/global and always included.
    if (brandScope && (u.brand_id ?? '').trim() && (u.brand_id ?? '').trim() !== brandScope) continue;

    if (!byChatId.has(chatId)) {
      byChatId.set(chatId, {
        user_id: u.user_id,
        telegram_id: chatId,
        role,
        brand_id: (u.brand_id ?? '').trim(),
        outlet_id: (u.outlet_id ?? '').trim()
      });
    }
  }

  return ok({ recipients: [...byChatId.values()] });
});
