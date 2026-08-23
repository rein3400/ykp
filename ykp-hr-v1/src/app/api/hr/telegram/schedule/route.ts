/**
 * POST /api/hr/telegram/schedule
 * Bot-authenticated (x-bot-secret header, shared with the Hermez service).
 * Returns the linked user's roster (schedule) for today + next 6 days.
 */
import { readTab, TABS } from '@/db/sheets';
import { handler, badRequest, unauthorized, ok, notFound } from '@/lib/http';
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
  if (!chatId) return badRequest('telegram_chat_id required');

  const users = await readTab<Record<string, string>>(TABS.users).catch(() => []);
  const user = users.find((u) => u.telegram_id === chatId && (u.active_status || 'active') === 'active');
  if (!user) return notFound('Telegram belum dihubungkan ke akun. Ketik /link KODE untuk menghubungkan.');

  const employeeId = user.employee_id;
  if (!employeeId) return badRequest('Akun kamu belum terhubung ke data karyawan. Hubungi admin HR.');

  const today = todayWib();
  // Build a 7-day window [today, today+6].
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const [roster, shifts] = await Promise.all([
    readTab<Record<string, string>>(TABS.roster).catch(() => []),
    readTab<Record<string, string>>(TABS.shifts).catch(() => []),
  ]);
  const shiftMap = new Map(shifts.map((s) => [s.shift_id, s]));

  const myRoster = roster
    .filter((r) => r.employee_id === employeeId && dates.includes(r.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const shift = shiftMap.get(r.shift_id ?? '');
      return {
        date: r.date,
        shift_id: r.shift_id ?? '',
        shift_name: shift?.shift_name ?? r.shift_id ?? '',
        start_time: shift?.start_time ?? '',
        end_time: shift?.end_time ?? '',
        roster_status: r.roster_status ?? '',
      };
    });

  return ok({ employee: { employeeId }, roster: myRoster, from: dates[0], to: dates[dates.length - 1] });
});
