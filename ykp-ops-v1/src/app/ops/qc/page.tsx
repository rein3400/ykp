import { readTab, TABS } from '@/db/sheets';
import { QcClient } from './qc-client';
import { getSession } from '@/lib/session';
import { operationalOutletScope } from '@/lib/operational-outlets';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function QcPage() {
  const rows = await readTab(TABS.qc);
  const products = await readTab(TABS.products);
  const session = await getSession();
  if (!session) redirect('/login');
  const outlets = operationalOutletScope(await readTab(TABS.outlets), session);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Visual QC Scoring</h1>
        <p className='text-sm text-slate-500'>Score manual. AI vision = second opinion only (V1.1).</p>
      </div>
      <QcClient rows={rows} products={products} outlets={outlets} />
    </div>
  );
}
