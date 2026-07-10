import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, Role } from '@/lib/rbac';
import Link from 'next/link';
import { EmployeesTable } from '@/features/hr/components/employees-table';

export const dynamic = 'force-dynamic';

interface Employee {
  employee_id: string;
  employee_code: string;
  full_name: string;
  nickname: string;
  gender: string;
  phone: string;
  email: string;
  role: string;
  position: string;
  brand_id: string;
  outlet_id: string;
  basic_salary: string;
  salary_type: string;
  employment_status: string;
  active_status: string;
  join_date: string;
}
interface Brand { brand_id: string; brand_name: string }
interface Outlet { outlet_id: string; brand_id: string; outlet_name: string }

export default async function EmployeesPage() {
  const [session, employees, brands, outlets] = await Promise.all([
    getSession(),
    readTab<Employee>(TABS.employees),
    readTab<Brand>(TABS.brands),
    readTab<Outlet>(TABS.outlets)
  ]);

  const brandById = new Map(brands.map((b) => [b.brand_id, b.brand_name]));
  const outletById = new Map(outlets.map((o) => [o.outlet_id, o.outlet_name]));
  const canEdit = session ? can(session.role as Role, 'update', 'employee') : false;

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Master Karyawan</h1>
          <p className='text-sm text-muted-foreground'>Sumber data utama fungsi HR.</p>
        </div>
        <div className='flex gap-2'>
          <a href='/api/hr/employees/export' className='btn-outline'>Export CSV</a>
          <Link href='/hr/employees/import' className='btn-outline'>Import CSV</Link>
          <Link href='/hr/employees/new' className='btn-primary'>+ Tambah Karyawan</Link>
        </div>
      </div>

      <div className='card overflow-x-auto'>
        {employees.length === 0 ? (
          <div className='py-8 text-center text-sm text-muted-foreground'>
            Belum ada karyawan. Tambah lewat tombol di atas.
          </div>
        ) : (
          <EmployeesTable
            data={employees}
            brandById={brandById}
            outletById={outletById}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}