import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getMt5Bridge } from './mt5-bridge.js';
import { env } from '../config/env.js';
import { logger } from '../services/logger.js';
import { sendToOwner } from './telegram-bot.js';

/**
 * Execute an APPROVED setup via MT5Bridge.sendOrder.
 * Idempotent on setupId: skips if a trade_executions row already exists with status sent/filled.
 */
export async function executeApproved(setupId: string): Promise<{ ok: boolean; executionId?: string; error?: string }> {
  // idempotency: existing execution
  const existing = await db.select().from(schema.tradeExecutions).where(eq(schema.tradeExecutions.setupId, setupId)).limit(1);
  if (existing.length > 0) {
    logger.info({ setupId, existing: existing[0]?.status }, 'executeApproved skip — already executed');
    return { ok: true, executionId: existing[0]?.id };
  }

  const setups = await db.select().from(schema.tradingSetups).where(eq(schema.tradingSetups.id, setupId)).limit(1);
  if (setups.length === 0) return { ok: false, error: 'setup not found' };
  const s = setups[0]!;
  if (s.status !== 'APPROVED') return { ok: false, error: `setup not APPROVED (current=${s.status})` };

  // guard: max concurrent
  const bridge = getMt5Bridge();
  try {
    const open = await bridge.getOpenTrades();
    if (open.length >= env.MT5_MAX_CONCURRENT_TRADES) {
      return { ok: false, error: `max concurrent trades reached (${env.MT5_MAX_CONCURRENT_TRADES})` };
    }
  } catch (err) {
    return { ok: false, error: `getOpenTrades failed: ${(err as Error).message}` };
  }

  const side = s.bias === 'bull' ? 'BUY' : 'SELL';
  const entry = s.entryPrice ? Number(s.entryPrice) : undefined;
  const sl = s.sl ? Number(s.sl) : undefined;
  const tp = s.tp ? Number(s.tp) : undefined;
  const lots = s.lots ? Number(s.lots) : 0.01;

  const executionId = `TE-${nanoid(12)}`;
  await db.insert(schema.tradeExecutions).values({
    id: executionId,
    setupId,
    pair: s.pair,
    side,
    entry: s.entryPrice,
    sl: s.sl,
    tp: s.tp,
    lots: s.lots,
    status: 'pending',
    sentAt: new Date()
  });

  try {
    const res = await bridge.sendOrder({
      symbol: s.pair,
      side: side as 'BUY' | 'SELL',
      lots,
      sl,
      tp,
      price: entry,
      comment: `hermes:${setupId}`,
      magic: 99001
    });
    await db.update(schema.tradeExecutions).set({
      orderId: res.orderId,
      status: res.filled ? 'filled' : 'sent',
      entry: String(res.filledPrice ?? entry ?? ''),
      sentAt: new Date(),
      raw: res as unknown as Record<string, unknown>
    }).where(eq(schema.tradeExecutions.id, executionId));
    await db.update(schema.tradingSetups).set({ status: 'EXECUTED' }).where(eq(schema.tradingSetups.id, setupId));
    await sendToOwner(`✅ <b>EXECUTED</b> ${s.pair} ${side} ${lots} lots @ ${res.filledPrice ?? entry}\nSetup ${setupId} → order ${res.orderId}`).catch(() => {});
    logger.info({ setupId, orderId: res.orderId }, 'trade executed');
    return { ok: true, executionId };
  } catch (err) {
    await db.update(schema.tradeExecutions).set({ status: 'failed', raw: { error: (err as Error).message } }).where(eq(schema.tradeExecutions.id, executionId));
    await sendToOwner(`❌ <b>EXECUTION FAILED</b> ${s.pair}\nSetup ${setupId}: ${(err as Error).message}`).catch(() => {});
    return { ok: false, executionId, error: (err as Error).message };
  }
}