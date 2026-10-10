import { readTab, TABS } from '@/db/sheets';
import { ChecklistClient } from './checklist-client';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ChecklistPage() {
  const [templates, outlets, shifts, submissions] = await Promise.all([
    readTab(TABS.checklistTemplates),
    readTab(TABS.outlets),
    readTab(TABS.shifts),
    readTab(TABS.checklistSubmissions),
  ]);
  const session = await getSession();
  if (!session) redirect('/login');
  const inScope = (row: Record<string, string>) => (!session.outletId || row.outlet_id === session.outletId) && (!session.brandId || row.brand_id === session.brandId);
  const activeOutlets = outlets.filter((row) => inScope(row) && ['active', '1'].includes((row.status ?? '').trim().toLowerCase()));
  const outletIds = new Set(activeOutlets.map((row) => row.outlet_id));
  const brandIds = new Set(activeOutlets.map((row) => row.brand_id));
  const scopedTemplates = templates.filter((row) => (!row.outlet_id || outletIds.has(row.outlet_id)) && (!row.brand_id || brandIds.has(row.brand_id)));
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Checklist Operasional</h1>
        <p className='text-sm text-slate-500'>
          Isi manual per item SOP dan verifikasi per tanggal/outlet/shift.
        </p>
      </div>
      <ChecklistClient templates={scopedTemplates} outlets={activeOutlets} shifts={shifts} submissions={submissions.filter(inScope)} />
    </div>
  );
}
