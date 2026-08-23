/**
 * Internal approval decision endpoint for the Hermez Telegram bot (Fase 4).
 *
 * When a presser taps Setujui/Tolak on a Telegram approval message, Hermez
 * relays the decision here (x-bot-secret authenticated). This endpoint is the
 * ONLY authority: it resolves the presser's user by telegram chat id, loads
 * the record, and runs the SAME approval FSM as the web route
 * (lib/approval.transitionApproval → role amount thresholds, segregation of
 * duties, guarded optimistic-concurrency update, audit log). Telegram is just
 * another client of the same business rules.
 *
 * POST /api/internal/approval
 *   headers: x-bot-secret: <TELEGRAM_BOT_SECRET>
 *   body: { entity_hint: 'finance', record_id: 'EXP-…',
 *           action: 'approve'|'reject', telegram_chat_id: '<numeric>' }
 *   200 → { data: { record_id, entity, approval_status } }
 */
import { NextRequest } from 'next/server';
import { findRow, TABS, type TabName } from '@/db/sheets';
import { ok, badRequest, unauthorized, notFound, handler, conflict } from '@/lib/http';
import { safeEqual } from '@/lib/cron';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import type { Role } from '@/lib/rbac';
import { transitionApproval, type ApprovalEntity, type ApprovalStatus } from '@/lib/approval';
import { guardedUpdateRow, ConcurrentUpdateError } from '@/lib/concurrency';

/** fin_* tab + id column per entity prefix. Extend as more entities onboard. */
const ENTITY_TABLES: Record<string, { tab: TabName; idColumn: string }> = {
  EXP: { tab: TABS.expense, idColumn: 'expense_id' }
};

function resolveEntity(recordId: string): { tab: TabName; idColumn: string; entity: ApprovalEntity } | null {
  const prefix = recordId.split('-')[0]?.toUpperCase() ?? '';
  if (prefix === 'EXP') return { ...ENTITY_TABLES.EXP, entity: 'expense' };
  return null;
}

export const POST = handler(async (req: NextRequest) => {
  const botSecret = process.env.TELEGRAM_BOT_SECRET ?? '';
  if (!botSecret || !safeEqual(req.headers.get('x-bot-secret') ?? '', botSecret)) {
    return unauthorized('Invalid bot secret');
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const recordId = (body.record_id ?? '').trim();
  const action = (body.action ?? '').toLowerCase();
  const chatIdRaw = (body.telegram_chat_id ?? '').trim();
  if (!recordId) return badRequest('record_id required');
  if (!['approve', 'reject'].includes(action)) return badRequest("action must be 'approve' | 'reject'");
  if (!/^\d+$/.test(chatIdRaw)) return badRequest('telegram_chat_id must be numeric');

  // Resolve the presser: users.telegram_id is the single identity source.
  const users = await findRow(TABS.users, 'telegram_id', chatIdRaw);
  if (!users) return badRequest(`No user linked to telegram chat id ${chatIdRaw}`);
  const actorRow = users.row;
  const status = (actorRow.active_status ?? '').trim().toLowerCase();
  if (status && status !== 'active') return badRequest('User is not active');

  const target = resolveEntity(recordId);
  if (!target) return badRequest(`Unknown record id prefix: ${recordId}`);

  const found = await findRow(target.tab, target.idColumn, recordId);
  if (!found) return notFound(`record not found: ${recordId}`);
  const before = { ...found.row };

  const current = (before.approval_status || 'DRAFT') as ApprovalStatus;
  const to: ApprovalStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
  const r = transitionApproval(
    {
      id: recordId,
      entity: target.entity,
      amount: Number(before.amount || 0),
      status: current,
      createdBy: before.created_by ?? null
    },
    current,
    to,
    { id: actorRow.user_id, role: actorRow.role }
  );
  if (!r.ok) return badRequest(r.error ?? 'transition not allowed');

  const next = {
    ...before,
    approval_status: to,
    approved_by: action === 'approve' ? actorRow.user_id : '',
    updated_at: nowTimestampWib()
  };
  try {
    await guardedUpdateRow(target.tab, target.idColumn, recordId, found, next);
  } catch (e) {
    if (e instanceof ConcurrentUpdateError) return conflict(e.message);
    throw e;
  }

  await logAudit({
    module: 'finance', action: `approve:${action}`, recordType: 'fin_expense',
    recordId, beforeValue: JSON.stringify(before), afterValue: JSON.stringify(next),
    reason: `via telegram (${chatIdRaw})${body.reason ? `: ${body.reason}` : ''}`,
    userId: actorRow.user_id, approvalUserId: actorRow.user_id
  }).catch(() => null);

  return ok({ record_id: recordId, entity: target.entity, approval_status: to });
});
