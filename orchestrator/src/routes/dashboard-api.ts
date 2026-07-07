import type { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, sql, gte } from 'drizzle-orm';
import { getTradingMetrics } from '../services/metrics.js';
import { breakerState } from '../services/circuit-breaker.js';

export default async function dashboardApiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/trading/metrics', async () => {
    const m = await getTradingMetrics();
    return { ...m, breaker: breakerState('mt5-http'), ts: new Date().toISOString() };
  });

  app.get('/trading/audit', async (req) => {
    const from = (req.query as { from?: string }).from ?? new Date(Date.now() - 7 * 86400000).toISOString();
    const to = (req.query as { to?: string }).to ?? new Date().toISOString();
    const rows = await db.select().from(schema.auditLogs)
      .where(gte(schema.auditLogs.createdAt, new Date(from)))
      .orderBy(sql`created_at DESC`)
      .limit(50);
    return { audit: rows, from, to };
  });

  app.get('/trading/equity', async () => {
    // simple equity curve from journal pnl
    const rows = await db.select().from(schema.tradingJournal).orderBy(sql`created_at ASC`).limit(500);
    let equity = 10000;
    const curve = rows.map((r) => {
      equity += Number(r.pnlUsd ?? 0);
      return { ts: r.createdAt.toISOString(), equity: Math.round(equity * 100) / 100 };
    });
    return { startingEquity: 10000, curve };
  });
}