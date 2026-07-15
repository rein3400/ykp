'use client';

import Link from 'next/link';

const ITEMS = [
  { label: 'Ringkasan', href: '/hr', roles: ['owner', 'super_admin', 'hr_admin', 'finance_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'viewer'] },
  { label: 'Karyawan', href: '/hr/employees', roles: ['owner', 'super_admin', 'hr_admin', 'brand_manager', 'outlet_manager', 'supervisor'] },
  { label: 'Absensi', href: '/hr/attendance', roles: ['owner', 'super_admin', 'hr_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'employee'] },
  { label: 'Roster', href: '/hr/roster', roles: ['owner', 'super_admin', 'hr_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'employee'] },
  { label: 'Keterlambatan', href: '/hr/lateness', roles: ['owner', 'super_admin', 'hr_admin', 'brand_manager', 'outlet_manager', 'supervisor'] },
  { label: 'Izin / Cuti', href: '/hr/leaves', roles: ['owner', 'super_admin', 'hr_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'employee'] },
  { label: 'Payroll', href: '/hr/payroll', roles: ['owner', 'super_admin', 'hr_admin', 'finance_admin', 'brand_manager', 'outlet_manager', 'employee'] },
  { label: 'Bonus & Potongan', href: '/hr/adjustments', roles: ['owner', 'super_admin', 'hr_admin', 'outlet_manager', 'supervisor'] },
  { label: 'Summary Harian', href: '/hr/summary', roles: ['owner', 'super_admin', 'hr_admin', 'brand_manager', 'outlet_manager', 'hermez'] },
  { label: 'User & Role', href: '/hr/users', roles: ['owner', 'super_admin', 'hr_admin'] }
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  super_admin: 'Super Admin',
  hr_admin: 'HR Admin',
  finance_admin: 'Finance Admin',
  brand_manager: 'Brand Manager',
  outlet_manager: 'Outlet Manager',
  supervisor: 'Supervisor',
  employee: 'Karyawan',
  viewer: 'Viewer',
};

export function Sidebar({ role, userName }: { role: string; userName?: string }) {
  const visible = ITEMS.filter((i) => i.roles.includes(role));
  return (
    <div className='flex h-full flex-col p-4'>
      <div className='mb-6 font-bold'>YKP HR V1</div>
      <nav className='flex-1 space-y-1'>
        {visible.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className='block rounded-md px-3 py-2 text-sm hover:bg-slate-100'
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className='mt-4 border-t border-slate-200 pt-4'>
        {userName && (
          <div className='mb-2 text-xs text-slate-500'>
            <div className='font-medium text-slate-800'>{userName}</div>
            <div>{ROLE_LABELS[role] ?? role}</div>
          </div>
        )}
        <form action='/api/auth/logout' method='POST'>
          <button
            type='submit'
            className='w-full rounded-md border border-slate-300 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100'
          >
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}
