import { readTab, TABS } from '@/db/sheets';
import { WasteClient } from './waste-client';

export const dynamic = 'force-dynamic';

export default async function WastePage() {
  const rows = await readTab(TABS.waste);
  const outlets = await readTab(TABS.outlets);
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
