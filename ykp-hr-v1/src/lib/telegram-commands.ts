/**
 * Telegram command registry — single source of truth for the EMPLOYEE bot
 * (@justatestermaybot, webhook-owned by ykp-hr-v1).
 *
 * Consumed by:
 *  - scripts/set-commands.mjs (pushes to Telegram setMyCommands at deploy)
 *  - docs/runbooks (keep in sync manually)
 */
export interface BotCommand {
  command: string;
  description: string;
}

export const EMPLOYEE_COMMANDS: BotCommand[] = [
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
