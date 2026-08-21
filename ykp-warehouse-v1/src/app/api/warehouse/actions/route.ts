/**
 * Action Tracker API per brief §20.
 * GET list, POST create, PUT update status.
 */
import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib, formatDateWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'action')) return unauthorized('Forbidden');

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  let rows = await readTab<Record<string, string>>(TABS.actionTracker);
  if (status) rows = rows.filter((r) => r.status === status);

  // Auto-mark overdue — only OPEN (not IN_PROGRESS / WAITING_APPROVAL),
  // otherwise Start → IN_PROGRESS is immediately flipped back to OVERDUE
  // and looks like a silent no-op in the UI. Persist the transition so a
  // later PUT reads the real status (previously the sheet row stayed OPEN
  // while the API returned OVERDUE).
  const today = formatDateWib(new Date());
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.due_date && r.due_date < today && r.status === 'OPEN') {
      const updated = { ...r, status: 'OVERDUE', updated_at: nowTimestampWib() };
      rows[i] = updated;
      await updateRow(TABS.actionTracker, i + 2, updated).catch(() => null);
      await logAudit({
        module: 'warehouse', action: 'overdue', recordType: 'action',
        recordId: r.action_id, beforeValue: JSON.stringify(r),
        afterValue: JSON.stringify(updated), userId: 'system'
      }).catch(() => null);
    }
  }

  rows.sort((a, b) => {
    // OVERDUE first, then by due_date
    if (a.status === 'OVERDUE' && b.status !== 'OVERDUE') return -1;
    if (b.status === 'OVERDUE' && a.status !== 'OVERDUE') return 1;
    return (a.due_date || '').localeCompare(b.due_date || '');
  });
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'action')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.title) return badRequest('title is required');

  const now = nowTimestampWib();
  const id = nextSequentialIdSync('ACT');
  const row: Record<string, string> = {
    action_id: id,
    source_alert_id: body.source_alert_id ?? '',
    title: body.title,
    description: body.description ?? '',
    brand_id: body.brand_id ?? '',
    outlet_id: body.outlet_id ?? '',
    location_id: body.location_id ?? '',
    item_id: body.item_id ?? '',
    priority: body.priority ?? 'MEDIUM',
    assigned_to: body.assigned_to ?? '',
    assigned_role: body.assigned_role ?? '',
    due_date: body.due_date ?? '',
    status: 'OPEN',
    action_taken: '',
    attachment_url: body.attachment_url ?? '',
    approved_by: '',
    created_at: now,
    updated_at: now,
    completed_at: ''
  };
  await appendRows(TABS.actionTracker, [row]);

  await logAudit({
    module: 'warehouse', action: 'create', recordType: 'action',
    recordId: id, afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);

  return ok(row, 201);
});

export const PUT = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'update', 'action')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as {
    action_id: string;
    status?: string;
    action_taken?: string;
    assigned_to?: string;
  };
  if (!body.action_id) return badRequest('action_id is required');

  const found = await findRow(TABS.actionTracker, 'action_id', body.action_id);
  if (!found) return notFound('Action not found');

  const now = nowTimestampWib();
  const updated = {
    ...found.row,
    status: body.status ?? found.row.status,
    action_taken: body.action_taken ?? found.row.action_taken,
    assigned_to: body.assigned_to ?? found.row.assigned_to,
    updated_at: now,
    completed_at: body.status === 'DONE' ? now : found.row.completed_at
  };
  await updateRow(TABS.actionTracker, found.rowNumber, updated);

  await logAudit({
    module: 'warehouse', action: 'update', recordType: 'action',
    recordId: body.action_id, afterValue: JSON.stringify(updated), userId: s.userId
  }).catch(() => null);

  return ok(updated);
});
