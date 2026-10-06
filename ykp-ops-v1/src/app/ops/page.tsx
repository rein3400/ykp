import { readTab, TABS } from '@/db/sheets';
import OpsOverviewClient from './ops-overview-client';

export const dynamic = 'force-dynamic';

export default async function OpsOverviewPage() {
  const outlets = await readTab<Record<string, string>>(TABS.outlets);
  const activeIds = new Set(outlets.filter((row) => ['active', '1'].includes((row.status ?? '').trim().toLowerCase())).map((row) => row.outlet_id));
  const operational = (rows: Record<string, string>[]) => rows.filter((row) => !row.outlet_id || activeIds.has(row.outlet_id));
  const summaries = operational(await readTab<Record<string, string>>(TABS.summary));
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
    <OpsOverviewClient
      initialSummaries={latest as never}
      initialKpi={{
        summaryRows: summaries.length,
        openIncidents,
        overSla,
        openingItems: opening.length,
      }}
    />
  );
}