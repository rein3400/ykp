import { readTab, TABS } from '@/db/sheets';
import { ClosingClient } from './closing-client';
import { todayWib } from '@/lib/format';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ClosingPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const inScope = (row: Record<string, string>) => (!session.outletId || row.outlet_id === session.outletId) && (!session.brandId || row.brand_id === session.brandId);
  const rows = (await readTab(TABS.closing)).filter(inScope);
  const outlets = (await readTab(TABS.outlets)).filter((outlet) => inScope(outlet) && ['active', '1'].includes((outlet.status ?? '').trim().toLowerCase()));
  const outletIds = new Set(outlets.map((outlet) => outlet.outlet_id));
  const brandIds = new Set(outlets.map((outlet) => outlet.brand_id));
  const templates = (await readTab(TABS.checklistTemplates)).filter((template) => (!template.outlet_id || outletIds.has(template.outlet_id)) && (!template.brand_id || brandIds.has(template.brand_id)));
  const shifts = await readTab(TABS.shifts);
  return (
    <div className='mx-auto w-full min-w-0 max-w-5xl space-y-6'>
      <div className='py-2'>
        <p className='mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500'>Operasional / Penutupan outlet</p>
        <h1 className='text-3xl font-semibold tracking-tight text-slate-900'>Closing Checklist</h1>
        <p className='mt-2 max-w-xl text-sm leading-6 text-slate-500'>Tutup hari dengan tertib. Periksa setiap tugas sesuai SOP, lengkapi catatan, lalu simpan laporan penutupan.</p>
      </div>
      <ClosingClient rows={rows} outlets={outlets} templates={templates} shifts={shifts} date={todayWib()} />
    </div>
  );
}
