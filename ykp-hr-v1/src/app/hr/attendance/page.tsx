import { readTab, TABS } from '@/db/sheets';
import { todayWib } from '@/lib/format';
import { AttendanceTable } from '@/features/hr/components/attendance-table';

export const dynamic = 'force-dynamic';

export default async function AttendancePage() {
  const [employees, outlets] = await Promise.all([
    readTab<{ employee_id: string; full_name: string; outlet_id: string; active_status: string }>(TABS.employees),
    readTab<{ outlet_id: string; outlet_name: string }>(TABS.outlets)
  ]);

  const activeEmployees = employees
    .filter((e) => e.active_status === 'active' || e.active_status === '1')
    .map((e) => ({ id: e.employee_id, name: e.full_name, outlet_id: e.outlet_id }));
  const outletOptions = outlets.map((o) => ({ id: o.outlet_id, name: o.outlet_name }));

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Absensi</h1>
        <p className='text-sm text-muted-foreground'>
          Check-in / check-out harian. Tanggal hari ini: <span className='font-mono'>{todayWib()}</span>
        </p>
      </div>
      <AttendanceTable
        employees={activeEmployees}
        outlets={outletOptions}
      />
    </div>
  );
}