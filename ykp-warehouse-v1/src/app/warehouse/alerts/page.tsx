import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { can, type Role } from '@/lib/rbac';
import AlertsClient from './alerts-client';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const alerts = await readTab<Record<string, string>>(TABS.alertLog);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Alerts</h1>
        <p className='text-sm text-muted-foreground'>14 alert types per brief §19. HIGH/CRITICAL → auto action.</p>
      </div>
      <AlertsClient alerts={alerts} canUpdate={can(session.role as Role, 'update', 'alert')} />
    </div>
  );
}
