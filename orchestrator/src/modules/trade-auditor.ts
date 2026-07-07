import { db, schema } from '../db/index.js';
import { eq, inArray } from 'drizzle-orm';
import { getMt5Bridge } from './mt5-bridge.js';
import { logger } from '../services/logger.js';

function resultFromPnl(pnlUsd: number): 'win' | 'loss' | 'breakeven' {
  if (pnlUsd > 0) return 'win';
  if (pnlUsd < 0) return 'loss';
  return 'breakeven';
}

/**
 * Reconcile open trade_executions against MT5 open trades.
 * For closed trades, update execution status, journal pnlUsd/result/rrActual.
 */
export async function reconcileClosedTrades(): Promise<{ closed: number; errors: number }> {
  const bridge = getMt5Bridge();
  let closed = 0;
  let errors = 0;

  const openExecutions = await db.select().from(schema.tradeExecutions).where(eq(schema.tradeExecutions.status, 'filled'));
  if (openExecutions.length === 0) return { closed: 0, errors: 0 };

  let bridgeTrades: { orderId: string; pnlUsd: number; closeTime?: string }[] = [];
  try {
    bridgeTrades = (await bridge.getOpenTrades()).map((t) => ({ orderId: t.orderId, pnlUsd: t.pnlUsd, closeTime: t.closeTime }));
  } catch (err) {
    logger.error({ err }, 'reconcile getOpenTrades failed');
    return { closed: 0, errors: 1 };
  }

  for (const ex of openExecutions) {
    if (!ex.orderId) continue;
    const match = bridgeTrades.find((b) => b.orderId === ex.orderId);
    if (match?.closeTime) {
      const pnl = match.pnlUsd ?? 0;
      const result = resultFromPnl(pnl);
      try {
        await db.update(schema.tradeExecutions)
          .set({ status: 'closed', pnlUsd: String(pnl), closedAt: new Date(match.closeTime) })
          .where(eq(schema.tradeExecutions.id, ex.id));

        await db.update(schema.tradingJournal)
          .set({ pnlUsd: String(pnl), result })
          .where(eq(schema.tradingJournal.setupId, ex.setupId));

        await db.update(schema.tradingSetups)
          .set({ status: 'CLOSED' })
          .where(eq(schema.tradingSetups.id, ex.setupId));

        closed++;
      } catch (err) {
        logger.error({ err, exId: ex.id }, 'reconcile update failed');
        errors++;
      }
    }
  }
  logger.info({ closed, errors }, 'trade auditor reconciled');
  return { closed, errors };
}
