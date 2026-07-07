import { readTab, TABS } from '@/db/sheets';
import { formatIdr } from '@/lib/format';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Payroll {
  payroll_id: string;
  payroll_period: string;
  employee_id: string;
  employee_name: string;
  basic_salary: string;
  attendance_deduction: string;
  overtime_pay: string;
  bonus_total: string;
  allowance_total: string;
  cash_advance_deduction: string;
  penalty_total: string;
  gross_salary: string;
  net_salary: string;
  calculation_status: string;
  approval_status: string;
  payment_status: string;
}

export default async function PayrollPage() {
  const payrolls = await readTab<Payroll>(TABS.payroll);
  const byPeriod = new Map<string, Payroll[]>();
  for (const p of payrolls) {
    const list = byPeriod.get(p.payroll_period) ?? [];
    list.push(p);
    byPeriod.set(p.payroll_period, list);
  }
  const periods = Array.from(byPeriod.keys()).sort().reverse();

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Payroll</h1>
          <p className='text-sm text-muted-foreground'>Generate, review, approve, mark paid.</p>
        </div>
        <Link href='/hr/payroll/generate' className='btn-primary'>Generate Payroll</Link>
      </div>

      {periods.length === 0 && (
        <div className='card py-8 text-center text-sm text-muted-foreground'>
          Belum ada payroll. Generate lewat tombol di atas.
        </div>
      )}

      {periods.map((p) => {
        const rows = byPeriod.get(p)!;
        const totalNet = rows.reduce((s, r) => s + Number(r.net_salary || 0), 0);
        return (
          <div key={p} className='card space-y-2'>
            <div className='flex items-center justify-between'>
              <h2 className='font-semibold'>Periode {p}</h2>
              <div className='text-sm'>Total Net: <span className='font-semibold'>{formatIdr(totalNet)}</span></div>
            </div>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead className='text-left text-xs text-muted-foreground'>
                  <tr>
                    <th className='py-2'>Employee</th>
                    <th>Pokok</th>
                    <th>Lembur</th>
                    <th>Bonus</th>
                    <th>Potongan Hadir</th>
                    <th>Penalty</th>
                    <th>Kasbon</th>
                    <th>Gross</th>
                    <th>Net</th>
                    <th>Approval</th>
                    <th>Bayar</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.payroll_id} className='border-t border-border'>
                      <td className='py-1'>{r.employee_name || r.employee_id}</td>
                      <td>{formatIdr(r.basic_salary)}</td>
                      <td>{formatIdr(r.overtime_pay)}</td>
                      <td>{formatIdr(r.bonus_total)}</td>
                      <td className='text-red-700'>{formatIdr(r.attendance_deduction)}</td>
                      <td className='text-red-700'>{formatIdr(r.penalty_total)}</td>
                      <td className='text-red-700'>{formatIdr(r.cash_advance_deduction)}</td>
                      <td>{formatIdr(r.gross_salary)}</td>
                      <td className='font-semibold'>{formatIdr(r.net_salary)}</td>
                      <td>
                        <span className={
                          r.approval_status === 'APPROVED' ? 'badge-green' :
                          r.approval_status === 'REJECTED' ? 'badge-red' :
                          r.approval_status === 'PENDING' ? 'badge-yellow' : 'badge-gray'
                        }>{r.approval_status || r.calculation_status || 'DRAFT'}</span>
                      </td>
                      <td>
                        <span className={
                          r.payment_status === 'PAID' ? 'badge-green' :
                          r.payment_status === 'FAILED' ? 'badge-red' :
                          r.payment_status === 'READY_TO_PAY' ? 'badge-yellow' : 'badge-gray'
                        }>{r.payment_status || 'UNPAID'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}