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
  if (!can(s.role as Role, 'view', 'category')) return unauthorized('Forbidden');
  const rows = await readTab<Record<string, string>>(TABS.itemCategory);
  return list(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'create', 'category')) return unauthorized('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!body.category_name) return badRequest('category_name is required');

  const id = nextSequentialIdSync('CAT');
  const row: Record<string, string> = {
    category_id: id,
    category_name: body.category_name,
    parent_category_id: body.parent_category_id ?? '',
    active_status: 'active',
    created_at: nowTimestampWib()
  };
  await appendRows(TABS.itemCategory, [row]);
  await logAudit({
    module: 'warehouse', action: 'create', recordType: 'category',
    recordId: id, afterValue: JSON.stringify(row), userId: s.userId
  }).catch(() => null);
  return ok(row, 201);
});
