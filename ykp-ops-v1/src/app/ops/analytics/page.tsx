import { readTab, TABS } from '@/db/sheets';
import AnalyticsPageClient from './analytics-client';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const summaries = await readTab(TABS.summary);
  const incidents = await readTab(TABS.incidents);
  const waste = await readTab(TABS.waste);
  const kds = await readTab(TABS.kds);
  return (
    <AnalyticsPageClient
      summaries={summaries}
      incidents={incidents}
      waste={waste}
      kds={kds}
    />
  );
}
