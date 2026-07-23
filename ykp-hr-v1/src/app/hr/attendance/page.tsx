import { readTab, TABS } from '@/db/sheets';
import { todayWib } from '@/lib/format';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { AttendanceTable } from '@/features/hr/components/attendance-table';

export const dynamic = 'force-dynamic';

export default async function AttendancePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [employees, outlets] = await Promise.all([
    readTab<{ employee_id: string; full_name: string; outlet_id: string; brand_id: string; active_status: string }>(TABS.employees),
    readTab<{ outlet_id: string; brand_id: string; outlet_name: string }>(TABS.outlets)
  ]);

  const role = session.role;
  // Scope the employee picker to what the caller may act on:
  //  - employee: self only (linked employee_id)
  //  - outlet_manager/supervisor: own outlet
  //  - brand_manager: own brand
  //  - owner/super_admin/hr_admin: all
  let scopedEmployees = employees.filter((e) => e.active_status === 'active' || e.active_status === '1');
  if (role === 'employee') {
    // Self only — include the linked employee even if their active_status is
    // not flagged "active"/"1" (e.g. seed row flagged inactive by mistake),
    // so the employee can still record their own attendance. Anyone else is
    // excluded.
    scopedEmployees = session.employeeId
      ? employees.filter((e) => e.employee_id === session.employeeId)
      : [];
  } else if (role === 'outlet_manager' || role === 'supervisor') {
    scopedEmployees = session.outletId
      ? scopedEmployees.filter((e) => e.outlet_id === session.outletId)
      : scopedEmployees;
  } else if (role === 'brand_manager') {
    scopedEmployees = session.brandId
      ? scopedEmployees.filter((e) => e.brand_id === session.brandId)
      : scopedEmployees;
  }

  let scopedOutlets = outlets;
  if (role === 'outlet_manager' || role === 'supervisor') {
    scopedOutlets = session.outletId ? outlets.filter((o) => o.outlet_id === session.outletId) : outlets;
  } else if (role === 'brand_manager') {
    scopedOutlets = session.brandId ? outlets.filter((o) => o.brand_id === session.brandId) : outlets;
  }

  const activeEmployees = scopedEmployees.map((e) => ({ id: e.employee_id, name: e.full_name, outlet_id: e.outlet_id }));
  const outletOptions = scopedOutlets.map((o) => ({ id: o.outlet_id, name: o.outlet_name }));

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Absensi</h1>
        <p className='text-sm text-muted-foreground'>
          Check-in / check-out harian. Tanggal hari ini: <span className='font-mono'>{todayWib()}</span>
        </p>
        {role === 'employee' && (
          <p className='mt-1 text-xs text-muted-foreground'>
            Karyawan hanya dapat mencatat absensi untuk diri sendiri.
          </p>
        )}
      </div>
      <AttendanceTable
        employees={activeEmployees}
        outlets={outletOptions}
      />
    </div>
  );
}