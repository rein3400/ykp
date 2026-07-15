import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertBrand, assertOutlet } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';

const LOCATION_TYPES = [
  'CENTRAL_WAREHOUSE', 'OUTLET_WAREHOUSE', 'KITCHEN', 'BAR',
  'CHILLER', 'FREEZER', 'DRY_STORAGE', 'OTHER'
];

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'location')) return unauthorized('Forbidden');
  const rows = await readTab<Record<string, string>>(TABS.locations);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'location')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.location_name) return badRequest('location_name is required');
  if (!body.location_type || !LOCATION_TYPES.includes(body.location_type)) {
    return badRequest(`location_type must be one of: ${LOCATION_TYPES.join(', ')}`);
  }

  try {
    if (body.brand_id) await assertBrand(body.brand_id);
    if (body.outlet_id) await assertOutlet(body.outlet_id);
  } catch (e) {
    if (e instanceof MissingRefError) return badRequest(e.message);
    throw e;
  }

  const id = nextSequentialIdSync('LOC');
  const now = nowTimestampWib();
  const row: Record<string, string> = {
    location_id: id,
    location_code: body.location_code || id,
    location_name: body.location_name,
    brand_id: body.brand_id ?? '',
    outlet_id: body.outlet_id ?? '',
    location_type: body.location_type,
    parent_location_id: body.parent_location_id ?? '',
    address: body.address ?? '',
    active_status: 'active',
    created_at: now,
    updated_at: now
  };
  await appendRows(TABS.locations, [row]);
  await logAudit({
    module: 'warehouse', action: 'create', recordType: 'location',
    recordId: id, afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
