/**
 * Action tracker ΓÇö assign PIC, update status (OPEN ΓåÆ IN_PROGRESS ΓåÆ DONE).
 */
import { NextRequest } from 'next/server';
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, forbidden, badRequest, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { can } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';

const VALID = new Set(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']);

export const PATCH = handler(async (req: NextRequest, { params }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as never, 'update', 'action')) return forbidden();

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const found = await findRow(TABS.actionTracker, 'action_id', params.id);
  if (!found) return notFound('Action tidak ditemukan');
  const before = { ...found.row };
  const updated = { ...found.row };

  if (body.status !== undefined) {
    if (!VALID.has(body.status)) return badRequest('status tidak valid');
    updated.status = body.status;
    if (body.status === 'DONE') updated.completed_at = nowTimestampWib();
  }
  for (const k of ['assigned_to', 'due_date', 'action_taken', 'attachment_url']) {
    if (body[k] !== undefined) updated[k] = body[k];
  }
  updated.updated_at = nowTimestampWib();

  await updateRow(TABS.actionTracker, found.rowNumber, updated);
  await logAudit({
    module: 'ops', action: 'update', recordType: 'ops_action_tracker', recordId: params.id,
    beforeValue: JSON.stringify(before), afterValue: JSON.stringify(updated), userId: s.userId
  }).catch(() => null);
  return ok(updated);
});
