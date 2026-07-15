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
  if (!can(s.role as Role, 'view', 'supplier')) return unauthorized('Forbidden');
  const rows = await readTab<Record<string, string>>(TABS.suppliers);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'supplier')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.supplier_name) return badRequest('supplier_name is required');

  const id = nextSequentialIdSync('SUP');
  const now = nowTimestampWib();
  const row: Record<string, string> = {
    supplier_id: id,
    supplier_code: body.supplier_code || id,
    supplier_name: body.supplier_name,
    item_category: body.item_category ?? '',
    phone: body.phone ?? '',
    email: body.email ?? '',
    address: body.address ?? '',
    bank_name: body.bank_name ?? '',
    bank_account: body.bank_account ?? '',
    account_holder: body.account_holder ?? '',
    lead_time_days: body.lead_time_days ?? '1',
    minimum_order_value: body.minimum_order_value ?? '0',
    preferred_delivery_day: body.preferred_delivery_day ?? '',
    active_status: 'active',
    created_at: now,
    updated_at: now
  };
  await appendRows(TABS.suppliers, [row]);
  await logAudit({
    module: 'warehouse', action: 'create', recordType: 'supplier',
    recordId: id, afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
