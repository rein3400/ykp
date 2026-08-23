/**
 * Telegram command registry — MANAGEMENT bot (@ykpchataibot, owned by
 * ykp-hermez). Consumed by scripts/set-commands.mjs.
 */
export interface BotCommand {
  command: string;
  description: string;
}

export const MANAGEMENT_COMMANDS: BotCommand[] = [
  { command: 'brief', description: 'Ringkasan harian semua modul' },
  { command: 'alerts', description: 'Alert terbuka' },
  { command: 'watch', description: 'Watch rules aktif' },
  { command: 'help', description: 'Contoh pertanyaan' }
];
