/**
 * finance_action_tracker — GET with filters (Revisi #22).
 * Public GET for the owner hub / Hermez layer (middleware allowlists GET on
 * /api/finance/actions*). Without a session the full unscoped list is
 * returned; with a session, RBAC + brand/outlet scoping apply as before.
 * Mutations stay session-protected.
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { list, handler, forbidden } from '@/lib/http';
import { can, scopeFilter, type Role } from '@/lib/rbac';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (s && !can(s.role as Role, 'view', 'action')) return forbidden('Forbidden');

  const q = req.nextUrl.searchParams;
  const scope = s
    ? scopeFilter(s.role as Role, s.brandId, s.outletId)
    : { brandId: undefined, outletId: undefined };
  const status = (q.get('status') ?? '').toUpperCase();
  const date = q.get('date') ?? '';

  let rows = await readTab<Record<string, string>>(TABS.actionTracker);
  rows = rows.filter((r) =>
    (!status || (r.status ?? '').toUpperCase() === status)
    && (!date || (r.created_at ?? '').startsWith(date))
    && (!scope.brandId || r.brand_id === scope.brandId)
    && (!scope.outletId || r.outlet_id === scope.outletId)
  );
  rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return list(rows);
});
