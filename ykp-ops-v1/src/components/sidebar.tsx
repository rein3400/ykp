'use client';

import Link from 'next/link';

const ITEMS = [
  { label: 'Ringkasan', href: '/ops', roles: ['owner', 'ops_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'staff', 'viewer'] },
  { label: 'Briefing & Shift', href: '/ops/briefing', roles: ['owner', 'ops_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'viewer'] },
  { label: 'Opening Checklist', href: '/ops/opening', roles: ['owner', 'ops_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'staff'] },
  { label: 'KDS / Live Ops', href: '/ops/kds', roles: ['owner', 'ops_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'staff'] },
  { label: 'Visual QC', href: '/ops/qc', roles: ['owner', 'ops_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'staff'] },
  { label: 'Incident & Complaint', href: '/ops/incidents', roles: ['owner', 'ops_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'staff'] },
  { label: 'Closing', href: '/ops/closing', roles: ['owner', 'ops_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'staff'] },
  { label: 'Waste & Stock', href: '/ops/waste', roles: ['owner', 'ops_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'staff'] },
  { label: 'Analytics', href: '/ops/analytics', roles: ['owner', 'ops_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'viewer'] },
  { label: 'AI Assistant', href: '/ops/ai-assistant', roles: ['owner', 'ops_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'viewer'] },
  { label: 'Telegram', href: '/ops/telegram', roles: ['owner', 'ops_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'staff', 'viewer'] },
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  ops_admin: 'Ops Admin',
  brand_manager: 'Brand Manager',
  outlet_manager: 'Outlet Manager',
  supervisor: 'Supervisor',
  staff: 'Staff',
  viewer: 'Viewer',
};

export function Sidebar({ role, userName }: { role: string; userName?: string }) {
  const visible = ITEMS.filter((i) => i.roles.includes(role));
  return (
    <div className='flex h-full flex-col p-4'>
      <div className='mb-6 font-bold'>YKP Ops V1</div>
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
