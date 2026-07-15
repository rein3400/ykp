import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { formatIdr } from '@/lib/format';
import SummaryClient from './summary-client';

export const dynamic = 'force-dynamic';

export default async function SummaryPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const summaries = await readTab<Record<string, string>>(TABS.dailySummary);
  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Warehouse Daily Summary</h1>
          <p className='text-sm text-muted-foreground'>Ringkasan harian untuk Hermez & owner.</p>
        </div>
      </div>
      <SummaryClient summaries={summaries} />
    </div>
  );
}