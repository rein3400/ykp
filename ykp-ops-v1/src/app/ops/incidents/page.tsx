import { readTab, TABS } from '@/db/sheets';
import { IncidentsClient } from './incidents-client';
import { getSession } from '@/lib/session';
import { operationalOutletScope } from '@/lib/operational-outlets';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function IncidentsPage() {
  const rows = await readTab(TABS.incidents);
  const session = await getSession();
  if (!session) redirect('/login');
  const outlets = operationalOutletScope(await readTab(TABS.outlets), session);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Incident & Complaint</h1>
        <p className='text-sm text-slate-500'>Catat insiden operasional + komplain customer.</p>
      </div>
      <IncidentsClient rows={rows} outlets={outlets} />
    </div>
  );
}
