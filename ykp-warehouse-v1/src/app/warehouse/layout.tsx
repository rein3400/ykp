'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV_GROUPS = [
  {
    title: 'Overview',
    items: [{ href: '/warehouse', label: 'Overview' }]
  },
  {
    title: 'Master Data',
    items: [
      { href: '/warehouse/items', label: 'Master Item' },
      { href: '/warehouse/locations', label: 'Lokasi' },
      { href: '/warehouse/suppliers', label: 'Supplier' },
      { href: '/warehouse/categories', label: 'Kategori' },
      { href: '/warehouse/unit-conversion', label: 'Unit Conversion' },
      { href: '/warehouse/threshold', label: 'Threshold' }
    ]
  },
  {
    title: 'Transaksi',
    items: [
      { href: '/warehouse/penerimaan', label: 'Receiving' },
      { href: '/warehouse/pemakaian', label: 'Stock Issue' },
      { href: '/warehouse/transfer', label: 'Transfer' },
      { href: '/warehouse/waste', label: 'Waste' },
      { href: '/warehouse/opname', label: 'Stock Opname' },
      { href: '/warehouse/ledger', label: 'Stock Ledger' },
      { href: '/warehouse/expiry', label: 'Expiry' }
    ]
  },
  {
    title: 'Purchase',
    items: [
      { href: '/warehouse/purchase-recommendation', label: 'Recommendation' },
      { href: '/warehouse/purchase-request', label: 'Request' }
    ]
  },
  {
    title: 'Alert & Summary',
    items: [
      { href: '/warehouse/alerts', label: 'Alerts' },
      { href: '/warehouse/actions', label: 'Actions' },
      { href: '/warehouse/summary', label: 'Summary' },
      { href: '/warehouse/dashboard', label: 'Dashboard' },
      { href: '/warehouse/telegram', label: 'Telegram' }
    ]
  }
];

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ username?: string; role?: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setUser(j.data);
        else router.push('/login');
      })
      .catch(() => router.push('/login'));
  }, [router]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (!user) return <div className='p-6 text-sm text-muted-foreground'>Loading…</div>;

  return (
    <div className='flex min-h-screen'>
      <a href='#wh-main' className='sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-slate-900 focus:px-3 focus:py-2 focus:text-sm focus:text-white'>Lewati ke konten utama</a>
      <aside className='w-56 shrink-0 border-r border-border bg-muted/50 p-3 flex flex-col md:sticky md:top-0 md:h-screen'>
        <div className='mb-3'>
          <h2 className='text-sm font-bold'>YKP Warehouse</h2>
          <p className='text-[10px] text-muted-foreground'>{user.username} · {user.role}</p>
          <p className='text-[10px] font-medium text-amber-800 mt-0.5'>TESTING</p>
        </div>
        <nav className='flex-1 space-y-2 overflow-y-auto'>
          {NAV_GROUPS.map((g) => (
            <div key={g.title}>
              <p className='px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground'>{g.title}</p>
              <div className='space-y-0.5'>
                {g.items.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`block rounded px-2 py-1.5 text-xs font-medium ${
                      pathname === n.href || (n.href !== '/warehouse' && pathname.startsWith(n.href))
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {n.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <button
          onClick={logout}
          className='mt-3 w-full rounded border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted'
        >
          Logout
        </button>
      </aside>
      <main id='wh-main' className='flex-1 p-6'>{children}</main>
    </div>
  );
}