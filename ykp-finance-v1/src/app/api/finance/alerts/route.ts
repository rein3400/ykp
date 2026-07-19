/**
 * finance_alert_log — GET with filters.
 * Public GET for the owner hub / Hermez layer (middleware allowlists GET on
 * /api/finance/alerts*). Without a session the full unscoped list is returned;
 * with a session, RBAC + brand/outlet scoping apply as before.
 * Mutations (PATCH on [id]) stay session-protected.
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { list, handler, forbidden } from '@/lib/http';
import { can, scopeFilter, type Role } from '@/lib/rbac';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (s && !can(s.role as Role, 'view', 'alert')) return forbidden('Forbidden');

  const q = req.nextUrl.searchParams;
  const scope = s
    ? scopeFilter(s.role as Role, s.brandId, s.outletId)
    : { brandId: undefined, outletId: undefined };
  const date = q.get('date') ?? '';
  const severity = (q.get('severity') ?? '').toUpperCase();
  const status = (q.get('status') ?? '').toUpperCase();

  let rows = await readTab<Record<string, string>>(TABS.alertLog);
  rows = rows.filter((r) =>
    (!date || r.date === date)
    && (!severity || (r.severity ?? '').toUpperCase() === severity)
    && (!status || (r.status ?? '').toUpperCase() === status)
    && (!scope.brandId || r.brand_id === scope.brandId)
    && (!scope.outletId || r.outlet_id === scope.outletId)
  );
  rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return list(rows);
});
