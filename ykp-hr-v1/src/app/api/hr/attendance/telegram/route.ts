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
import { handler, ok } from '@/lib/http';
import { performClockIn, performClockOut } from '@/lib/attendance-service';
import {
  findEmployeeByTelegramId,
  findOpenAttendance,
  findUserByEmployeeId
} from '@/lib/attendance-lookup';
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
  const employee = await findEmployeeByTelegramId(chatId);
  if (!employee) {
    await reply('Akun Telegram ini belum tertaut ke data karyawan. Hubungi HR admin untuk menautkan Telegram ID Anda.');
    return ok({ ok: true });
  }

  // Resolve linked user account (users.employee_id) for a real RBAC actor.
  let actorUserId = `TG-${chatId}`;
  let actorRole = 'employee';
  const userRow = await findUserByEmployeeId(employee.employee_id);
  if (userRow) {
    actorUserId = userRow.user_id;
    actorRole = (userRow.role ?? 'employee').toLowerCase();
  }

  const intent = parseAbsenIntent(msg.text);

  if (intent === 'help') {
    await reply(HELP_TEXT);
    return ok({ ok: true });
  }

  if (intent === 'clock-in') {
    const loc = msg.location;
    // Brief §6.3 + AGENTS.md §5: Telegram bot flow is /masuk → bot asks for
    // location → employee sends location → bot checks radius. A /masuk with
    // no location is NOT recorded (unlike the web fallback); we ask for the
    // location first. This avoids recording clock-ins with no geofence
    // check from Telegram, where the location button is always available.
    if (!loc) {
      await reply(
        'Kirim lokasi Anda untuk absen masuk. Tekan tombol "Kirim Lokasi" di bawah, atau kirim lokasi via 📎 (paperclip) → Location.',
        locationReplyMarkup()
      );
      return ok({ ok: true });
    }
    // Validate finite lat/lon at the webhook boundary so a malformed Telegram
    // payload never produces a NaN that reaches the service (never 500).
    const lat = Number(loc.latitude);
    const lon = Number(loc.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      await reply('Lokasi yang dikirim tidak valid. Coba kirim ulang lokasi Anda.');
      return ok({ ok: true });
    }
    const result = await performClockIn({
      employeeId: employee.employee_id,
      latitude: lat,
      longitude: lon,
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
    const open = await findOpenAttendance(employee.employee_id);
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
