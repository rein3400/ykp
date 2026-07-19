import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import SummaryClient from './summary-client';

export const dynamic = 'force-dynamic';

export default async function SummaryPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const summaries = await readTab<Record<string, string>>(TABS.dailySummary);
  const sorted = [...summaries].sort((a, b) => (b.date + b.outlet_id).localeCompare(a.date + a.outlet_id));
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Operational Daily Summary</h1>
        <p className='text-sm text-muted-foreground'>
          ops_daily_summary per (tanggal, outlet) ΓÇö siap dibaca Orchestration Layer & Hermez.
        </p>
      </div>
      <SummaryClient summaries={sorted} />
    </div>
  );
}
