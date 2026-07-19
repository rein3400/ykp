import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import AlertsClient from './alerts-client';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [alerts, outlets] = await Promise.all([
    readTab<Record<string, string>>(TABS.alertLog),
    readTab<Record<string, string>>(TABS.outlets)
  ]);
  const sorted = [...alerts].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Alert Log</h1>
        <p className='text-sm text-muted-foreground'>Alert operasional dari rules engine (ops_alert_log).</p>
      </div>
      <AlertsClient alerts={sorted} outlets={outlets} />
    </div>
  );
}
