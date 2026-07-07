import { handleReport } from '../modules/owner-bot.js';
import { sendToOwner } from '../modules/telegram-bot.js';
import { logSystem } from '../services/logger.js';

export async function runDailyReport(): Promise<void> {
  try {
    const report = await handleReport();
    const res = await sendToOwner(report);
    await logSystem(res.ok ? 'info' : 'error', 'daily-report', res.ok ? 'daily report sent' : `telegram send failed: ${res.error}`, { ok: res.ok });
  } catch (err) {
    await logSystem('error', 'daily-report', `worker error: ${(err as Error).message}`);
  }
}