import { readTab, TABS } from '@/db/sheets';
import { BriefingClient } from './briefing-client';

export const dynamic = 'force-dynamic';

export default async function BriefingPage() {
  const rows = await readTab(TABS.briefing);
  const shifts = await readTab(TABS.shifts);
  const outlets = await readTab(TABS.outlets);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Briefing & Shift Board</h1>
        <p className='text-sm text-slate-500'>Briefing harian + roster shift outlet.</p>
      </div>
      <BriefingClient rows={rows} shifts={shifts} outlets={outlets} />
    </div>
  );
}
