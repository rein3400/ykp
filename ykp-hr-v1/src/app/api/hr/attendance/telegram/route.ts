/**
 * Telegram HR bot webhook — absen + employee self-service menu.
 *
 * Endpoint: POST /api/hr/attendance/telegram
 *
 * Set this URL as the bot's webhook:
 *   https://<host>/api/hr/attendance/telegram
 * with secret_token = TELEGRAM_WEBHOOK_SECRET (Telegram sends it as the
 * `X-Telegram-Bot-Api-Secret-Token` header) and
 * allowed_updates = ["message", "callback_query"].
 *
 * Message flow:
 *   /start [KODE] → employee main menu (inline keyboard); with a code it
 *                   links the Telegram account first (deep-link pairing).
 *   /link KODE    → link this Telegram account to a YKP user (any division).
 *   /masuk        → clock-in with geofence (asks for location first).
 *   /pulang       → clock-out for today's open attendance row.
 *   /absen        → attendance sub-menu (inline keyboard).
 *   /clock-in, /clock-out, /me, /jadwal, /cuti → self-service commands
 *                   (resolved via users.telegram_id, x-bot-secret routes).
 *   location msg  → clock-in with GPS (geofence enforced).
 *   callback_query→ inline menu navigation.
 *
 * Legacy absen resolves the employee by `master_employee.telegram_id`; the
 * self-service commands resolve via `users.telegram_id` (linked via /link).
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
  employeeHelpText,
  mainMenuKeyboard,
  attendanceKeyboard,
  answerCallbackQuery,
  type TelegramUpdate
} from '@/lib/telegram-attendance';
import { safeEqual } from '@/lib/cron';
import { POST as hrLinkConsume } from '@/app/api/hr/telegram/link/consume/route';
import { POST as hrClockIn } from '@/app/api/hr/telegram/clock-in/route';
import { POST as hrClockOut } from '@/app/api/hr/telegram/clock-out/route';
import { POST as hrMe } from '@/app/api/hr/telegram/me/route';
import { POST as hrSchedule } from '@/app/api/hr/telegram/schedule/route';
import { POST as hrLeave } from '@/app/api/hr/telegram/leave/route';

function webhookSecretOk(req: Request): boolean {
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();
  if (!secret) return false;
  const header = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  return safeEqual(header.trim(), secret);
}

/** Route handlers are wrapped by handler() which awaits ctx.params. */
const CTX = { params: Promise.resolve({} as Record<string, string>) };

function internalBotRequest(path: string, body: unknown): Request {
  return new Request(`http://127.0.0.1${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': process.env.TELEGRAM_BOT_SECRET ?? ''
    },
    body: JSON.stringify(body)
  });
}

interface InternalResult {
  status: number;
  data?: Record<string, unknown>;
  errorMessage?: string;
}

/** Call one of the in-app bot routes in-process and normalise its envelope. */
async function callInternal(path: string, fn: (req: Request, ctx: typeof CTX) => Promise<Response>, body: unknown): Promise<InternalResult> {
  const res = await fn(internalBotRequest(path, body), CTX).catch(() => null);
  if (!res) return { status: 500, errorMessage: 'internal error' };
  const json = (await res.json().catch(() => ({}))) as {
    data?: Record<string, unknown>;
    error?: { message?: string };
  };
  return { status: res.status, data: json.data, errorMessage: json.error?.message };
}

/**
 * Other divisions' link-consume endpoints (one link code works for every
 * division — the HR app tries them in order after its own). Override via
 * YKP_MODULE_CONSUME_URLS (comma separated).
 */
const MODULE_CONSUME_URLS = (
  process.env.YKP_MODULE_CONSUME_URLS ??
  'http://127.0.0.1:3003/api/finance/telegram/link/consume,' +
    'http://127.0.0.1:3005/api/warehouse/telegram/link/consume,' +
    'http://127.0.0.1:3006/api/investor/telegram/link/consume,' +
    'http://127.0.0.1:3007/api/ops/telegram/link/consume'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Consume a link code: HR in-process first, then the other divisions.
 * Returns a user-facing reply string (starts with ✅ on success).
 */
async function linkAccount(code: string, chatId: number): Promise<string> {
  const secret = process.env.TELEGRAM_BOT_SECRET;
  if (!secret) return '⚠️ Pairing belum aktif (TELEGRAM_BOT_SECRET belum di-set). Hubungi admin.';

  const hr = await callInternal('/api/hr/telegram/link/consume', hrLinkConsume, {
    code,
    telegram_chat_id: String(chatId)
  });
  if (hr.status === 200 && hr.data?.userId) {
    return `✅ Akun Telegram kamu berhasil dihubungkan (user ${String(hr.data.userId)}).\n\nSekarang kamu bisa absen, lihat jadwal, dan ajukan cuti langsung dari sini.`;
  }

  let sawInvalid = hr.status === 400;
  for (const url of MODULE_CONSUME_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bot-secret': secret },
        body: JSON.stringify({ code, telegram_chat_id: String(chatId) }),
        signal: AbortSignal.timeout(8000)
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { userId?: string } };
      if (res.ok && json.data?.userId) {
        return `✅ Akun Telegram kamu berhasil dihubungkan (user ${json.data.userId}).\n\nSekarang kamu bisa absen, lihat jadwal, dan ajukan cuti langsung dari sini.`;
      }
      if (res.status === 400) sawInvalid = true;
    } catch {
      // network error — try next module
    }
  }
  if (sawInvalid) return '❌ Kode tidak valid atau sudah kedaluwarsa. Minta kode baru dari aplikasi (menu Telegram), lalu coba lagi.';
  return '⚠️ Gagal menghubungkan akun. Coba lagi sebentar lagi, atau hubungi admin.';
}

const LINK_CODE_RE = /^\/(?:start|link)\s+([A-Z2-9]{6})$/i;
const LINK_HINT =
  '❌ Format salah.\n\nCara menghubungkan akun:\n1. Login ke aplikasi web YKP\n2. Buka menu Telegram → dapatkan kode 6 karakter\n3. Ketik: /link KODE\n\nContoh: /link ABC123';

export const POST = handler(async (req) => {
  // Reject before touching anything when the shared secret is missing/mismatched.
  if (!webhookSecretOk(req)) return ok({ ok: false, error: 'unauthorized' }, 401);

  const update = (await req.json().catch(() => ({}))) as TelegramUpdate;
  const token = process.env.TELEGRAM_EMPLOYEE_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  if (!token) return ok({ ok: false, error: 'TELEGRAM_EMPLOYEE_BOT_TOKEN not configured' }, 500);

  // ── callback_query: inline menu navigation ────────────────────────────
  const cb = update.callback_query;
  if (cb?.id) {
    const cbChatId = cb.message?.chat?.id;
    const fromId = cb.from?.id ?? cbChatId;
    if (cbChatId === undefined || fromId === undefined) return ok({ ok: true });
    const data = cb.data ?? '';
    const reply = (text: string, markup?: unknown) => sendTelegramText(token, cbChatId, text, markup);

    if (data === 'main:menu' || data === 'main:help') {
      await answerCallbackQuery(token, cb.id, data === 'main:help' ? 'Bantuan' : 'Menu utama');
      await reply(employeeHelpText(), { inline_keyboard: mainMenuKeyboard() });
      return ok({ ok: true });
    }
    if (data === 'main:absen') {
      await answerCallbackQuery(token, cb.id, 'Menu absen');
      await reply('Pilih aksi absensi:', { inline_keyboard: attendanceKeyboard() });
      return ok({ ok: true });
    }
    if (data === 'main:jadwal') {
      await answerCallbackQuery(token, cb.id, 'Jadwal…');
      const r = await callInternal('/api/hr/telegram/schedule', hrSchedule, { telegram_chat_id: String(fromId) });
      await reply(r.data ? scheduleText(r.data) : notLinkedText(r.errorMessage));
      return ok({ ok: true });
    }
    if (data === 'main:cuti') {
      await answerCallbackQuery(token, cb.id, 'Cuti…');
      await reply(LEAVE_HELP);
      return ok({ ok: true });
    }
    if (data === 'main:me') {
      await answerCallbackQuery(token, cb.id, 'Profil…');
      const r = await callInternal('/api/hr/telegram/me', hrMe, { telegram_chat_id: String(fromId) });
      await reply(r.data ? meText(r.data) : notLinkedText(r.errorMessage));
      return ok({ ok: true });
    }
    if (data === 'att:clock-in') {
      await answerCallbackQuery(token, cb.id, 'Clock-in…');
      const r = await callInternal('/api/hr/telegram/clock-in', hrClockIn, { telegram_chat_id: String(fromId) });
      await reply(clockInText(r));
      return ok({ ok: true });
    }
    if (data === 'att:clock-out') {
      await answerCallbackQuery(token, cb.id, 'Clock-out…');
      const r = await callInternal('/api/hr/telegram/clock-out', hrClockOut, { telegram_chat_id: String(fromId) });
      await reply(clockOutText(r));
      return ok({ ok: true });
    }
    if (data === 'att:location') {
      await answerCallbackQuery(token, cb.id, 'Kirim lokasi kamu');
      await reply(
        '📍 Kirim lokasi kamu untuk absen masuk dengan deteksi GPS. Tekan tombol di bawah.',
        locationReplyMarkup()
      );
      return ok({ ok: true });
    }
    await answerCallbackQuery(token, cb.id, 'Perintah tidak dikenal');
    return ok({ ok: true });
  }

  const msg = update.message;
  const chatId = msg?.chat?.id;
  if (!chatId || !msg) return ok({ ok: true }); // ignore edits/empty updates
  const fromId = msg.from?.id ?? chatId;
  const reply = (text: string, markup?: unknown) => sendTelegramText(token, chatId, text, markup);
  const text = (msg.text ?? '').trim();

  // ── pairing: /start KODE (deep link) and /link KODE ──────────────────
  const linkMatch = text.match(LINK_CODE_RE);
  if (linkMatch) {
    const res = await linkAccount(linkMatch[1].toUpperCase(), fromId);
    await reply(res);
    if (res.startsWith('✅')) await reply('Pilih menu:', { inline_keyboard: mainMenuKeyboard() });
    return ok({ ok: true });
  }
  if (/^\/link\b/i.test(text)) {
    await reply(LINK_HINT);
    return ok({ ok: true });
  }

  // ── /start & /help → employee main menu (no account needed) ───────────
  if (/^\/(start|help|bantuan|mulai)$/i.test(text)) {
    await reply(employeeHelpText(), { inline_keyboard: mainMenuKeyboard() });
    return ok({ ok: true });
  }

  // ── /absen → attendance sub-menu ──────────────────────────────────────
  if (/^\/absen$/i.test(text)) {
    await reply('Pilih aksi absensi:', { inline_keyboard: attendanceKeyboard() });
    return ok({ ok: true });
  }

  // ── self-service commands (resolved via users.telegram_id) ────────────
  if (/^\/clock-?in$/i.test(text)) {
    const r = await callInternal('/api/hr/telegram/clock-in', hrClockIn, { telegram_chat_id: String(fromId) });
    await reply(clockInText(r));
    return ok({ ok: true });
  }
  if (/^\/clock-?out$/i.test(text)) {
    const r = await callInternal('/api/hr/telegram/clock-out', hrClockOut, { telegram_chat_id: String(fromId) });
    await reply(clockOutText(r));
    return ok({ ok: true });
  }
  if (/^\/me$/i.test(text)) {
    const r = await callInternal('/api/hr/telegram/me', hrMe, { telegram_chat_id: String(fromId) });
    await reply(r.data ? meText(r.data) : notLinkedText(r.errorMessage));
    return ok({ ok: true });
  }
  if (/^\/jadwal$/i.test(text)) {
    const r = await callInternal('/api/hr/telegram/schedule', hrSchedule, { telegram_chat_id: String(fromId) });
    await reply(r.data ? scheduleText(r.data) : notLinkedText(r.errorMessage));
    return ok({ ok: true });
  }
  if (/^\/cuti\b/i.test(text)) {
    const m = text.match(/^\/cuti\s+([A-Z_]+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/i);
    if (!m) {
      await reply(LEAVE_HELP);
      return ok({ ok: true });
    }
    const r = await callInternal('/api/hr/telegram/leave', hrLeave, {
      telegram_chat_id: String(fromId),
      leave_type: m[1].toUpperCase(),
      start_date: m[2],
      end_date: m[3],
      reason: m[4]?.trim() ?? ''
    });
    await reply(r.data ? leaveText(r.data) : leaveFailText(r));
    return ok({ ok: true });
  }

  // ── legacy absen flow (master_employee.telegram_id) ───────────────────
  const employee = await findEmployeeByTelegramId(chatId);
  if (!employee) {
    // Location message from a linked (users.telegram_id) but not legacy-bound
    // employee still clock-ins via the self-service route with geofence.
    if (msg.location) {
      const lat = Number(msg.location.latitude);
      const lon = Number(msg.location.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        await reply('Lokasi yang dikirim tidak valid. Coba kirim ulang lokasi Anda.');
        return ok({ ok: true });
      }
      const r = await callInternal('/api/hr/telegram/clock-in', hrClockIn, {
        telegram_chat_id: String(fromId),
        latitude: lat,
        longitude: lon
      });
      await reply(clockInText(r));
      return ok({ ok: true });
    }
    await reply(
      'Akun Telegram ini belum tertaut ke data karyawan.\n\nKalau kamu sudah punya akun YKP: ketik /link KODE (kode dari menu Telegram di aplikasi web).\nBelum punya akun? Hubungi HR admin.',
      { inline_keyboard: mainMenuKeyboard() }
    );
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

  // Bare location message from a legacy-bound employee = clock-in with GPS.
  if (msg.location) {
    const lat = Number(msg.location.latitude);
    const lon = Number(msg.location.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const result = await performClockIn({
        employeeId: employee.employee_id,
        latitude: lat,
        longitude: lon,
        actor: { userId: actorUserId, role: actorRole, employeeId: employee.employee_id },
        source: 'telegram'
      });
      if (result.ok && !result.already) {
        const r = result.row;
        const locLabel = r.check_in_location === 'INSIDE_RADIUS' ? 'di dalam radius outlet' : 'tanpa lokasi';
        await reply(
          `✅ Absen masuk tercatat.\n\nJam: ${escapeHtml(r.actual_check_in)}\nStatus: ${escapeHtml(r.attendance_status)}\nLokasi: ${locLabel}`
        );
        return ok({ ok: true, attendance_id: r.attendance_id });
      }
      if (result.ok && result.already) {
        await reply('ℹ️ Sudah absen masuk hari ini sebelumnya.');
        return ok({ ok: true, already: true });
      }
      if (!result.ok) {
        const errMsg = result.error?.message ?? 'gagal';
        await reply(`❌ Gagal absen masuk: ${escapeHtml(errMsg)}`);
        return ok({ ok: true, error: result.error });
      }
    }
    await reply('Lokasi yang dikirim tidak valid. Coba kirim ulang lokasi Anda.');
    return ok({ ok: true });
  }

  await reply('Perintah tidak dikenali. Ketik /help untuk menu.', { inline_keyboard: mainMenuKeyboard() });
  return ok({ ok: true });
});

// ── reply formatters for the self-service routes ─────────────────────────

function notLinkedText(errorMessage?: string): string {
  if (errorMessage && /tidak dihubungkan|belum dihubungkan/i.test(errorMessage)) {
    return '❌ Akun Telegram kamu belum dihubungkan. Login ke aplikasi, minta kode di menu Telegram, lalu ketik /link KODE.';
  }
  return `⚠️ ${errorMessage ?? 'Gagal mengambil data. Coba lagi sebentar lagi.'}`;
}

function clockInText(r: InternalResult): string {
  if (r.status === 404) return notLinkedText(r.errorMessage);
  if (!r.data) return `⚠️ Clock-in gagal: ${r.errorMessage ?? r.status}.`;
  const d = r.data as Record<string, string>;
  if (d.already) return `✅ Kamu sudah clock-in hari ini pukul ${d.actual_check_in ?? '-'}.`;
  const status = d.attendance_status === 'LATE' ? 'TERLAMBAT' : 'HADIR';
  const late = Number(d.late_minutes || 0) > 0 ? ` (telat ${d.late_minutes} menit)` : '';
  return `✅ Clock-in berhasil pukul ${d.actual_check_in ?? '-'} — ${status}${late}.`;
}

function clockOutText(r: InternalResult): string {
  if (r.status === 404) return notLinkedText(r.errorMessage) === r.errorMessage
    ? '❌ Belum ada clock-in hari ini, atau akun belum dihubungkan.'
    : notLinkedText(r.errorMessage);
  if (!r.data) return `⚠️ Clock-out gagal: ${r.errorMessage ?? r.status}.`;
  const d = r.data as Record<string, string>;
  return `✅ Clock-out berhasil pukul ${d.actual_check_out ?? '-'}.`;
}

function meText(data: Record<string, unknown>): string {
  const user = (data.user ?? {}) as Record<string, string>;
  const emp = (data.employee ?? {}) as Record<string, string> | null;
  const name = emp?.fullName || user.username || 'Karyawan';
  const lines: string[] = [];
  lines.push(`<b>Halo ${escapeHtml(name)}</b> 👋`);
  lines.push(`Role: ${escapeHtml(user.role ?? '-')}${user.department ? ` · Dept: ${escapeHtml(user.department)}` : ''}`);
  lines.push(`Tanggal: ${escapeHtml(String(data.date ?? '-'))}`);
  const att = (data.attendance ?? []) as Record<string, string>[];
  if (att.length > 0) {
    const a = att[0];
    lines.push('', '<b>Kehadiran hari ini:</b>');
    lines.push(`• Check-in: ${escapeHtml(a.actual_check_in || 'belum')} (jadwal ${escapeHtml(a.scheduled_check_in || '-')})`);
    lines.push(`• Check-out: ${escapeHtml(a.actual_check_out || 'belum')} (jadwal ${escapeHtml(a.scheduled_check_out || '-')})`);
    lines.push(`• Status: ${escapeHtml(a.status || '-')}`);
  } else {
    lines.push('', 'Kehadiran hari ini: belum tercatat.');
  }
  const leaves = (data.leaves ?? []) as Record<string, string>[];
  if (leaves.length > 0) {
    lines.push('', '<b>Cuti terakhir:</b>');
    for (const l of leaves.slice(0, 3)) {
      lines.push(`• ${escapeHtml(l.leave_type)} ${escapeHtml(l.start_date)}–${escapeHtml(l.end_date)} (${escapeHtml(l.approval_status || '-')})`);
    }
  }
  return lines.join('\n');
}

function scheduleText(data: Record<string, unknown>): string {
  const emp = (data.employee ?? {}) as Record<string, string> | null;
  const roster = (data.roster ?? []) as Record<string, string>[];
  const lines: string[] = [];
  lines.push(`<b>📅 Jadwal ${escapeHtml(emp?.fullName || 'Karyawan')}</b>`);
  lines.push(`Periode: ${escapeHtml(String(data.from ?? '-'))} s/d ${escapeHtml(String(data.to ?? '-'))}`);
  if (roster.length === 0) {
    lines.push('', 'Belum ada jadwal shift untuk minggu ini.');
  } else {
    lines.push('');
    for (const r of roster) {
      const time = r.start_time && r.end_time ? `${r.start_time}–${r.end_time}` : '';
      lines.push(`• ${escapeHtml(r.date || '-')}: ${escapeHtml(r.shift_name || r.shift_id || '-')}${time ? ` (${escapeHtml(time)})` : ''}`);
    }
  }
  return lines.join('\n');
}

const LEAVE_HELP =
  'Cara ajukan cuti:\n<b>/cuti JENIS TANGGAL_MULAI TANGGAL_SELESAI [alasan]</b>\n\nJenis: ANNUAL_LEAVE, SICK, PERMISSION, UNPAID_LEAVE, EMERGENCY, MATERNITY, OTHER\n\nContoh: /cuti SICK 2026-08-20 2026-08-21 Demam';

function leaveText(data: Record<string, unknown>): string {
  const d = data as Record<string, string>;
  return `✅ Cuti berhasil diajukan!\n\nID: ${escapeHtml(d.leave_id)}\nDurasi: ${escapeHtml(d.total_days ?? '-')} hari\nStatus: ${escapeHtml(d.approval_status ?? 'PENDING')}\n\nMenunggu persetujuan atasan.`;
}

function leaveFailText(r: InternalResult): string {
  if (r.status === 404) return notLinkedText(r.errorMessage);
  if (r.errorMessage && /format/i.test(r.errorMessage)) return `❌ ${r.errorMessage}`;
  return `⚠️ Gagal mengajukan cuti: ${r.errorMessage ?? r.status}.`;
}
