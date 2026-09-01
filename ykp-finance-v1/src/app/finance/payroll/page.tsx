import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { readHrPayroll } from '@/lib/hr-payroll-bridge';
import { aggregatePayroll } from '@/lib/payroll-overview';
import PayrollClient from './payroll-client';

export const dynamic = 'force-dynamic';

export default async function PayrollPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const scope = scopeFor(session.role, session.brandId, session.outletId);

  const [rows, brands] = await Promise.all([
    readHrPayroll(),
    readTab<Record<string, string>>(TABS.brands)
  ]);
  const brandNames: Record<string, string> = {};
  for (const b of brands) if (b.brand_id) brandNames[b.brand_id] = b.brand_name ?? '';

  const periods = [...new Set(rows.map((r) => r.payroll_period).filter(Boolean))].sort().reverse();
  const currentPeriod = periods[0] ?? '';
  const overview = aggregatePayroll(rows, brandNames, currentPeriod, scope);

  return (
    <PayrollClient
      initial={overview}
      periods={periods}
      brands={brands}
      role={session.role}
    />
  );
}

function scopeFor(role: string, brandId?: string, outletId?: string): { brandId?: string; outletId?: string } {
  if (['owner', 'super_admin', 'finance_admin', 'viewer'].includes(role)) return {};
  return { brandId, outletId };
}