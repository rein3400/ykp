/**
 * PUBLIC (Hermez AI chat bot): resolve a Telegram chat id to an RBAC actor.
 * GET /api/hr/telegram-actor?telegram_id=123456
 *
 * Read-only. The Hermez chat bot uses this to enforce "owner + department
 * heads only" and to derive the caller's brand/outlet scope. Returns 404 when
 * the chat id is not linked to an employee or the employee has no user row.
 */
import { readTab, findRow, TABS } from '@/db/sheets';
import { ok, notFound, badRequest, unauthorized, handler } from '@/lib/http';
import { safeEqual } from '@/lib/cron';

export const GET = handler(async (req) => {
  // This endpoint resolves a Telegram chat id to an RBAC actor (role/brand/
  // outlet). It is NOT public: only the Hermez bot may call it, authenticated
  // via the shared x-bot-secret. Prevents anonymous PII enumeration.
  const botSecret = process.env.TELEGRAM_BOT_SECRET ?? '';
  if (!botSecret || !safeEqual(req.headers.get('x-bot-secret') ?? '', botSecret)) {
    return unauthorized('Invalid bot secret');
  }

  const q = new URL(req.url).searchParams;
  const telegramId = (q.get('telegram_id') ?? '').trim();
  if (!telegramId) return badRequest('telegram_id required');

  const employees = await readTab<Record<string, string>>(TABS.employees);
  const employee = employees.find((e) => (e.telegram_id ?? '').trim() === telegramId);
  if (!employee) return notFound('No employee linked to this Telegram id');

  const userRow = await findRow(TABS.users, 'employee_id', employee.employee_id);
  if (!userRow) return notFound('No user account linked to this employee');

  return ok({
    user_id: userRow.row.user_id,
    role: (userRow.row.role ?? 'employee').toLowerCase(),
    brand_id: userRow.row.brand_id ?? '',
    outlet_id: userRow.row.outlet_id ?? '',
    employee_id: employee.employee_id
  });
});
