/**
 * GET /api/finance/payroll-overview?period=YYYY-MM&brand_id=&outlet_id=
 * Read-only view over HR V1 payroll (beban gaji per cabang + total harus dibayar).
 */
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, handler, forbidden } from '@/lib/http';
import { can, scopeFilter, type Role } from '@/lib/rbac';
import { readHrPayroll } from '@/lib/hr-payroll-bridge';
import { aggregatePayroll } from '@/lib/payroll-overview';
import { readTab, TABS } from '@/db/sheets';

export const GET = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'summary')) return forbidden('Forbidden');

  const q = req.nextUrl.searchParams;
  const scope = scopeFilter(s.role as Role, s.brandId, s.outletId);
  const period = (q.get('period') ?? '').trim();
  if (period && !/^\d{4}-\d{2}$/.test(period)) return badRequest('period harus format YYYY-MM');

  const [rows, brands] = await Promise.all([
    readHrPayroll(),
    readTab<Record<string, string>>(TABS.brands)
  ]);

  const brandNames: Record<string, string> = {};
  for (const b of brands) if (b.brand_id) brandNames[b.brand_id] = b.brand_name ?? '';

  const outletId = scope.outletId ?? q.get('outlet_id') ?? '';
  const brandId = scope.brandId ?? q.get('brand_id') ?? '';
  const overview = aggregatePayroll(rows, brandNames, period, { brandId, outletId });
  const periods = [...new Set(rows.map((r) => r.payroll_period).filter(Boolean))].sort().reverse();

  return ok({ ...overview, periods });
});