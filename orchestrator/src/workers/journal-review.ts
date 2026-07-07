import { db, schema } from '../db/index.js';
import { gte } from 'drizzle-orm';
import { sendToOwner } from '../modules/telegram-bot.js';
import { logger } from '../services/logger.js';

export async function runJournalReview(): Promise<void> {
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const journals = await db.select().from(schema.tradingJournal)
    .where(gte(schema.tradingJournal.createdAt, since));
  if (journals.length === 0) {
    await sendToOwner('📔 Mid-week journal review: belum ada entry baru.');
    return;
  }
  const lines = journals.slice(0, 10).map((j) =>
    `  ${j.pair} ${j.bias} entry=${j.entry} result=${j.result} pnl=${j.pnlUsd ?? '-'}`
  );
  const text = `📔 <b>JOURNAL REVIEW (3 hari)</b>\n${journals.length} entries\n${lines.join('\n')}`;
  await sendToOwner(text);
  logger.info({ count: journals.length }, 'journal review sent');
}
