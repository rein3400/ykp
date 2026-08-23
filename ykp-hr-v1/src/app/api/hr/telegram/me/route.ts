/**
 * POST /api/hr/telegram/me
 * Bot-authenticated (x-bot-secret header, shared with the Hermez service).
 * Given a Telegram chat id, returns the linked user's own HR data (attendance,
 * leave, roster) scoped to that user's employee record. Used by the Hermez
 * bot to answer self-service questions for staff/HODs.
 *
 * Returns { user, employee, attendance, leaves } or 404 if not linked.
 */
import { readTab, findRow, TABS } from '@/db/sheets';
import { handler, ok, unauthorized, notFound } from '@/lib/http';
import { todayWib } from '@/lib/format';

function botAuthorized(req: Request): boolean {
  const secret = process.env.TELEGRAM_BOT_SECRET;
  if (!secret) return false;
  const header = req.headers.get('x-bot-secret') ?? '';
  return header === secret;
}

export const POST = handler(async (req) => {
  if (!botAuthorized(req)) return unauthorized('Invalid or missing x-bot-secret');
  const body = (await req.json().catch(() => ({}))) as { telegram_chat_id?: string };
  const chatId = (body.telegram_chat_id ?? '').trim();
  if (!chatId) return unauthorized('telegram_chat_id required');

  // Find the user bound to this chat id.
  const users = await readTab<Record<string, string>>(TABS.users).catch(() => []);
  const user = users.find((u) => u.telegram_id === chatId && (u.active_status || 'active') === 'active');
  if (!user) return notFound('Telegram belum dihubungkan ke akun. Ketik /link KODE untuk menghubungkan.');

  // Resolve the employee record (if linked).
  let employee: Record<string, string> | null = null;
  if (user.employee_id) {
    const emp = await findRow(TABS.employees, 'employee_id', user.employee_id).catch(() => null);
    employee = emp?.row ?? null;
  }

  const today = todayWib();
  const empId = employee?.employee_id ?? user.employee_id ?? '';
  const [attendance, leaves] = await Promise.all([
    empId
      ? readTab<Record<string, string>>(TABS.attendance)
          .then((rows) => rows.filter((r) => r.employee_id === empId && r.date === today))
          .catch(() => [])
      : Promise.resolve([]),
    empId
      ? readTab<Record<string, string>>(TABS.leaves)
          .then((rows) => rows.filter((r) => r.employee_id === empId).slice(-5))
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  return ok({
    user: {
      userId: user.user_id,
      username: user.username,
      role: user.role,
      department: user.department ?? '',
      brandId: user.brand_id ?? '',
      outletId: user.outlet_id ?? '',
    },
    employee: employee
      ? {
          employeeId: employee.employee_id,
          fullName: employee.full_name,
          department: employee.department,
          position: employee.position,
          outletId: employee.outlet_id,
        }
      : null,
    attendance,
    leaves,
    date: today,
  });
});
