import { NextRequest } from 'next/server';
import { readTab, appendRows, updateRow, findRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { ok, list, unauthorized, forbidden, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nextSequentialIdSync } from '@/lib/repo';
import { todayWib, nowTimestampWib } from '@/lib/format';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'opening')) return forbidden();
  return list(await readTab(TABS.checklistSubmissions));
});

/**
 * Submit a verified operational checklist for a given date/outlet/shift/type.
 * body.items = [{ checklist_item, department, status('DONE'|'NOT_DONE'), notes, critical_flag }]
 * Re-submitting the same (date, outlet, shift, checklist_type) replaces the prior
 * rows so operation staff can correct a submission.
 */
export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'opening')) return forbidden();

  const body = (await req.json().catch(() => ({}))) as {
    outlet_id?: string;
    shift_id?: string;
    checklist_type?: string;
    items?: Array<{
      checklist_item: string;
      department?: string;
      status: string;
      notes?: string;
      critical_flag?: string;
    }>;
  };

  if (!body.outlet_id) return badRequest('outlet_id required');
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return badRequest('items required — pilih setidaknya satu item checklist');
  }
  const checklistType = (body.checklist_type || 'GENERAL').toUpperCase();

  const outlet = await findRow(TABS.outlets, 'outlet_id', body.outlet_id);
  if (!outlet) return badRequest('outlet not found');

  const date = todayWib();
  const now = nowTimestampWib();

  // Idempotent replace: delete (invalidate) prior rows for the same key by
  // rewriting status to VOID, then append the fresh submission set.
  const existing = await readTab<Record<string, string>>(TABS.checklistSubmissions);
  for (const r of existing) {
    if (
      r.date === date &&
      r.outlet_id === body.outlet_id &&
      (r.shift_id || '') === (body.shift_id || '') &&
      (r.checklist_type || '').toUpperCase() === checklistType &&
      r.status !== 'VOID'
    ) {
      // Resolve the stable row identity via findRow (Sheets row / pg
      // __rownum). A dense readTab counter is wrong once Postgres
      // __rownum has gaps from deletes.
      if (!r.submission_id) continue;
      const target = await findRow(TABS.checklistSubmissions, 'submission_id', r.submission_id).catch(() => null);
      if (target) await updateRow(TABS.checklistSubmissions, target.rowIndex, { ...r, status: 'VOID' }).catch(() => null);
    }
  }

  const rows = body.items.map((item) => ({
    submission_id: nextSequentialIdSync('SCK'),
    date,
    brand_id: outlet.row.brand_id,
    outlet_id: body.outlet_id as string,
    shift_id: body.shift_id ?? '',
    checklist_type: checklistType,
    checklist_item: item.checklist_item,
    department: item.department ?? '',
    status: item.status === 'DONE' ? 'DONE' : 'NOT_DONE',
    notes: item.notes ?? '',
    verified_by: s.userId,
    verified_at: now,
    critical_flag: item.critical_flag === 'true' ? 'true' : 'false',
    created_at: now,
  }));

  await appendRows(TABS.checklistSubmissions, rows);
  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'create',
    entity: 'checklist',
    entityId: rows[0]?.submission_id ?? '',
    afterValue: JSON.stringify({
      count: rows.length,
      outlet: body.outlet_id,
      shift: body.shift_id || '',
      checklist_type: checklistType,
      date,
    }),
  }).catch(() => null);

  return ok({ count: rows.length, date, checklist_type: checklistType }, 201);
});
