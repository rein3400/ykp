#!/usr/bin/env node
/**
 * Push the Telegram command menu for BOTH bots and verify with getMyCommands.
 * Run at deploy time (not manual): `node scripts/set-commands.mjs`
 *
 * Reads tokens from env (falls back to legacy names):
 *   TELEGRAM_EMPLOYEE_BOT_TOKEN  (@justatestermaybot)
 *   TELEGRAM_MANAGEMENT_BOT_TOKEN (@ykpchataibot)
 *
 * The command lists are duplicated inline as JSON so this script has no
 * TypeScript build step; keep in sync with src/lib/telegram-commands.ts
 * (HR) and src/telegram-commands.ts (Hermez).
 *
 * NOTE: the MANAGEMENT bot has NO /link command by design — its access is
 * chat-id/role based only (TELEGRAM_OWNER_IDS / TELEGRAM_ALLOWED_IDS /
 * users.telegram_id). Pairing codes belong to the EMPLOYEE bot flow.
 */
const EMPLOYEE = [
  { command: 'start', description: 'Mulai & menu utama' },
  { command: 'link', description: 'Hubungkan akun: /link KODE' },
  { command: 'masuk', description: 'Absen masuk (butuh lokasi)' },
  { command: 'pulang', description: 'Absen pulang' },
  { command: 'absen', description: 'Menu absensi' },
  { command: 'jadwal', description: 'Jadwal shift minggu ini' },
  { command: 'cuti', description: 'Ajukan cuti' },
  { command: 'me', description: 'Profil & kehadiran hari ini' },
  { command: 'help', description: 'Bantuan' }
];
const MANAGEMENT = [
  { command: 'brief', description: 'Ringkasan harian semua modul' },
  { command: 'alerts', description: 'Alert terbuka' },
  { command: 'watch', description: 'Watch rules aktif' },
  { command: 'help', description: 'Contoh pertanyaan' }
];

async function tg(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  });
  return res.json();
}

async function apply(name, token, commands) {
  if (!token) {
    console.log(`${name}: SKIP (no token)`);
    return false;
  }
  const set = await tg(token, 'setMyCommands', { commands });
  if (!set.ok) {
    console.log(`${name}: FAILED — ${set.description}`);
    return false;
  }
  const got = await tg(token, 'getMyCommands');
  const okCount = Array.isArray(got.result) ? got.result.length : -1;
  console.log(`${name}: set ${commands.length} commands, getMyCommands returns ${okCount} ${okCount === commands.length ? '✓' : '✗ MISMATCH'}`);
  return okCount === commands.length;
}

const empToken = process.env.TELEGRAM_EMPLOYEE_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
const mgmtToken = process.env.TELEGRAM_MANAGEMENT_BOT_TOKEN || '';

const ok1 = await apply('employee @justatestermaybot', empToken, EMPLOYEE);
const ok2 = await apply('management @ykpchataibot', mgmtToken, MANAGEMENT);
process.exit(ok1 && ok2 ? 0 : 1);
