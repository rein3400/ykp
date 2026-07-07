import { readTab, TABS } from '@/db/sheets';
import { formatIdr } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function LatenessPage() {
  const rows = await readTab<{
    lateness_id: string;
    date: string;
    employee_id: string;
    employee_name: string;
    late_minutes: string;
    tolerance_minutes: string;
    payable_late_minutes: string;
    penalty_amount: string;
    approval_status: string;
  }>(TABS.lateness);

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Keterlambatan</h1>
        <p className='text-sm text-muted-foreground'>Rekap telat otomatis dari absensi.</p>
      </div>
      <div className='card'>
        {rows.length === 0 ? (
          <div className='text-sm text-muted-foreground'>
            Belum ada baris keterlambatan. Generate via absensi LATE atau dari summary.
          </div>
        ) : (
          <table className='w-full text-sm'>
            <thead className='text-left text-xs text-muted-foreground'>
              <tr>
                <th className='py-2'>Tanggal</th>
                <th>Karyawan</th>
                <th>Telat (m)</th>
                <th>Toleransi (m)</th>
                <th>Payable (m)</th>
                <th>Denda</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.lateness_id} className='border-t border-border'>
                  <td className='py-1 font-mono text-xs'>{r.date}</td>
                  <td>{r.employee_name || r.employee_id}</td>
                  <td>{r.late_minutes}</td>
                  <td>{r.tolerance_minutes}</td>
                  <td>{r.payable_late_minutes}</td>
                  <td>{formatIdr(r.penalty_amount)}</td>
                  <td><span className='badge-yellow'>{r.approval_status || 'PENDING'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
