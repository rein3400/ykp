import { readTab, TABS } from '@/db/sheets';
import { OpeningClient } from './opening-client';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OpeningPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const inScope = (row: Record<string, string>) => (!session.outletId || row.outlet_id === session.outletId) && (!session.brandId || row.brand_id === session.brandId);
  const outlets = (await readTab(TABS.outlets)).filter((row) => inScope(row) && ['active', '1'].includes((row.status ?? '').trim().toLowerCase()));
  const outletIds = new Set(outlets.map((row) => row.outlet_id));
  const brandIds = new Set(outlets.map((row) => row.brand_id));
  const templates = (await readTab(TABS.checklistTemplates)).filter((row) => (!row.outlet_id || outletIds.has(row.outlet_id)) && (!row.brand_id || brandIds.has(row.brand_id)));
  const shifts = await readTab(TABS.shifts);
  const rows = (await readTab(TABS.opening)).filter(inScope);
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
