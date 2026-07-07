import { db, schema } from '../db/index.js';
import { desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function handleJournalCommand(_args: string): Promise<string> {
  const recent = await db.select().from(schema.tradingJournal).orderBy(desc(schema.tradingJournal.createdAt)).limit(5);
  if (recent.length === 0) return 'Belum ada entry di trading journal.';
  const lines = recent.map((j) => `${j.pair} ${j.bias} @ ${j.entry} [${j.result}]`);
  return `JOURNAL TERAKHIR:\n${lines.join('\n')}`;
}

export async function addJournalEntry(input: {
  pair: string;
  bias: 'BUY' | 'SELL';
  setupType: string;
  entry: string;
  sl?: string;
  tp?: string;
  notes?: string;
}): Promise<{ id: string }> {
  const id = `TJ-${nanoid(12)}`;
  await db.insert(schema.tradingJournal).values({
    id,
    pair: input.pair,
    bias: input.bias,
    setupType: input.setupType,
    entry: input.entry,
    sl: input.sl ?? '',
    tp: input.tp ?? '',
    notes: input.notes ?? '',
    result: 'open'
  });
  return { id };
}

export async function listJournal(limit = 20): Promise<(typeof schema.tradingJournal.$inferSelect)[]> {
  return db.select().from(schema.tradingJournal).orderBy(desc(schema.tradingJournal.createdAt)).limit(limit);
}

export async function updateJournalResult(id: string, result: string): Promise<void> {
  await db.update(schema.tradingJournal).set({ result }).where(eq(schema.tradingJournal.id, id));
}