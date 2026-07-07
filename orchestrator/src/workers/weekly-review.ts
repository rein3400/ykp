import { db, schema } from '../db/index.js';
import { gte } from 'drizzle-orm';
import { sendToOwner } from '../modules/telegram-bot.js';
import { logger } from '../services/logger.js';

export async function runWeeklyReview(): Promise<void> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const setups = await db.select().from(schema.tradingSetups)
    .where(gte(schema.tradingSetups.createdAt, weekAgo));
  const journals = await db.select().from(schema.tradingJournal)
    .where(gte(schema.tradingJournal.createdAt, weekAgo));

  const byStatus: Record<string, number> = {};
  for (const s of setups) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
  }
  const wins = journals.filter((j) => j.result === 'win').length;
  const losses = journals.filter((j) => j.result === 'loss').length;
  const total = journals.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  const lines = [
    `📊 <b>WEEKLY REVIEW HERMES</b>`,
    `Periode: ${weekAgo.toISOString().slice(0, 10)} → ${new Date().toISOString().slice(0, 10)}`,
    ``,
    `<b>Setups:</b> ${setups.length}`,
    ...Object.entries(byStatus).map(([k, v]) => `  ${k}: ${v}`),
    ``,
    `<b>Journal:</b> ${total} entries`,
    `  Win: ${wins} · Loss: ${losses} · WinRate: ${winRate}%`,
    ``,
    `Next: review pada Minggu berikutnya.`
  ].join('\n');

  await sendToOwner(lines);
  logger.info({ setups: setups.length, journals: total }, 'weekly review sent');
}