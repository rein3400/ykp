import { readTab, TABS } from '@/db/sheets';
import { AdjustmentForm } from '@/features/hr/components/adjustment-form';
import { AdjustmentsTable } from '@/features/hr/components/adjustments-table';

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
          <AdjustmentsTable data={adj} />
        </div>
      </div>
    </div>
  );
}
