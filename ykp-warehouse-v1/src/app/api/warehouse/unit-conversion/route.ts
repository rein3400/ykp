import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertItem } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'unit_conversion')) return unauthorized('Forbidden');
  const rows = await readTab<Record<string, string>>(TABS.unitConversion);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'unit_conversion')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.item_id) return badRequest('item_id is required');
  if (!body.from_unit || !body.to_unit) return badRequest('from_unit and to_unit are required');
  if (!body.conversion_factor || Number(body.conversion_factor) <= 0) {
    return badRequest('conversion_factor must be > 0');
  }

  try {
    await assertItem(body.item_id);
  } catch (e) {
    if (e instanceof MissingRefError) return badRequest(e.message);
    throw e;
  }

  const id = nextSequentialIdSync('CNV');
  const row: Record<string, string> = {
    conversion_id: id,
    item_id: body.item_id,
    from_unit: body.from_unit,
    to_unit: body.to_unit,
    conversion_factor: body.conversion_factor,
    active_status: 'active',
    created_at: nowTimestampWib()
  };
  await appendRows(TABS.unitConversion, [row]);
  await logAudit({
    module: 'warehouse', action: 'create', recordType: 'unit_conversion',
    recordId: id, afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
