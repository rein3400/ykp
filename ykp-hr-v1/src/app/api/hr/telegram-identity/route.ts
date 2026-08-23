/**
 * POST /api/hr/telegram-identity
 *
 * Cross-division identity resolution for BOTH Telegram bots. Given a Telegram
 * chat id, returns every division binding found (HR users table first, then
 * investor/ops). The caller (Employee webhook or Hermez Management bot) uses
 * the highest-priority role to decide access and the employee_id for absen.
 *
 * Auth: x-bot-secret header (shared secret with both bots) — NOT public.
 */
import { readTab, TABS } from '@/db/sheets';
import { ok, badRequest, unauthorized, handler } from '@/lib/http';
import { safeEqual } from '@/lib/cron';

interface Identity {
  division: 'hr' | 'investor' | 'ops';
  user_id: string;
  role: string;
  brand_id: string;
  outlet_id: string;
  employee_id: string;
}

/** Management-bot access weight (higher wins when one person holds 2 roles). */
const ROLE_WEIGHT: Record<string, number> = {
  owner: 100,
  super_admin: 90,
  hr_admin: 80,
  finance_admin: 75,
  warehouse_admin: 70,
  ops_admin: 70,
  brand_manager: 60,
  outlet_manager: 50,
  supervisor: 40,
  admin: 40,
  kitchen_lead: 30,
  purchasing: 30,
  staff: 20,
  employee: 10,
  investor: 10,
  viewer: 5
};

export const POST = handler(async (req) => {
  const secret = process.env.TELEGRAM_BOT_SECRET ?? '';
  if (!secret || !safeEqual(req.headers.get('x-bot-secret') ?? '', secret)) {
    return unauthorized('Invalid bot secret');
  }

  const body = (await req.json().catch(() => ({}))) as { telegram_chat_id?: string };
  const chatId = (body.telegram_chat_id ?? '').trim();
  if (!chatId) return badRequest('telegram_chat_id required');

  const identities: Identity[] = [];

  // HR division (also covers finance/warehouse staff — they share this table).
  const hrUsers = await readTab<Record<string, string>>(TABS.users);
  for (const u of hrUsers) {
    if ((u.telegram_id ?? '').trim() !== chatId) continue;
    identities.push({
      division: 'hr',
      user_id: u.user_id,
      role: (u.role ?? 'employee').toLowerCase(),
      brand_id: u.brand_id ?? '',
      outlet_id: u.outlet_id ?? '',
      employee_id: u.employee_id ?? ''
    });
  }

  // Investor + Ops divisions keep their own user tables.
  const extraDivisions: Array<{ tab: ReturnType<typeof Object>; division: Identity['division'] }> = [];
  if ('investorUsers' in TABS) extraDivisions.push({ tab: (TABS as unknown as Record<string, never>).investorUsers, division: 'investor' });
  if ('opsUsers' in TABS) extraDivisions.push({ tab: (TABS as unknown as Record<string, never>).opsUsers, division: 'ops' });

  for (const { tab, division } of extraDivisions) {
    try {
      const rows = await readTab<Record<string, string>>(tab as never);
      for (const u of rows) {
        if ((u.telegram_id ?? '').trim() !== chatId) continue;
        identities.push({
          division,
          user_id: u.user_id,
          role: (u.role ?? 'employee').toLowerCase(),
          brand_id: u.brand_id ?? '',
          outlet_id: u.outlet_id ?? '',
          employee_id: u.employee_id ?? ''
        });
      }
    } catch {
      // missing/division table unreadable → skip silently, HR identity suffices
    }
  }

  if (identities.length === 0) return ok({ linked: false, identities: [] });

  // Primary = highest-weight role (management access decisions).
  const primary = [...identities].sort(
    (a, b) => (ROLE_WEIGHT[b.role] ?? 0) - (ROLE_WEIGHT[a.role] ?? 0)
  )[0];

  return ok({
    linked: true,
    primary,
    identities
  });
});
