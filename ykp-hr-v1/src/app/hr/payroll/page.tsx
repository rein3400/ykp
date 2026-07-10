import { readTab, TABS } from '@/db/sheets';
import { formatIdr } from '@/lib/format';
import Link from 'next/link';
import { PayrollTable } from '@/features/hr/components/payroll-table';

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
            <PayrollTable data={rows} />
          </div>
        );
      })}
    </div>
  );
}
