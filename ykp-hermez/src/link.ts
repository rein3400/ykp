/**
 * Telegram identity linking for non-owner staff/HODs.
 *
 * Flow:
 *  1. User logs into an app (e.g. HR) and requests a link code
 *     (POST /api/hr/telegram/link) → gets a 6-char code.
 *  2. User DMs this bot: `/link <code>`.
 *  3. We call the app's consume endpoint with the code + the user's
 *     Telegram chat id. The app binds chat_id ↔ user_id.
 *
 * The bot secret (TELEGRAM_BOT_SECRET) authenticates the consume call.
 */
import { CONFIG } from './config.js';

interface ModuleLink {
  /** Base URL of the app that owns the user store. */
  baseUrl: string;
  /** Path to the consume endpoint. */
  consumePath: string;
}

/** Apps that expose a Telegram link-consume endpoint. */
const LINK_MODULES: ModuleLink[] = [
  { baseUrl: CONFIG.modules.hr, consumePath: '/api/hr/telegram/link/consume' },
];

export function isLinkCommand(text: string): boolean {
  return /^\/link\s+[A-Z2-9]{6}$/i.test((text || '').trim());
}

export function isMeCommand(text: string): boolean {
  return /^\/me$/i.test((text || '').trim());
}

export function isClockInCommand(text: string): boolean {
  return /^\/clock-in$/i.test((text || '').trim());
}

export function isClockOutCommand(text: string): boolean {
  return /^\/clock-out$/i.test((text || '').trim());
}

export function isAttendanceCommand(text: string): boolean {
  return /^\/absen$/i.test((text || '').trim());
}

export function isScheduleCommand(text: string): boolean {
  return /^\/jadwal$/i.test((text || '').trim());
}

export function isLeaveCommand(text: string): boolean {
  return /^\/cuti$/i.test((text || '').trim());
}

export function isStartCommand(text: string): boolean {
  return /^\/start$/i.test((text || '').trim());
}

export function isHelpCommand(text: string): boolean {
  return /^\/help$/i.test((text || '').trim());
}

/**
 * Deep-link: Telegram sends `/start <KODE>` when a user taps a
 * `t.me/<bot>?start=<KODE>` link. This lets staff connect WITHOUT typing
 * `/link` manually — they just tap the button in the web app.
 */
export function isStartLinkCommand(text: string): boolean {
  return /^\/start\s+[A-Z2-9]{6}$/i.test((text || '').trim());
}

/** Extract the 6-char code from `/start KODE`. */
export function startLinkCode(text: string): string | null {
  const m = (text || '').trim().match(/^\/start\s+([A-Z2-9]{6})$/i);
  return m ? m[1].toUpperCase() : null;
}

/** Inline keyboard for the attendance menu. */
export function attendanceKeyboard(): { text: string; callback_data: string }[][] {
  return [
    [{ text: '✅ Clock-in', callback_data: 'att:clock-in' }],
    [{ text: '🏁 Clock-out', callback_data: 'att:clock-out' }],
    [{ text: '📍 Kirim Lokasi (untuk clock-in)', callback_data: 'att:location' }],
    [{ text: '🔙 Menu Utama', callback_data: 'main:menu' }],
  ];
}

/** Main menu keyboard for employees. */
export function mainMenuKeyboard(): { text: string; callback_data: string }[][] {
  return [
    [{ text: '📍 Absen', callback_data: 'main:absen' }],
    [{ text: '📅 Jadwal', callback_data: 'main:jadwal' }],
    [{ text: '🏖 Cuti', callback_data: 'main:cuti' }],
    [{ text: '👤 Profil Saya', callback_data: 'main:me' }],
    [{ text: '❓ Bantuan', callback_data: 'main:help' }],
  ];
}

/** Employee-facing help text (shown on /start and /help). */
export function employeeHelpText(): string {
  return `<b>👋 Selamat datang di YKP Telegram</b>

Ketik /link KODE untuk menghubungkan akun kamu (kode didapat dari aplikasi web YKP).

Menu yang tersedia:
• 📍 <b>Absen</b> — clock-in / clock-out (bisa pakai lokasi GPS)
• 📅 <b>Jadwal</b> — lihat shift kamu
• 🏖 <b>Cuti</b> — ajukan cuti / izin
• 👤 <b>Profil Saya</b> — kehadiran & cuti kamu
• ❓ <b>Bantuan</b> — menu ini

Atau ketik perintah: /absen /jadwal /cuti /me /help`;
}

/**
 * Clock-in via Telegram. Optionally enforces GPS radius when a location is
 * provided (Telegram location message). Returns a human-readable result.
 */
export async function handleClockIn(telegramChatId: number, location?: { latitude: number; longitude: number }): Promise<string> {
  if (!CONFIG.botSecret) {
    return '⚠️ Absensi belum aktif (TELEGRAM_BOT_SECRET belum di-set). Hubungi admin.';
  }
  const hr = CONFIG.modules.hr;
  try {
    const res = await fetch(`${hr}/api/hr/telegram/clock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': CONFIG.botSecret },
      body: JSON.stringify({
        telegram_chat_id: String(telegramChatId),
        latitude: location?.latitude,
        longitude: location?.longitude,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { attendance_status?: string; late_minutes?: string; actual_check_in?: string; already?: boolean; employee_name?: string };
      error?: { message?: string };
    };
    if (res.status === 404) {
      return '❌ Akun Telegram kamu belum dihubungkan. Login ke aplikasi, minta kode, lalu ketik /link KODE.';
    }
    if (!res.ok || !json.data) {
      return `⚠️ Clock-in gagal: ${json.error?.message ?? res.status}.`;
    }
    const d = json.data;
    if (d.already) {
      return `✅ Kamu sudah clock-in hari ini pukul ${d.actual_check_in ?? '-'}.`;
    }
    const status = d.attendance_status === 'LATE' ? 'TERLAMBAT' : 'HADIR';
    const late = Number(d.late_minutes || 0) > 0 ? ` (telat ${d.late_minutes} menit)` : '';
    return `✅ Clock-in berhasil pukul ${d.actual_check_in ?? '-'} — ${status}${late}.`;
  } catch {
    return '⚠️ Gagal menghubungi server. Coba lagi sebentar lagi.';
  }
}

/**
 * Clock-out via Telegram. Returns a human-readable result.
 */
export async function handleClockOut(telegramChatId: number): Promise<string> {
  if (!CONFIG.botSecret) {
    return '⚠️ Absensi belum aktif (TELEGRAM_BOT_SECRET belum di-set). Hubungi admin.';
  }
  const hr = CONFIG.modules.hr;
  try {
    const res = await fetch(`${hr}/api/hr/telegram/clock-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': CONFIG.botSecret },
      body: JSON.stringify({ telegram_chat_id: String(telegramChatId) }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { actual_check_out?: string };
      error?: { message?: string };
    };
    if (res.status === 404) {
      return '❌ Belum ada clock-in hari ini, atau akun belum dihubungkan.';
    }
    if (!res.ok || !json.data) {
      return `⚠️ Clock-out gagal: ${json.error?.message ?? res.status}.`;
    }
    return `✅ Clock-out berhasil pukul ${json.data.actual_check_out ?? '-'}.`;
  } catch {
    return '⚠️ Gagal menghubungi server. Coba lagi sebentar lagi.';
  }
}

/**
 * Self-service: return the linked user's own HR data (attendance, leave).
 * Only works after the user has linked their Telegram via /link.
 */
export async function handleMeCommand(telegramChatId: number): Promise<string> {
  if (!CONFIG.botSecret) {
    return '⚠️ Layanan belum aktif (TELEGRAM_BOT_SECRET belum di-set). Hubungi admin.';
  }
  const hr = CONFIG.modules.hr;
  try {
    const res = await fetch(`${hr}/api/hr/telegram/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': CONFIG.botSecret },
      body: JSON.stringify({ telegram_chat_id: String(telegramChatId) }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { user?: { username?: string; role?: string; department?: string }; employee?: { fullName?: string } | null; attendance?: Record<string, string>[]; leaves?: Record<string, string>[]; date?: string };
      error?: { message?: string };
    };
    if (res.status === 404) {
      return '❌ Akun Telegram kamu belum dihubungkan. Login ke aplikasi, minta kode, lalu ketik /link KODE.';
    }
    if (!res.ok || !json.data) {
      return `⚠️ Gagal mengambil data (${json.error?.message ?? res.status}). Coba lagi nanti.`;
    }
    const d = json.data;
    const name = d.employee?.fullName || d.user?.username || 'Karyawan';
    const lines: string[] = [];
    lines.push(`<b>Halo ${name}</b> 👋`);
    lines.push(`Role: ${d.user?.role ?? '-'}${d.user?.department ? ` · Dept: ${d.user.department}` : ''}`);
    lines.push(`Tanggal: ${d.date ?? '-'}`);
    const att = d.attendance ?? [];
    if (att.length > 0) {
      const a = att[0];
      lines.push('');
      lines.push('<b>Kehadiran hari ini:</b>');
      lines.push(`• Check-in: ${a.actual_check_in || 'belum'} (jadwal ${a.scheduled_check_in || '-'})`);
      lines.push(`• Check-out: ${a.actual_check_out || 'belum'} (jadwal ${a.scheduled_check_out || '-'})`);
      lines.push(`• Status: ${a.status || '-'}`);
    } else {
      lines.push('');
      lines.push('Kehadiran hari ini: belum tercatat.');
    }
    const leaves = d.leaves ?? [];
    if (leaves.length > 0) {
      lines.push('');
      lines.push('<b>Cuti terakhir:</b>');
      for (const l of leaves.slice(0, 3)) {
        lines.push(`• ${l.leave_type} ${l.start_date}–${l.end_date} (${l.approval_status || '-'})`);
      }
    }
    return lines.join('\n');
  } catch {
    return '⚠️ Gagal menghubungi server. Coba lagi sebentar lagi.';
  }
}

/**
 * Self-service: return the linked user's schedule (roster) for today + next 6 days.
 */
export async function handleScheduleCommand(telegramChatId: number): Promise<string> {
  if (!CONFIG.botSecret) {
    return '⚠️ Layanan belum aktif (TELEGRAM_BOT_SECRET belum di-set). Hubungi admin.';
  }
  const hr = CONFIG.modules.hr;
  try {
    const res = await fetch(`${hr}/api/hr/telegram/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': CONFIG.botSecret },
      body: JSON.stringify({ telegram_chat_id: String(telegramChatId) }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { employee?: { fullName?: string } | null; roster?: Record<string, string>[]; from?: string; to?: string };
      error?: { message?: string };
    };
    if (res.status === 404) {
      return '❌ Akun Telegram kamu belum dihubungkan. Login ke aplikasi, minta kode, lalu ketik /link KODE.';
    }
    if (!res.ok || !json.data) {
      return `⚠️ Gagal mengambil jadwal (${json.error?.message ?? res.status}). Coba lagi nanti.`;
    }
    const d = json.data;
    const name = d.employee?.fullName || 'Karyawan';
    const roster = d.roster ?? [];
    const lines: string[] = [];
    lines.push(`<b>📅 Jadwal ${name}</b>`);
    lines.push(`Periode: ${d.from ?? '-'} s/d ${d.to ?? '-'}`);
    if (roster.length === 0) {
      lines.push('');
      lines.push('Belum ada jadwal shift untuk minggu ini.');
    } else {
      lines.push('');
      for (const r of roster) {
        const day = r.date || '-';
        const shift = r.shift_name || r.shift_id || '-';
        const time = r.start_time && r.end_time ? `${r.start_time}–${r.end_time}` : '';
        lines.push(`• ${day}: ${shift}${time ? ` (${time})` : ''}`);
      }
    }
    return lines.join('\n');
  } catch {
    return '⚠️ Gagal menghubungi server. Coba lagi sebentar lagi.';
  }
}

/**
 * Self-service: submit a leave request via Telegram.
 * Format: /cuti <JENIS> <YYYY-MM-DD> <YYYY-MM-DD> [alasan]
 * Example: /cuti SICK 2026-08-20 2026-08-21 Demam
 */
export async function handleLeaveCommand(text: string, telegramChatId: number): Promise<string> {
  const m = (text || '').trim().match(/^\/cuti\s+([A-Z_]+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/i);
  if (!m) {
    return '❌ Format salah.\n\nCara ajukan cuti:\n<b>/cuti JENIS TANGGAL_MULAI TANGGAL_SELESAI [alasan]</b>\n\nJenis: ANNUAL_LEAVE, SICK, PERMISSION, UNPAID_LEAVE, EMERGENCY, MATERNITY, OTHER\n\nContoh: /cuti SICK 2026-08-20 2026-08-21 Demam';
  }
  const leaveType = m[1].toUpperCase();
  const startDate = m[2];
  const endDate = m[3];
  const reason = m[4]?.trim() ?? '';

  if (!CONFIG.botSecret) {
    return '⚠️ Layanan belum aktif (TELEGRAM_BOT_SECRET belum di-set). Hubungi admin.';
  }
  const hr = CONFIG.modules.hr;
  try {
    const res = await fetch(`${hr}/api/hr/telegram/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': CONFIG.botSecret },
      body: JSON.stringify({ telegram_chat_id: String(telegramChatId), leave_type: leaveType, start_date: startDate, end_date: endDate, reason }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { leave_id?: string; total_days?: string; approval_status?: string };
      error?: { message?: string };
    };
    if (res.status === 404) {
      return '❌ Akun Telegram kamu belum dihubungkan. Login ke aplikasi, minta kode, lalu ketik /link KODE.';
    }
    if (!res.ok || !json.data) {
      return `⚠️ Gagal mengajukan cuti: ${json.error?.message ?? res.status}.`;
    }
    const d = json.data;
    return `✅ Cuti berhasil diajukan!\n\nID: ${d.leave_id}\nDurasi: ${d.total_days ?? '-'} hari\nStatus: ${d.approval_status ?? 'PENDING'}\n\nMenunggu persetujuan atasan.`;
  } catch {
    return '⚠️ Gagal menghubungi server. Coba lagi sebentar lagi.';
  }
}

/**
 * Consume a link code against the first app that accepts it.
 * Returns a human-readable result message.
 */
export async function handleLinkCommand(text: string, telegramChatId: number): Promise<string> {
  const m = (text || '').trim().match(/^\/link\s+([A-Z2-9]{6})$/i);
  if (!m) {
    return '❌ Format salah.\n\nCara menghubungkan akun:\n1. Login ke aplikasi web YKP\n2. Buka menu <b>Telegram</b> → dapatkan kode 6 karakter\n3. Ketik: <b>/link KODE</b>\n\nContoh: /link ABC123';
  }
  const code = m[1].toUpperCase();

  if (!CONFIG.botSecret) {
    return '⚠️ Link belum aktif (TELEGRAM_BOT_SECRET belum di-set). Hubungi admin.';
  }

  for (const mod of LINK_MODULES) {
    try {
      const res = await fetch(`${mod.baseUrl}${mod.consumePath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-secret': CONFIG.botSecret,
        },
        body: JSON.stringify({ code, telegram_chat_id: String(telegramChatId) }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { userId?: string }; error?: { message?: string } };
      if (res.ok && json.data?.userId) {
        return `✅ Akun Telegram kamu berhasil dihubungkan (user ${json.data.userId}). Sekarang kamu bisa menerima notifikasi & bertanya ke Hermez.`;
      }
      if (res.status === 400) {
        return `❌ Kode tidak valid atau sudah kedaluwarsa. Minta kode baru dari aplikasi, lalu coba lagi.`;
      }
      // 401/other — try next module.
    } catch {
      // network error — try next module
    }
  }
  return '⚠️ Gagal menghubungkan akun. Coba lagi sebentar lagi, atau hubungi admin.';
}

/**
 * Deep-link handler: `/start KODE` (from t.me/<bot>?start=KODE).
 * Same consume logic as /link, but returns a success message that invites
 * the user to tap the main menu — no typing required.
 */
export async function handleStartLink(text: string, telegramChatId: number): Promise<string> {
  const code = startLinkCode(text);
  if (!code) return '❌ Kode tidak ditemukan. Buka aplikasi web YKP → menu Telegram → tap tombol untuk menghubungkan.';
  if (!CONFIG.botSecret) {
    return '⚠️ Link belum aktif (TELEGRAM_BOT_SECRET belum di-set). Hubungi admin.';
  }
  for (const mod of LINK_MODULES) {
    try {
      const res = await fetch(`${mod.baseUrl}${mod.consumePath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bot-secret': CONFIG.botSecret },
        body: JSON.stringify({ code, telegram_chat_id: String(telegramChatId) }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { userId?: string }; error?: { message?: string } };
      if (res.ok && json.data?.userId) {
        return `✅ Akun Telegram kamu berhasil dihubungkan! 🎉\n\nSekarang kamu bisa absen, lihat jadwal, dan ajukan cuti langsung dari sini.`;
      }
      if (res.status === 400) {
        return `❌ Kode tidak valid atau sudah kedaluwarsa. Buka aplikasi web YKP → menu Telegram → tap tombol untuk dapat kode baru.`;
      }
    } catch {
      // network error — try next module
    }
  }
  return '⚠️ Gagal menghubungkan akun. Coba lagi sebentar lagi, atau hubungi admin.';
}
