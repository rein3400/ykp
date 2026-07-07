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
  { label: 'Summary Harian', href: '/hr/summary', roles: ['owner', 'super_admin', 'hr_admin', 'brand_manager', 'outlet_manager', 'hermez'] }
];

export function Sidebar({ role }: { role: string }) {
  const visible = ITEMS.filter((i) => i.roles.includes(role));
  return (
    <div className='p-4'>
      <div className='mb-6 font-bold'>YKP HR V1</div>
      <nav className='space-y-1'>
        {visible.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className='block rounded-md px-3 py-2 text-sm hover:bg-muted'
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
