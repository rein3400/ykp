import { readTab, TABS } from '@/db/sheets';
import OpsOverviewClient from './ops-overview-client';

export const dynamic = 'force-dynamic';

export default async function OpsOverviewPage() {
  const summaries = await readTab<Record<string, string>>(TABS.summary);
  const latest = summaries.slice(-5).reverse();
  const incidents = await readTab<Record<string, string>>(TABS.incidents);
  const openIncidents = incidents.filter((r) => {
    const s = (r.status || '').toUpperCase();
    return !['RESOLVED', 'CLOSED', 'DONE', 'CANCELLED', 'CANCEL'].includes(s);
  }).length;
  const opening = await readTab<Record<string, string>>(TABS.opening);
  const kds = await readTab<Record<string, string>>(TABS.kds);
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