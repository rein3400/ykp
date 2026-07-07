import { db, schema } from '../db/index.js';
import { eq, lt } from 'drizzle-orm';
import { eq as eqCol } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { InlineKeyboard } from 'grammy';
import { env } from '../config/env.js';
import { logger } from '../services/logger.js';

async function audit(actor: string, action: string, entity: string, entityId: string, meta: Record<string, unknown> = {}): Promise<void> {
  try {
    await db.insert(schema.auditLogs).values({
      id: `AU-${nanoid(12)}`,
      actor,
      action,
      entity,
      entityId,
      meta
    });
  } catch (err) {
    logger.warn({ err, action, entityId }, 'audit log insert failed');
  }
}

/**
 * Mark a VALID_SETUP setup as PENDING approval, create trading_approvals row,
 * send Telegram inline keyboard for Approve/Reject.
 */
export async function submitForApproval(setupId: string, summary: string): Promise<{ ok: boolean; approvalId: string }> {
  const approvalId = `AP-${nanoid(12)}`;

  // flip setup status to PENDING
  await db.update(schema.tradingSetups)
    .set({ status: 'PENDING' })
    .where(eq(schema.tradingSetups.id, setupId));

  // create approval row (decision null)
  await db.insert(schema.tradingApprovals).values({
    id: approvalId,
    setupId,
    reason: summary
  });

  // send Telegram inline keyboard
  const { sendTelegram } = await import('../services/telegram.js');
  const keyboard = new InlineKeyboard()
    .text('✅ Approve', `approve:${setupId}`)
    .text('❌ Reject', `reject:${setupId}`);
  await sendTelegram({
    chatId: env.TELEGRAM_OWNER_CHAT_ID,
    text: `⏳ <b>SETUP MENUNGGU APPROVAL</b>\n\n${summary}\n\nApprove untuk eksekusi, Reject untuk buang.`,
    parseMode: 'HTML',
    replyMarkup: keyboard
  });

  logger.info({ setupId, approvalId }, 'approval submitted');
  return { ok: true, approvalId };
}

/**
 * Handle Approve/Reject decision from Telegram callback or REST API.
 * Updates setup status, approval row, links journal entry.
 */
export async function handleApproval(
  setupId: string,
  decision: 'approved' | 'rejected',
  decidedBy: string,
  reason?: string
): Promise<{ ok: boolean }> {
  // load setup
  const rows = await db.select().from(schema.tradingSetups).where(eq(schema.tradingSetups.id, setupId)).limit(1);
  if (rows.length === 0) return { ok: false };
  const setup = rows[0]!;
  if (setup.status !== 'PENDING') {
    logger.warn({ setupId, current: setup.status }, 'approval decision on non-pending setup');
  }

  const newSetupStatus = decision === 'approved' ? 'APPROVED' : 'REJECTED';

  await db.update(schema.tradingSetups)
    .set({ status: newSetupStatus })
    .where(eq(schema.tradingSetups.id, setupId));

  await db.update(schema.tradingApprovals)
    .set({ decision, decidedBy, decidedAt: new Date(), reason: reason ?? '' })
    .where(eq(schema.tradingApprovals.setupId, setupId));

  // link journal entry (if auto-created with setupId)
  if (decision === 'approved') {
    await db.update(schema.tradingJournal)
      .set({ approvedAt: new Date(), approvedBy: decidedBy })
      .where(eqCol(schema.tradingJournal.setupId, setupId));
  } else {
    // mark journal as rejected/closed
    await db.update(schema.tradingJournal)
      .set({ result: 'rejected' })
      .where(eqCol(schema.tradingJournal.setupId, setupId));
  }

  logger.info({ setupId, decision, decidedBy }, 'approval decided');
  await audit(decidedBy, `approval:${decision}`, 'setup', setupId, { reason: reason ?? '' });
  if (decision === 'approved') {
    // Phase 3: dispatch execution best-effort
    try {
      const { executeApproved } = await import('./trade-executor.js');
      const r = await executeApproved(setupId);
      await audit(decidedBy, 'execution:dispatch', 'setup', setupId, { ok: r.ok, error: r.error });
    } catch (err) {
      logger.error({ err, setupId }, 'execution dispatch failed');
      await audit(decidedBy, 'execution:dispatch:failed', 'setup', setupId, { error: (err as Error).message });
    }
  }
  return { ok: true };
}

/**
 * Sweep stale PENDING setups older than APPROVAL_TTL_MIN → EXPIRED + notify owner.
 */
export async function expirePending(): Promise<number> {
  const cutoff = new Date(Date.now() - env.APPROVAL_TTL_MIN * 60 * 1000);
  const stale = await db.select().from(schema.tradingSetups)
    .where(lt(schema.tradingSetups.createdAt, cutoff));
  let expired = 0;
  for (const s of stale) {
    if (s.status !== 'PENDING') continue;
    await db.update(schema.tradingSetups)
      .set({ status: 'EXPIRED' })
      .where(eq(schema.tradingSetups.id, s.id));
    const { sendToOwner } = await import('./telegram-bot.js');
    await sendToOwner(`⌛ Setup ${s.pair} ${s.timeframe} EXPIRED — tidak diapprove dalam ${env.APPROVAL_TTL_MIN} menit.`).catch(() => {});
    expired++;
  }
  if (expired > 0) {
    logger.info({ expired }, 'expired stale pending setups');
  }
  return expired;
}