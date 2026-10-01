import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import UsersClient from './users-client';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!['owner', 'super_admin', 'hr_admin'].includes(session.role)) {
    redirect('/hr');
  }

  const [users, brands, outlets, employees] = await Promise.all([
    readTab<Record<string, string>>(TABS.users),
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.employees)
  ]);

  // Karyawan aktif untuk pemilih "Karyawan" (menghubungkan akun ke absensi/payroll).
  const activeEmployees = employees
    .filter((e) => (e.active_status ?? 'active').toLowerCase() === 'active')
    .map((e) => ({ employee_id: e.employee_id, full_name: e.full_name, outlet_id: e.outlet_id }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  // Strip password hashes before sending to client
  const safeUsers = users.map(({ password_hash: _p, ...rest }) => rest);

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>User & Role Management</h1>
        <p className='text-sm text-slate-500'>
          Kelola user, role, dan scope brand/outlet. Revisi item 26.
        </p>
      </div>
      <UsersClient users={safeUsers} brands={brands} outlets={outlets} employees={activeEmployees} />
    </div>
  );
}
