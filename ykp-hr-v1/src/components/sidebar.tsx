'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: string; // heroicons path d-attribute
  roles: string[];
}

const ITEMS: NavItem[] = [
  { label: 'Ringkasan', href: '/hr', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', roles: ['owner', 'super_admin', 'hr_admin', 'finance_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'viewer'] },
  { label: 'Karyawan', href: '/hr/employees', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z', roles: ['owner', 'super_admin', 'hr_admin', 'brand_manager', 'outlet_manager', 'supervisor'] },
  { label: 'Absensi', href: '/hr/attendance', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', roles: ['owner', 'super_admin', 'hr_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'employee'] },
  { label: 'Roster', href: '/hr/roster', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5', roles: ['owner', 'super_admin', 'hr_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'employee'] },
  { label: 'Kelola Shift', href: '/hr/shifts', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', roles: ['owner', 'super_admin', 'hr_admin'] },
  { label: 'Pengaturan Email', href: '/hr/settings', icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75', roles: ['owner', 'super_admin', 'hr_admin'] },
  { label: 'Keterlambatan', href: '/hr/lateness', icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z', roles: ['owner', 'super_admin', 'hr_admin', 'brand_manager', 'outlet_manager', 'supervisor'] },
  { label: 'Izin / Cuti', href: '/hr/leaves', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z', roles: ['owner', 'super_admin', 'hr_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'employee'] },
  { label: 'Payroll', href: '/hr/payroll', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z', roles: ['owner', 'super_admin', 'hr_admin', 'finance_admin', 'brand_manager', 'outlet_manager', 'employee'] },
  { label: 'Bonus & Potongan', href: '/hr/adjustments', icon: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z', roles: ['owner', 'super_admin', 'hr_admin', 'outlet_manager', 'supervisor'] },
  { label: 'Summary Harian', href: '/hr/summary', icon: 'M3 13.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v6a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75v-6zm7.5-9a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v15a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75v-15zm7.5 4.5a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75V9z', roles: ['owner', 'super_admin', 'hr_admin', 'brand_manager', 'outlet_manager', 'hermez'] },
  { label: 'User & Role', href: '/hr/users', icon: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z', roles: ['owner', 'super_admin', 'hr_admin'] },
  { label: 'Telegram', href: '/hr/telegram', icon: 'M11.7 2.805a.75.75 0 01.6 0A60.65 60.65 0 0118.75 4.5c.97.243 1.75.9 1.75 1.875 0 .06.015.118.045.175.243.469.81 1.277 1.5 1.875.31.27.5.576.5.9 0 .325-.19.63-.5.9-.69.598-1.257 1.406-1.5 1.875a.75.75 0 01-.045.175c0 .975-.78 1.632-1.75 1.875a60.65 60.65 0 01-6.45 1.695.75.75 0 01-.6 0A60.65 60.65 0 014.5 13.5c-.97-.243-1.75-.9-1.75-1.875a.75.75 0 01.045-.175c.243-.469.81-1.277 1.5-1.875.31-.27.5-.576.5-.9 0-.325-.19-.63-.5-.9-.69-.598-1.257-1.406-1.5-1.875a.75.75 0 01-.045-.175c0-.975.78-1.632 1.75-1.875A60.65 60.65 0 0111.7 2.805z', roles: ['owner', 'super_admin', 'hr_admin', 'finance_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'employee', 'viewer'] }
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
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const visible = ITEMS.filter((i) => i.roles.includes(role));

  // Close mobile drawer on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    if (href === '/hr') return pathname === '/hr';
    return pathname.startsWith(href);
  }

  const navContent = (
    <>
      <div className='mb-6 flex items-center gap-2 px-2'>
        <div className='flex h-8 w-8 items-center justify-center rounded-md bg-sky-700 text-sm font-bold text-white'>Y</div>
        <div>
          <div className='text-sm font-bold text-slate-900'>YKP HR V1</div>
          <div className='text-[10px] uppercase tracking-wide text-slate-500'>Command Center</div>
        </div>
      </div>
      <nav className='flex-1 space-y-0.5'>
        {visible.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-sky-50 text-sky-700'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={1.5}
                stroke='currentColor'
                className={`h-4 w-4 flex-shrink-0 ${active ? 'text-sky-600' : 'text-slate-500'}`}
                aria-hidden='true'
              >
                <path strokeLinecap='round' strokeLinejoin='round' d={item.icon} />
              </svg>
              <span className='truncate'>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className='mt-4 border-t border-slate-200 pt-4'>
        {userName && (
          <div className='mb-2 px-2 text-xs text-slate-500'>
            <div className='truncate font-medium text-slate-800'>{userName}</div>
            <div>{ROLE_LABELS[role] ?? role}</div>
          </div>
        )}
        <form action='/api/auth/logout' method='POST' className='px-2'>
          <button
            type='submit'
            className='w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50'
          >
            Keluar
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar with hamburger */}
      <div className='fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden'>
        <div className='flex items-center gap-2'>
          <div className='flex h-7 w-7 items-center justify-center rounded-md bg-sky-700 text-xs font-bold text-white'>Y</div>
          <span className='text-sm font-bold text-slate-900'>YKP HR V1</span>
        </div>
        <button
          type='button'
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={mobileOpen}
          className='rounded-md p-2 text-slate-600 hover:bg-slate-100'
        >
          {mobileOpen ? (
            <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='h-5 w-5'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
            </svg>
          ) : (
            <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='h-5 w-5'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5' />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className='fixed inset-0 z-40 bg-slate-900/40 md:hidden'
          aria-hidden='true'
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar: static on md+, slide-over on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}
