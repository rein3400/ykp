/**
 * Telegram absen webhook — brief §6.3 "Telegram bot jika sudah ada".
 *
 * Endpoint: POST /api/hr/attendance/telegram
 *
 * Set this URL as the bot's webhook:
 *   https://<host>/api/hr/attendance/telegram
 * with secret_token = TELEGRAM_WEBHOOK_SECRET (Telegram sends it as the
 * `X-Telegram-Bot-Api-Secret-Token` header).
 *
 * Message flow:
 *   /masuk   → clock-in (with location when the user shares a Telegram
 *              location; without location it still records, matching the web
 *              fallback: correction request instead of hard block).
 *   /pulang  → clock-out for today's open attendance row.
 *   /start, /help, /bantuan → help text.
 *
 * The employee is resolved by `master_employee.telegram_id` = sender chat id,
 * then linked to a user account (`users.employee_id`) for a full RBAC actor.
 */
import { readTab, TABS, findRow } from '@/db/sheets';
import { handler, ok } from '@/lib/http';
import { performClockIn, performClockOut } from '@/lib/attendance-service';
import {
  parseAbsenIntent,
  sendTelegramText,
  locationReplyMarkup,
  escapeHtml,
  HELP_TEXT,
  type TelegramUpdate
} from '@/lib/telegram-attendance';
import { safeEqual } from '@/lib/cron';

function webhookSecretOk(req: Request): boolean {
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();
  if (!secret) return false;
  const header = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  return safeEqual(header.trim(), secret);
}

export const POST = handler(async (req) => {
  // Reject before touching anything when the shared secret is missing/mismatched.
  if (!webhookSecretOk(req)) return ok({ ok: false, error: 'unauthorized' }, 401);

  const update = (await req.json().catch(() => ({}))) as TelegramUpdate;
  const msg = update.message;
  const chatId = msg?.chat?.id;
  if (!chatId || !msg) return ok({ ok: true }); // ignore edits/empty updates

  const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  if (!token) return ok({ ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }, 500);
  const reply = (text: string, markup?: unknown) => sendTelegramText(token, chatId, text, markup);

  // Resolve the employee by Telegram chat id (brief §6.2 master_employee.telegram_id).
  const employees = await readTab<Record<string, string>>(TABS.employees);
  const employee = employees.find((e) => (e.telegram_id ?? '').trim() === String(chatId));
  if (!employee) {
    await reply('Akun Telegram ini belum tertaut ke data karyawan. Hubungi HR admin untuk menautkan Telegram ID Anda.');
    return ok({ ok: true });
  }

  // Resolve linked user account (users.employee_id) for a real RBAC actor.
  let actorUserId = `TG-${chatId}`;
  let actorRole = 'employee';
  const userRow = await findRow(TABS.users, 'employee_id', employee.employee_id);
  if (userRow) {
    actorUserId = userRow.row.user_id;
    actorRole = (userRow.row.role ?? 'employee').toLowerCase();
  }

  const intent = parseAbsenIntent(msg.text);

  if (intent === 'help') {
    await reply(HELP_TEXT);
    return ok({ ok: true });
  }

  if (intent === 'clock-in') {
    const loc = msg.location;
    const result = await performClockIn({
      employeeId: employee.employee_id,
      latitude: loc?.latitude,
      longitude: loc?.longitude,
      actor: { userId: actorUserId, role: actorRole, employeeId: employee.employee_id },
      source: 'telegram'
    });
    if (!result.ok) {
      await reply(`❌ Gagal absen masuk: ${escapeHtml(result.error.message)}`);
      return ok({ ok: true, error: result.error });
    }
    if (result.already) {
      await reply('ℹ️ Sudah absen masuk hari ini sebelumnya.');
      return ok({ ok: true, already: true });
    }
    const r = result.row;
    const locLabel = r.check_in_location === 'INSIDE_RADIUS' ? 'di dalam radius outlet' : 'tanpa lokasi';
    await reply(
      `✅ Absen masuk tercatat.\n\nJam: ${escapeHtml(r.actual_check_in)}\nStatus: ${escapeHtml(r.attendance_status)}\nLokasi: ${locLabel}`
    );
    return ok({ ok: true, attendance_id: r.attendance_id });
  }

  if (intent === 'clock-out') {
    const open = employees.length
      ? await readTab<Record<string, string>>(TABS.attendance).then((rows) =>
          rows.find((a) => a.employee_id === employee.employee_id && a.actual_check_in && !a.actual_check_out)
        )
      : undefined;
    if (!open) {
      await reply('Belum ada absen masuk yang terbuka untuk hari ini.');
      return ok({ ok: true });
    }
    const result = await performClockOut({
      attendanceId: open.attendance_id,
      actor: { userId: actorUserId, role: actorRole, employeeId: employee.employee_id },
      source: 'telegram'
    });
    if (!result.ok) {
      await reply(`❌ Gagal absen pulang: ${escapeHtml(result.error.message)}`);
      return ok({ ok: true, error: result.error });
    }
    await reply(`✅ Absen pulang tercatat.\n\nJam: ${escapeHtml(result.row.actual_check_out)}`);
    return ok({ ok: true, attendance_id: open.attendance_id });
  }

  await reply('Perintah tidak dikenali.', locationReplyMarkup());
  return ok({ ok: true });
});
