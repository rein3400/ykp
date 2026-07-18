import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { ok, list, unauthorized, forbidden, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nextSequentialIdSync } from '@/lib/repo';
import { todayWib, nowTimestampWib } from '@/lib/format';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'closing')) return forbidden();
  return list(await readTab(TABS.closing));
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'closing')) return forbidden();
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.outlet_id) return badRequest('outlet_id required');
  const outlet = await findRow(TABS.outlets, 'outlet_id', body.outlet_id);
  if (!outlet) return badRequest('outlet not found');
  const expected = Number(body.expected_cash || 0);
  const actual = Number(body.actual_cash || 0);
  const diff = actual - expected;
  const id = nextSequentialIdSync('CLS');
  const row = {
    closing_id: id,
    date: todayWib(),
    brand_id: outlet.row.brand_id,
    outlet_id: body.outlet_id,
    shift_id: body.shift_id ?? '',
    expected_cash: String(expected),
    actual_cash: String(actual),
    cash_difference: String(diff),
    checklist_status: body.checklist_status || 'DONE',
    issues: body.issues ?? '',
    photo_url: body.photo_url ?? '',
    closed_by: s.userId,
    approved_by: '',
    status: Math.abs(diff) >= 50000 ? 'NEEDS_REVIEW' : 'CLOSED',
    created_at: nowTimestampWib(),
  };
  await appendRows(TABS.closing, [row]);
  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'create',
    entity: 'closing',
    entityId: id,
    afterValue: JSON.stringify(row),
  }).catch(() => null);
  return ok(row, 201);
});
