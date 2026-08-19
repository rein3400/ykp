/**
 * Hermez service config — env-driven, same conventions as the module apps.
 * TELEGRAM_BOT_TOKEN: same bot as the module alert pushes (owner decision).
 * TELEGRAM_OWNER_IDS: comma-separated numeric Telegram user IDs allowed to chat.
 * Without a bot token the service runs in DRY-RUN (logs instead of sending,
 * polling disabled) so the data layer stays testable locally.
 */
import 'node:process';
import { readFileSync } from 'node:fs';

/** Minimal .env loader (no dependency): KEY=VALUE lines, # comments.
 *  Real env vars always win over the file. */
function loadDotEnv(): void {
  try {
    const text = readFileSync('.env', 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      const [, key, value] = m;
      if (process.env[key] === undefined) {
        process.env[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* no .env — real env vars only */
  }
}
loadDotEnv();

export interface ModuleEndpoints {
  finance: string;
  hr: string;
  warehouse: string;
  ops: string;
  investor: string;
}

function env(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim();
}

export const CONFIG = {
  botToken: env('TELEGRAM_BOT_TOKEN'),
  ownerIds: env('TELEGRAM_OWNER_IDS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** Shared secret the bot uses to authenticate link-consume calls to the apps. */
  botSecret: env('TELEGRAM_BOT_SECRET'),
  openRouterKey: env('OPENROUTER_API_KEY'),
  /** Chat model — tool-use capable. Override via OPENROUTER_MODEL. */
  model: env('OPENROUTER_MODEL', 'anthropic/claude-sonnet-4'),
  /** Cheaper model for voice transcription + simple classifications. */
  liteModel: env('OPENROUTER_LITE_MODEL', 'google/gemini-2.0-flash-001'),
  modules: {
    finance: env('YKP_FINANCE_URL', 'http://localhost:3003'),
    hr: env('YKP_HR_URL', 'http://localhost:3002'),
    warehouse: env('YKP_WAREHOUSE_URL', 'http://localhost:3005'),
    ops: env('YKP_OPS_URL', 'http://localhost:3007'),
    investor: env('YKP_INVESTOR_URL', 'http://localhost:3006')
  } satisfies ModuleEndpoints,
  /** Daily brief fire time, WIB. */
  briefHour: 22,
  briefMinute: 5,
  /** Watch-rule evaluation cadence + per-rule cooldown. */
  watchEvalMinutes: 30,
  watchCooldownHours: 4,
  /** Chat memory window. */
  memoryTtlMinutes: 120,
  memoryMaxMessages: 12,
  dataDir: env('HERMEZ_DATA_DIR', './data'),
  /** Max chars per Telegram message (limit is 4096; leave headroom). */
  telegramChunk: 3900
} as const;

export const DRY_RUN = !CONFIG.botToken;

/** WIB date helpers (Asia/Jakarta, UTC+7). */
export function todayWib(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}
export function nowWib(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}:${g('second')}`;
}
export function daysAgoWib(n: number): string {
  const d = new Date(`${todayWib()}T00:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
export function wibHourMinute(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  };
}
export function idr(n: number): string {
  const neg = n < 0;
  const abs = Math.round(Math.abs(n));
  return `${neg ? '-' : ''}Rp${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
