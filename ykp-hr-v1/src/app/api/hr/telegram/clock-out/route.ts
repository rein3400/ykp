/**
 * POST /api/hr/telegram/clock-out
 * Bot-authenticated (x-bot-secret header, shared with the Hermez service).
 * The Hermez bot calls this when a linked user sends `/clock-out`. The user is
 * resolved by their bound telegram_id, and today's open attendance row is
 * closed out.
 *
 * Returns the updated attendance row, or 404 if no open clock-in today.
 */
import { readTab, updateRow, findRow, TABS } from '@/db/sheets';
import { handler, badRequest, unauthorized, ok, notFound, conflict } from '@/lib/http';
import { formatTimeWib, nowTimestampWib, todayWib } from '@/lib/format';

function botAuthorized(req: Request): boolean {
  const secret = process.env.TELEGRAM_BOT_SECRET;
  if (!secret) return false;
  const header = req.headers.get('x-bot-secret') ?? '';
  return header === secret;
}

export const POST = handler(async (req) => {
  if (!botAuthorized(req)) return unauthorized('Invalid or missing x-bot-secret');
  const body = await req.json().catch(() => ({})) as { telegram_chat_id?: string };
  const chatId = (body.telegram_chat_id ?? '').trim();
  if (!chatId) return badRequest('telegram_chat_id required');

  // Resolve the user bound to this Telegram chat id.
  const users = await readTab<Record<string, string>>(TABS.users).catch(() => []);
  const user = users.find((u) => u.telegram_id === chatId && (u.active_status || 'active') === 'active');
  if (!user) return notFound('Telegram belum dihubungkan ke akun. Ketik /link KODE untuk menghubungkan.');

  const employeeId = user.employee_id;
  if (!employeeId) return badRequest('Akun kamu belum terhubung ke data karyawan. Hubungi admin HR.');

  const today = todayWib();
  const rows = await readTab<Record<string, string>>(TABS.attendance);
  const open = rows.find((a) => a.date === today && a.employee_id === employeeId && !a.actual_check_out);
  if (!open) return notFound('Belum ada clock-in hari ini untuk di-clock-out.');

  const found = await findRow(TABS.attendance, 'attendance_id', open.attendance_id);
  if (!found) return notFound('Attendance not found');
  if (found.row.actual_check_out) return conflict('Already clocked out');

  const timeNow = formatTimeWib(new Date());
  const updated = {
    ...found.row,
    actual_check_out: timeNow,
    check_out_location: found.row.check_in_location || '',
    updated_at: nowTimestampWib()
  };
  await updateRow(TABS.attendance, found.rowNumber, updated);
  return ok(updated);
});
