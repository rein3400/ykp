import { db, schema } from '../db/index.js';
import { gte, eq, sql } from 'drizzle-orm';

export interface TradingMetrics {
  winRate30d: number;
  totalJournal30d: number;
  wins: number;
  losses: number;
  breakeven: number;
  avgRR: number;
  weeklyPnl: number;
  openTrades: number;
  pendingApprovals: number;
  aiUsage7d: { taskType: string; count: number }[];
}

export async function getTradingMetrics(): Promise<TradingMetrics> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const journal = await db.select().from(schema.tradingJournal)
    .where(gte(schema.tradingJournal.createdAt, thirtyDaysAgo));
  const wins = journal.filter((j) => j.result === 'win').length;
  const losses = journal.filter((j) => j.result === 'loss').length;
  const breakeven = journal.filter((j) => j.result === 'breakeven').length;
  const total = journal.length;
  const winRate = total > 0 ? (wins / total) * 100 : 0;

  const rrValues = journal.map((j) => Number(j.rrActual ?? 0)).filter((n) => n > 0);
  const avgRR = rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : 0;

  const weekJournals = journal.filter((j) => j.createdAt >= sevenDaysAgo);
  const weeklyPnl = weekJournals.reduce((sum, j) => sum + Number(j.pnlUsd ?? 0), 0);

  const openExec = await db.select().from(schema.tradeExecutions).where(eq(schema.tradeExecutions.status, 'filled'));
  const openTrades = openExec.length;

  const pendingRows = await db.select().from(schema.tradingSetups).where(eq(schema.tradingSetups.status, 'PENDING'));
  const pendingApprovals = pendingRows.length;

  const aiRows = await db.execute(sql`SELECT task_type, COUNT(*)::int as cnt FROM ai_logs WHERE created_at >= ${sevenDaysAgo.toISOString()} GROUP BY task_type ORDER BY cnt DESC LIMIT 10`);
  const aiUsage7d = (Array.isArray(aiRows) ? aiRows : []).map((r: Record<string, unknown>) => ({
    taskType: String(r.task_type ?? ''),
    count: Number(r.cnt ?? 0)
  }));

  return { winRate30d: Math.round(winRate * 10) / 10, totalJournal30d: total, wins, losses, breakeven, avgRR: Math.round(avgRR * 100) / 100, weeklyPnl: Math.round(weeklyPnl * 100) / 100, openTrades, pendingApprovals, aiUsage7d };
}