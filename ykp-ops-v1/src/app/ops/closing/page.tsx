import { readTab, TABS } from '@/db/sheets';
import { ClosingClient } from './closing-client';

export const dynamic = 'force-dynamic';

export default async function ClosingPage() {
  const rows = await readTab(TABS.closing);
  const outlets = await readTab(TABS.outlets);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Closing Reconciliation</h1>
        <p className='text-sm text-slate-500'>Rekonsiliasi kas + checklist tutup outlet.</p>
      </div>
      <ClosingClient rows={rows} outlets={outlets} />
    </div>
  );
}
