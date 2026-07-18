import { readTab, TABS } from '@/db/sheets';
import { OpeningClient } from './opening-client';

export const dynamic = 'force-dynamic';

export default async function OpeningPage() {
  const templates = await readTab(TABS.checklistTemplates);
  const outlets = await readTab(TABS.outlets);
  const shifts = await readTab(TABS.shifts);
  const rows = await readTab(TABS.opening);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Opening Checklist</h1>
        <p className='text-sm text-slate-500'>Cek kesiapan outlet sebelum buka.</p>
      </div>
      <OpeningClient templates={templates} outlets={outlets} shifts={shifts} rows={rows} />
    </div>
  );
}
