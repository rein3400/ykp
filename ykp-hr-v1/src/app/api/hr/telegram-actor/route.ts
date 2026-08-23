/**
 * PUBLIC (Hermez AI chat bot): resolve a Telegram chat id to an RBAC actor.
 * GET /api/hr/telegram-actor?telegram_id=123456
 *
 * Read-only. The Hermez chat bot uses this to enforce "owner + department
 * heads only" and to derive the caller's brand/outlet scope. Returns 404 when
 * the chat id is not linked to an employee or the employee has no user row.
 */
import { readTab, TABS } from '@/db/sheets';
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

  // Several user rows may reference the same employee (demo/staff accounts).
  // Prefer the row that carries THIS chat id; tie-break by smallest user_id
  // (U-001 < U-EMP-1) so resolution is deterministic regardless of row order.
  const users = await readTab<Record<string, string>>(TABS.users);
  const candidates = users.filter((u) => u.employee_id === employee.employee_id);
  if (candidates.length === 0) return notFound('No user account linked to this employee');
  const chatMatch = candidates.find((u) => (u.telegram_id ?? '').trim() === telegramId);
  const chosen = chatMatch ?? [...candidates].sort((a, b) => a.user_id.localeCompare(b.user_id))[0];

  return ok({
    user_id: chosen.user_id,
    role: (chosen.role ?? 'employee').toLowerCase(),
    brand_id: chosen.brand_id ?? '',
    outlet_id: chosen.outlet_id ?? '',
    employee_id: employee.employee_id
  });
});
