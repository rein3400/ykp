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
    <div className='mx-auto w-full min-w-0 max-w-5xl space-y-6'>
      <div className='py-2'>
        <p className='mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500'>Operasional / Pembukaan outlet</p>
        <h1 className='text-3xl font-semibold tracking-tight text-slate-900'>Opening Checklist</h1>
        <p className='mt-2 max-w-xl text-sm leading-6 text-slate-500'>Mulai hari dengan siap. Periksa setiap tugas sesuai SOP, lengkapi bukti, lalu simpan laporan pembukaan.</p>
      </div>
      <OpeningClient templates={templates} outlets={outlets} shifts={shifts} rows={rows} />
    </div>
  );
}
