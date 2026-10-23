import { readTab, TABS } from '@/db/sheets';
import { WasteClient } from './waste-client';
import { getSession } from '@/lib/session';
import { operationalOutletScope } from '@/lib/operational-outlets';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function WastePage() {
  const rows = await readTab(TABS.waste);
  const session = await getSession();
  if (!session) redirect('/login');
  const outlets = operationalOutletScope(await readTab(TABS.outlets), session);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Waste & Stock Issue</h1>
        <p className='text-sm text-slate-500'>Catat waste, kerusakan, missing stock.</p>
      </div>
      <WasteClient rows={rows} outlets={outlets} />
    </div>
  );
}
