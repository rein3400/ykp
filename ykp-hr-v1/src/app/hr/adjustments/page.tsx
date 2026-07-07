import { readTab, TABS } from '@/db/sheets';
import { formatIdr, todayWib } from '@/lib/format';
import { AdjustmentForm } from '@/features/hr/components/adjustment-form';

export const dynamic = 'force-dynamic';

interface Adj {
  adjustment_id: string;
  date: string;
  employee_id: string;
  employee_name: string;
  adjustment_type: string;
  category: string;
  amount: string;
  reason: string;
  approval_status: string;
  payroll_period: string;
}

export default async function AdjustmentsPage() {
  const [employees, adj] = await Promise.all([
    readTab<{ employee_id: string; full_name: string; active_status: string }>(TABS.employees),
    readTab<Adj>(TABS.adjustments)
  ]);
  const activeEmployees = employees
    .filter((e) => e.active_status === 'active' || e.active_status === '1')
    .map((e) => ({ id: e.employee_id, name: e.full_name }));

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Bonus, Potongan, Lembur, Kasbon</h1>
        <p className='text-sm text-muted-foreground'>Adjustment terintegrasi ke payroll periode terkait.</p>
      </div>
      <div className='grid gap-4 lg:grid-cols-3'>
        <div className='card'>
          <h2 className='mb-2 font-semibold'>Tambah Adjustment</h2>
          <AdjustmentForm employees={activeEmployees} />
        </div>
        <div className='card lg:col-span-2'>
          <h2 className='mb-2 font-semibold'>Daftar</h2>
          {adj.length === 0 ? (
            <div className='text-sm text-muted-foreground'>Belum ada.</div>
          ) : (
            <table className='w-full text-sm'>
              <thead className='text-left text-xs text-muted-foreground'>
                <tr>
                  <th className='py-2'>Tanggal</th>
                  <th>Karyawan</th>
                  <th>Tipe</th>
                  <th>Amount</th>
                  <th>Alasan</th>
                  <th>Periode</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {adj.map((a) => (
                  <tr key={a.adjustment_id} className='border-t border-border'>
                    <td className='py-1 font-mono text-xs'>{a.date}</td>
                    <td>{a.employee_name || a.employee_id}</td>
                    <td>{a.adjustment_type}</td>
                    <td>{formatIdr(a.amount)}</td>
                    <td className='max-w-xs truncate'>{a.reason}</td>
                    <td className='font-mono text-xs'>{a.payroll_period}</td>
                    <td>
                      <span className={
                        a.approval_status === 'APPROVED' ? 'badge-green' :
                        a.approval_status === 'REJECTED' ? 'badge-red' :
                        a.approval_status === 'PENDING' ? 'badge-yellow' : 'badge-gray'
                      }>{a.approval_status || 'DRAFT'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}