import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'threshold')) return unauthorized('Forbidden');
  const rows = await readTab<Record<string, string>>(TABS.inventoryThreshold);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'threshold')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.threshold_type) return badRequest('threshold_type is required');
  if (!body.warning_value && !body.high_value && !body.critical_value) {
    return badRequest('at least one of warning/high/critical_value is required');
  }

  const id = nextSequentialIdSync('THR');
  const row: Record<string, string> = {
    threshold_id: id,
    brand_id: body.brand_id ?? '',
    outlet_id: body.outlet_id ?? '',
    location_id: body.location_id ?? '',
    item_id: body.item_id ?? '',
    threshold_type: body.threshold_type,
    warning_value: body.warning_value ?? '',
    high_value: body.high_value ?? '',
    critical_value: body.critical_value ?? '',
    unit: body.unit ?? '',
    active_status: 'active',
    updated_by: s.userId,
    updated_at: nowTimestampWib()
  };
  await appendRows(TABS.inventoryThreshold, [row]);
  await logAudit({
    module: 'warehouse', action: 'create', recordType: 'threshold',
    recordId: id, afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
