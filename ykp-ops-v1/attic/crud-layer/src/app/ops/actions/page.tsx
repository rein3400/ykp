import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { todayWib } from '@/lib/format';
import ActionsClient from './actions-client';

export const dynamic = 'force-dynamic';

export default async function ActionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [actions, outlets] = await Promise.all([
    readTab<Record<string, string>>(TABS.actionTracker),
    readTab<Record<string, string>>(TABS.outlets)
  ]);
  const sorted = [...actions].sort((a, b) => a.due_date.localeCompare(b.due_date) || b.created_at.localeCompare(a.created_at));
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Action Tracker</h1>
        <p className='text-sm text-muted-foreground'>Semua masalah punya PIC, deadline, dan status penyelesaian.</p>
      </div>
      <ActionsClient actions={sorted} outlets={outlets} today={todayWib()} />
    </div>
  );
}
