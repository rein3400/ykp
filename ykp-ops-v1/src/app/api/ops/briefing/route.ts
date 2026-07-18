import { NextRequest } from 'next/server';
import { readTab, appendRows, findRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, type Role } from '@/lib/rbac';
import { ok, list, unauthorized, forbidden, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nextSequentialIdSync, getBrandName, getOutletName } from '@/lib/repo';
import { todayWib, nowTimestampWib } from '@/lib/format';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'briefing')) return forbidden();
  const rows = await readTab(TABS.briefing);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'briefing')) return forbidden();
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.outlet_id || !body.briefing_text) return badRequest('outlet_id and briefing_text required');
  const outlet = await findRow(TABS.outlets, 'outlet_id', body.outlet_id);
  if (!outlet) return badRequest('outlet not found');
  const brandId = outlet.row.brand_id;
  const shift = body.shift_id ? await findRow(TABS.shifts, 'shift_id', body.shift_id) : null;
  const id = nextSequentialIdSync('BRF');
  const now = nowTimestampWib();
  const row = {
    briefing_id: id,
    date: body.date || todayWib(),
    brand_id: brandId,
    brand_name: await getBrandName(brandId),
    outlet_id: body.outlet_id,
    outlet_name: await getOutletName(body.outlet_id),
    shift_id: body.shift_id ?? '',
    shift_name: shift?.row.shift_name ?? '',
    briefing_type: body.briefing_type || 'MANUAL',
    briefing_text: body.briefing_text,
    target_sales: body.target_sales ?? '',
    priority_menu: body.priority_menu ?? '',
    stock_warning: body.stock_warning ?? '',
    staffing_warning: body.staffing_warning ?? '',
    service_focus: body.service_focus ?? '',
    generated_by_ai: 'false',
    manually_edited: 'true',
    approved_by: s.userId,
    published_status: 'PUBLISHED',
    published_at: now,
    created_at: now,
    updated_at: now,
  };
  await appendRows(TABS.briefing, [row]);
  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'create',
    entity: 'briefing',
    entityId: id,
    afterValue: JSON.stringify(row),
  }).catch(() => null);
  return ok(row, 201);
});
