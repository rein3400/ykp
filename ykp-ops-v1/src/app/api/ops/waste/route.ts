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
  if (!can(s.role as Role, 'view', 'waste')) return forbidden();
  const waste = await readTab(TABS.waste);
  const issues = await readTab(TABS.stockIssues);
  return ok({ waste, stockIssues: issues });
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'waste')) return forbidden();
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.outlet_id || !body.ingredient_name) return badRequest('outlet_id and ingredient_name required');
  const outlet = await findRow(TABS.outlets, 'outlet_id', body.outlet_id);
  if (!outlet) return badRequest('outlet not found');
  const qty = Number(body.qty || 0);
  const unitCost = Number(body.estimated_unit_cost || 0);
  const id = nextSequentialIdSync('WST');
  const row = {
    waste_id: id,
    date: todayWib(),
    brand_id: outlet.row.brand_id,
    outlet_id: body.outlet_id,
    shift_id: body.shift_id ?? '',
    ingredient_id: body.ingredient_id ?? '',
    ingredient_name: body.ingredient_name,
    menu_id: '',
    menu_name: '',
    qty: String(qty),
    unit: body.unit || 'kg',
    estimated_unit_cost: String(unitCost),
    estimated_total_value: String(qty * unitCost),
    waste_type: body.waste_type || 'SPOILED',
    reason: body.reason ?? '',
    photo_url: body.photo_url ?? '',
    reported_by: s.userId,
    approval_status: 'APPROVED',
    approved_by: '',
    related_incident_id: body.related_incident_id ?? '',
    created_at: nowTimestampWib(),
  };
  await appendRows(TABS.waste, [row]);
  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'create',
    entity: 'waste',
    entityId: id,
    afterValue: JSON.stringify(row),
  }).catch(() => null);
  return ok(row, 201);
});
