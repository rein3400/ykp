/**
 * Alert acknowledge / resolve (owner-manager action; Hermez never auto-resolves).
 */
import { NextRequest } from 'next/server';
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, notFound, handler, forbidden } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { can, type Role } from '@/lib/rbac';

export const PATCH = handler(async (req: NextRequest, { params }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'update', 'alert')) return forbidden('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const status = (body.status ?? '').toUpperCase();
  if (!['OPEN', 'ACK', 'RESOLVED'].includes(status)) return badRequest('status must be OPEN | ACK | RESOLVED');

  const found = await findRow(TABS.alertLog, 'alert_id', params.id);
  if (!found) return notFound(`alert_id not found: ${params.id}`);

  const before = { ...found.row };
  const next = {
    ...before,
    status,
    action_taken: body.action_taken ?? before.action_taken,
    assigned_to: body.assigned_to ?? before.assigned_to,
    resolved_at: status === 'RESOLVED' ? nowTimestampWib() : ''
  };
  await updateRow(TABS.alertLog, found.rowNumber, next);
  await logAudit({
    module: 'finance', action: 'update', recordType: 'finance_alert_log',
    recordId: params.id, beforeValue: JSON.stringify(before), afterValue: JSON.stringify(next),
    userId: s.userId
  }).catch(() => null);
  return ok(next);
});
