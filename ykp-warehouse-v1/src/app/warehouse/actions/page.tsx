import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ActionsClient from './actions-client';

export const dynamic = 'force-dynamic';

export default async function ActionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [actions, items] = await Promise.all([
    readTab<Record<string, string>>(TABS.actionTracker),
    readTab<Record<string, string>>(TABS.items)
  ]);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Action Tracker</h1>
        <p className='text-sm text-muted-foreground'>Auto-created dari HIGH/CRITICAL alerts. PIC + deadline + escalation.</p>
      </div>
      <ActionsClient actions={actions} items={items} />
    </div>
  );
}
