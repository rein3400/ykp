import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import AlertsClient from './alerts-client';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const alerts = await readTab<Record<string, string>>(TABS.alertLog);
  return <AlertsClient alerts={alerts} role={session.role} />;
}
