import { readTab, TABS } from '@/db/sheets';
import { formatIdr } from '@/lib/format';
import { LatenessTable } from '@/features/hr/components/lateness-table';

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
  reason: string;
  approval_status: string;
  approved_by: string;
}

export default async function LatenessPage() {
  let rows: Lateness[] = [];
  let fetchError: string | null = null;

  try {
    rows = await readTab<Lateness>(TABS.lateness);
  } catch (e) {
    // Sheets API can transiently fail (429 / 5xx). Render a recoverable state
    // instead of crashing SSR (previously produced intermittent 500s).
    fetchError = e instanceof Error ? e.message : 'Gagal memuat data';
  }

  const totalPenalty = rows.reduce((s, r) => s + Number(r.penalty_amount || 0), 0);
  const totalMinutes = rows.reduce((s, r) => s + Number(r.payable_late_minutes || 0), 0);

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Keterlambatan</h1>
        <p className='text-sm text-muted-foreground'>Rekap telat otomatis dari absensi. Approve denda sebelum masuk payroll.</p>
      </div>

      {fetchError && (
        <div className='rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900'>
          <strong>Data tidak dapat dimuat:</strong> {fetchError}. Coba refresh halaman.
        </div>
      )}

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

      <div className='card'>
        <h2 className='mb-3 font-semibold'>Daftar Keterlambatan</h2>
        <LatenessTable data={rows} />
      </div>
    </div>
  );
}
