import { readTab, TABS } from '@/db/sheets';
import { formatIdr } from '@/lib/format';
import { LatenessClient } from '@/features/hr/components/lateness-client';

export const dynamic = 'force-dynamic';

interface Lateness {
  lateness_id: string;
  date: string;
  employee_id: string;
  employee_name: string;
  late_minutes: string;
  tolerance_minutes: string;
  payable_late_minutes: string;
  penalty_amount: string;
  approval_status: string;
}

export default async function LatenessPage() {
  const rows = await readTab<Lateness>(TABS.lateness);

  const totalPenalty = rows.reduce((s, r) => s + Number(r.penalty_amount || 0), 0);
  const totalMinutes = rows.reduce((s, r) => s + Number(r.payable_late_minutes || 0), 0);

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Keterlambatan</h1>
        <p className='text-sm text-muted-foreground'>Rekap telat otomatis dari absensi + approval denda.</p>
      </div>

      <div className='grid gap-4 sm:grid-cols-3'>
        <div className='card'>
          <div className='text-xs text-muted-foreground'>Total Record</div>
          <div className='mt-1 text-2xl font-bold'>{rows.length}</div>
        </div>
        <div className='card'>
          <div className='text-xs text-muted-foreground'>Total Payable Minutes</div>
          <div className='mt-1 text-2xl font-bold'>{totalMinutes}</div>
        </div>
        <div className='card'>
          <div className='text-xs text-muted-foreground'>Total Penalty</div>
          <div className='mt-1 text-2xl font-bold'>{formatIdr(String(totalPenalty))}</div>
        </div>
      </div>

      <LatenessClient initial={rows} />
    </div>
  );
}
