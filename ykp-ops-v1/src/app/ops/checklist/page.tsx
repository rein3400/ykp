import { readTab, TABS } from '@/db/sheets';
import { ChecklistClient } from './checklist-client';

export const dynamic = 'force-dynamic';

export default async function ChecklistPage() {
  const [templates, outlets, shifts, submissions] = await Promise.all([
    readTab(TABS.checklistTemplates),
    readTab(TABS.outlets),
    readTab(TABS.shifts),
    readTab(TABS.checklistSubmissions),
  ]);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Checklist Operasional</h1>
        <p className='text-sm text-slate-500'>
          Isi manual per item SOP dan verifikasi per tanggal/outlet/shift.
        </p>
      </div>
      <ChecklistClient templates={templates} outlets={outlets} shifts={shifts} submissions={submissions} />
    </div>
  );
}
