import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { can, Role } from '@/lib/rbac';
import { getReminderCandidates } from '@/lib/employment-contract';
import Link from 'next/link';
import { EmployeesTable } from '@/features/hr/components/employees-table';
import { todayWib } from '@/lib/format';

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
  probation_end_date: string;
  contract_start_date: string;
  contract_end_date: string;
  permanent_date: string;
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
  const reminders = getReminderCandidates(employees as unknown as Record<string, string>[], todayWib());

  return (
    <div className='space-y-4'>
      {reminders.length > 0 && (
        <div className='rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm'>
          <div className='font-semibold text-amber-800'>Reminder Kontrak & Probation ({reminders.length})</div>
          <ul className='mt-1 list-disc pl-5 text-amber-900'>
            {reminders.slice(0, 5).map((r) => (
              <li key={r.employeeId}>{r.employeeName} — {r.kind === 'PROBATION_ENDING' ? 'Probation' : 'Kontrak'} berakhir {r.targetDate} ({r.daysRemaining} hari) — {r.employmentStatus}</li>
            ))}
          </ul>
          <div className='mt-1 text-xs text-muted-foreground'>Total probation 2 bln + kontrak 12 bln = 14 bln. Telegram HR dikirim otomatis H-7 (probation) & H-14 (kontrak) via cron POST /api/hr/notify/contract-reminders.</div>
        </div>
      )}
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