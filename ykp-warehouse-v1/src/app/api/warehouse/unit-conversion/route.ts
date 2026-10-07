import { NextRequest } from 'next/server';
import { readTab, appendRows, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, list, unauthorized, badRequest, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { nextSequentialIdSync, MissingRefError, assertItem } from '@/lib/repo';
import { can, type Role } from '@/lib/rbac';
import { normalizeUnit, validateConversionFactor } from '@/lib/unit-conversion';

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
  if (typeof body.from_unit !== 'string' || typeof body.to_unit !== 'string' || !body.from_unit.trim() || !body.to_unit.trim()) return badRequest('Satuan wajib diisi');
  let factor: number;
  try {
    factor = validateConversionFactor(body.from_unit, body.to_unit, body.conversion_factor);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Faktor konversi tidak valid');
  }
  const fromUnit = normalizeUnit(body.from_unit);
  const toUnit = normalizeUnit(body.to_unit);
  const existing = await readTab<Record<string, string>>(TABS.unitConversion);
  if (existing.some((row) => row.item_id === body.item_id && row.active_status === 'active' && normalizeUnit(row.from_unit ?? '') === fromUnit && normalizeUnit(row.to_unit ?? '') === toUnit)) {
    return badRequest('Konversi aktif untuk item dan pasangan satuan ini sudah ada');
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
    from_unit: fromUnit,
    to_unit: toUnit,
    conversion_factor: String(factor),
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
