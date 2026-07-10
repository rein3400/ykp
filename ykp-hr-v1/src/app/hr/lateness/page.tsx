import { readTab, TABS } from '@/db/sheets';
import { formatIdr } from '@/lib/format';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';

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
        <p className='text-sm text-muted-foreground'>Rekap telat otomatis dari absensi.</p>
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

      <div className='card'>
        <h2 className='mb-3 font-semibold'>Daftar Keterlambatan</h2>
        <DataTable
          data={rows}
          rowKey={(r) => r.lateness_id}
          empty='Belum ada baris keterlambatan. Generate via absensi LATE atau dari summary.'
          columns={[
            { key: 'date', header: 'Tanggal', render: (r) => <span className='font-mono text-xs'>{r.date}</span> },
            { key: 'employee', header: 'Karyawan', render: (r) => r.employee_name || r.employee_id },
            { key: 'late', header: 'Telat (m)', align: 'right', render: (r) => r.late_minutes || '0' },
            { key: 'tol', header: 'Toleransi (m)', align: 'right', render: (r) => r.tolerance_minutes || '0' },
            { key: 'pay', header: 'Payable (m)', align: 'right', render: (r) => r.payable_late_minutes || '0' },
            { key: 'pen', header: 'Denda', align: 'right', render: (r) => formatIdr(r.penalty_amount || '0') },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.approval_status || 'PENDING'} /> }
          ]}
        />
      </div>
    </div>
  );
}