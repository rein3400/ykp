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
  if (!can(s.role as Role, 'view', 'kds')) return forbidden();
  const rows = await readTab(TABS.kds);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'kds')) return forbidden();
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const outlet = await readTab(TABS.outlets).then((rows) => rows.find((r) => r.outlet_id === body.outlet_id));
  if (!outlet) return badRequest('outlet not found');
  const target = Number(body.target_seconds || 180);
  const serve = Number(body.serving_seconds || 0);
  let sla = 'OK';
  if (serve > target * 2) sla = 'CRITICAL_DELAY';
  else if (serve > target) sla = 'OVER_SLA';
  const now = nowTimestampWib();
  const id = nextSequentialIdSync('KDS');
  const row = {
    order_id: id,
    date: todayWib(),
    brand_id: outlet.brand_id,
    outlet_id: body.outlet_id,
    shift_id: body.shift_id ?? '',
    channel: body.channel ?? 'DINE_IN',
    station: body.station ?? 'Kitchen',
    menu_items: body.menu_items || 'Menu Test',
    status: body.status || 'COMPLETED',
    queued_at: body.queued_at || now,
    started_at: body.started_at || now,
    ready_at: body.ready_at || now,
    completed_at: body.completed_at || now,
    serving_seconds: String(serve),
    target_seconds: String(target),
    sla_status: sla,
    notes: body.notes ?? '',
    created_at: now,
  };
  await appendRows(TABS.kds, [row]);
  await logAudit({
    actorUserId: s.userId,
    actorRole: s.role,
    action: 'create',
    entity: 'kds',
    entityId: id,
    afterValue: JSON.stringify(row),
  }).catch(() => null);
  return ok(row, 201);
});
