/**
 * Alerts API per brief §19.
 * GET list (filterable), PUT update status (ACK/RESOLVE/IGNORE).
 */
import { NextRequest } from 'next/server';
import { readTab, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { can, type Role } from '@/lib/rbac';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'alert')) return unauthorized('Forbidden');

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const severity = url.searchParams.get('severity');
  const alertType = url.searchParams.get('alert_type');

  let rows = await readTab<Record<string, string>>(TABS.alertLog);
  if (status) rows = rows.filter((r) => r.status === status);
  if (severity) rows = rows.filter((r) => r.severity === severity);
  if (alertType) rows = rows.filter((r) => r.alert_type === alertType);

  rows.sort((a, b) => b.alert_datetime.localeCompare(a.alert_datetime));
  return list(rows);
});

export const PUT = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'update', 'alert')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as {
    alert_id: string;
    action: 'acknowledge' | 'resolve' | 'ignore' | 'in_progress';
  };
  if (!body.alert_id || !body.action) return badRequest('alert_id and action required');

  const found = await findRow(TABS.alertLog, 'alert_id', body.alert_id);
  if (!found) return notFound('Alert not found');

  const statusMap: Record<string, string> = {
    acknowledge: 'ACKNOWLEDGED',
    resolve: 'RESOLVED',
    ignore: 'IGNORED',
    in_progress: 'IN_PROGRESS'
  };
  const newStatus = statusMap[body.action];
  if (!newStatus) return badRequest(`Unknown action: ${body.action}`);

  const now = nowTimestampWib();
  const updated = {
    ...found.row,
    status: newStatus,
    resolved_at: body.action === 'resolve' ? now : found.row.resolved_at,
    resolved_by: body.action === 'resolve' ? s.userId : found.row.resolved_by,
    assigned_to: body.action === 'acknowledge' || body.action === 'in_progress' ? s.userId : found.row.assigned_to
  };
  await updateRow(TABS.alertLog, found.rowNumber, updated);

  await logAudit({
    module: 'warehouse', action: body.action, recordType: 'alert',
    recordId: body.alert_id, afterValue: JSON.stringify(updated), userId: s.userId
  }).catch(() => null);

  return ok(updated);
});
