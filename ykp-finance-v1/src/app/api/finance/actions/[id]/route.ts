/**
 * Action tracker status updates (OPEN → IN_PROGRESS → DONE etc., Revisi #22).
 */
import { NextRequest } from 'next/server';
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, notFound, handler, forbidden } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { can, type Role } from '@/lib/rbac';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_APPROVAL', 'DONE', 'CANCELLED', 'OVERDUE'];

export const PATCH = handler(async (req: NextRequest, { params }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'update', 'action')) return forbidden('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const status = (body.status ?? '').toUpperCase();
  if (status && !STATUSES.includes(status)) return badRequest(`status must be one of ${STATUSES.join(', ')}`);

  const found = await findRow(TABS.actionTracker, 'action_id', params.id);
  if (!found) return notFound(`action_id not found: ${params.id}`);

  const before = { ...found.row };
  const next = {
    ...before,
    status: status || before.status,
    action_taken: body.action_taken ?? before.action_taken,
    assigned_to: body.assigned_to ?? before.assigned_to,
    due_date: body.due_date ?? before.due_date,
    updated_at: nowTimestampWib(),
    completed_at: status === 'DONE' ? nowTimestampWib() : before.completed_at
  };
  await updateRow(TABS.actionTracker, found.rowNumber, next);
  await logAudit({
    module: 'finance', action: 'update', recordType: 'finance_action_tracker',
    recordId: params.id, beforeValue: JSON.stringify(before), afterValue: JSON.stringify(next),
    userId: s.userId
  }).catch(() => null);
  return ok(next);
});
