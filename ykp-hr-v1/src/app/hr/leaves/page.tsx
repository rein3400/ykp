import { readTab, TABS } from '@/db/sheets';
import { LeaveForm } from '@/features/hr/components/leave-form';
import { LeavesTable } from '@/features/hr/components/leaves-table';

export const dynamic = 'force-dynamic';

interface Leave {
  leave_id: string;
  employee_id: string;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: string;
  reason: string;
  approval_status: string;
  approved_by: string;
  submitted_at: string;
}

export default async function LeavesPage() {
  const [employees, leaves] = await Promise.all([
    readTab<{ employee_id: string; full_name: string; active_status: string }>(TABS.employees),
    readTab<Leave>(TABS.leaves)
  ]);
  const activeEmployees = employees
    .filter((e) => e.active_status === 'active' || e.active_status === '1')
    .map((e) => ({ id: e.employee_id, name: e.full_name }));

  return (
    <div className='space-y-4'>
      <div className='grid gap-4 lg:grid-cols-3'>
        <div className='card lg:col-span-1'>
          <h2 className='mb-2 font-semibold'>Ajukan Izin / Cuti</h2>
          <LeaveForm employees={activeEmployees} />
        </div>
        <div className='card lg:col-span-2'>
          <h2 className='mb-2 font-semibold'>Daftar Pengajuan</h2>
          <LeavesTable data={leaves} />
        </div>
      </div>
    </div>
  );
}
