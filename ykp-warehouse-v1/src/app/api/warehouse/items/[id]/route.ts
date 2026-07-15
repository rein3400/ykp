import { NextRequest } from 'next/server';
import { findRow, updateRow, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, notFound, handler } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { nowTimestampWib } from '@/lib/format';
import { can, type Role } from '@/lib/rbac';

export const PUT = handler(async (req: NextRequest, { params }) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'update', 'item')) return unauthorized('Forbidden');
  const id = params.id;
  const found = await findRow(TABS.items, 'item_id', id);
  if (!found) return notFound('Item not found');
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  // Never allow hard-overwrite of PK or created_by/created_at
  const { item_id: _i, created_at: _c, created_by: _b, ...safe } = body;
  const updated = {
    ...found.row,
    ...safe,
    item_id: id,
    updated_at: nowTimestampWib(),
    updated_by: s.userId
  };
  await updateRow(TABS.items, found.rowNumber, updated);
  await logAudit({
    module: 'warehouse',
    action: 'update',
    recordType: 'item',
    recordId: id,
    beforeValue: JSON.stringify(found.row),
    afterValue: JSON.stringify(updated),
    userId: s.userId
  }).catch(() => null);
  return ok(updated);
});
