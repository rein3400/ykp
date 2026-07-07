import { readTab, TABS } from '@/db/sheets';
import { formatIdr } from '@/lib/format';
import Link from 'next/link';

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
  const [employees, brands, outlets] = await Promise.all([
    readTab<Employee>(TABS.employees),
    readTab<Brand>(TABS.brands),
    readTab<Outlet>(TABS.outlets)
  ]);

  const brandById = new Map(brands.map((b) => [b.brand_id, b.brand_name]));
  const outletById = new Map(outlets.map((o) => [o.outlet_id, o.outlet_name]));

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
          <table className='w-full text-sm'>
            <thead className='text-left text-xs text-muted-foreground'>
              <tr>
                <th className='py-2'>Employee ID</th>
                <th>Nama</th>
                <th>Role</th>
                <th>Brand</th>
                <th>Outlet</th>
                <th>Gaji Pokok</th>
                <th>Tipe</th>
                <th>Status</th>
                <th>Join</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.employee_id} className='border-t border-border'>
                  <td className='py-1 font-mono text-xs'>{e.employee_id}</td>
                  <td>{e.full_name}</td>
                  <td>{e.role || 'staff'}</td>
                  <td>{brandById.get(e.brand_id) ?? e.brand_id}</td>
                  <td>{outletById.get(e.outlet_id) ?? e.outlet_id}</td>
                  <td>{formatIdr(e.basic_salary || '0')}</td>
                  <td>{e.salary_type || 'MONTHLY'}</td>
                  <td>
                    <span className={e.active_status === 'active' || e.active_status === '1' ? 'badge-green' : 'badge-gray'}>
                      {e.employment_status || e.active_status || '-'}
                    </span>
                  </td>
                  <td>{e.join_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}