import { redirect } from 'next/navigation';
import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ensureDailySummary } from '@/lib/ops-summary';
import OpsOverviewClient from './ops-overview-client';
import { ScopeNotice } from '@/components/scope-notice';

export const dynamic = 'force-dynamic';

const OUTLET_SCOPED = ['brand_manager', 'outlet_manager', 'supervisor', 'kitchen_lead', 'staff'];

export default async function OpsOverviewPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const scoped = OUTLET_SCOPED.includes(session.role);
  const scope = {
    brandId: scoped ? session.brandId || undefined : undefined,
    outletId: scoped ? session.outletId || undefined : undefined,
  };
  const outlets = await readTab<Record<string, string>>(TABS.outlets);
  const activeIds = new Set(outlets.filter((row) => ['active', '1'].includes((row.status ?? '').trim().toLowerCase())).map((row) => row.outlet_id));
  const operational = (rows: Record<string, string>[]) =>
    rows.filter(
      (row) =>
        !row.outlet_id ||
        (activeIds.has(row.outlet_id) &&
          (!scope.brandId || row.brand_id === scope.brandId) &&
          (!scope.outletId || row.outlet_id === scope.outletId)),
    );
  const summaries = operational(await ensureDailySummary(scope));
  const latest = summaries.slice(-5).reverse();
  const incidents = operational(await readTab<Record<string, string>>(TABS.incidents));
  const openIncidents = incidents.filter((r) => {
    const s = (r.status || '').toUpperCase();
    return !['RESOLVED', 'CLOSED', 'DONE', 'CANCELLED', 'CANCEL'].includes(s);
  }).length;
  const opening = operational(await readTab<Record<string, string>>(TABS.opening));
  const kds = operational(await readTab<Record<string, string>>(TABS.kds));
  const overSla = kds.filter((r) => r.sla_status === 'OVER_SLA' || r.sla_status === 'CRITICAL_DELAY').length;

  return (
    <>
      <ScopeNotice role={session.role} outletId={session.outletId} />
      <OpsOverviewClient
        initialSummaries={latest as never}
        initialKpi={{
          summaryRows: summaries.length,
          openIncidents,
          overSla,
          openingItems: opening.length,
        }}
      />
    </>
  );
}