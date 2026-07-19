/**
 * Alert lifecycle ΓÇö assign / acknowledge / resolve.
 */
import { NextRequest } from 'next/server';
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, forbidden, badRequest, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { can } from '@/lib/rbac';
import { nowTimestampWib } from '@/lib/format';

const VALID = new Set(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']);

export const PATCH = handler(async (req: NextRequest, { params }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as never, 'update', 'alert')) return forbidden();

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const found = await findRow(TABS.alertLog, 'alert_id', params.id);
  if (!found) return notFound('Alert tidak ditemukan');
  const before = { ...found.row };
  const updated = { ...found.row };

  if (body.status !== undefined) {
    if (!VALID.has(body.status)) return badRequest('status tidak valid');
    updated.status = body.status;
    if (body.status === 'RESOLVED') {
      updated.resolved_at = nowTimestampWib();
      updated.resolved_by = s.userId;
    }
  }
  if (body.assigned_to !== undefined) updated.assigned_to = body.assigned_to;

  await updateRow(TABS.alertLog, found.rowNumber, updated);
  await logAudit({
    module: 'ops', action: 'update', recordType: 'ops_alert_log', recordId: params.id,
    beforeValue: JSON.stringify(before), afterValue: JSON.stringify(updated), userId: s.userId
  }).catch(() => null);
  return ok(updated);
});
