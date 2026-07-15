import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import AlertsClient from './alerts-client';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [alerts, items] = await Promise.all([
    readTab<Record<string, string>>(TABS.alertLog),
    readTab<Record<string, string>>(TABS.items)
  ]);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Alerts</h1>
        <p className='text-sm text-muted-foreground'>14 alert types per brief §19. HIGH/CRITICAL → auto action.</p>
      </div>
      <AlertsClient alerts={alerts} items={items} />
    </div>
  );
}
