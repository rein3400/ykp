import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
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
  const rows = await readTab(TABS.opening);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'opening')) return forbidden();
  const body = (await req.json().catch(() => ({}))) as {
    outlet_id?: string;
    shift_id?: string;
    items?: Array<{ checklist_item: string; critical_flag?: string; status: string }>;
  };
  if (!body.outlet_id || !Array.isArray(body.items)) return badRequest('outlet_id and items required');
  if (body.items.length === 0) return badRequest('Tidak ada item checklist OPENING untuk di-submit. Isi master template dulu.');
  const outletId = body.outlet_id;
  const brand = await readTab(TABS.outlets).then((rows) => rows.find((r) => r.outlet_id === outletId));
  if (!brand) return badRequest('outlet not found');
  const now = nowTimestampWib();
  const date = todayWib();
  const rows = body.items.map((item) => ({
    opening_id: nextSequentialIdSync('OPN'),
    date,
    brand_id: brand.brand_id,
    outlet_id: outletId,
    shift_id: body.shift_id ?? '',
    checklist_item: item.checklist_item,
    status: item.status === 'DONE' ? 'DONE' : 'NOT_DONE',
    photo_url: '',
    notes: '',
    completed_by: s.userId,
    completed_at: now,
    critical_flag: item.critical_flag === 'true' ? 'true' : 'false',
    created_at: now,
  }));
  await appendRows(TABS.opening, rows);
  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'create',
    entity: 'opening',
    entityId: rows[0]?.opening_id ?? '',
    afterValue: JSON.stringify({ count: rows.length, outlet: body.outlet_id }),
  }).catch(() => null);
  return ok({ count: rows.length }, 201);
});
