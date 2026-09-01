'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';

// Bahasa Indonesia labels (Revisi #29 — satu gaya bahasa untuk menu)
const NAV_GROUPS = [
  {
    title: 'Ringkasan',
    items: [
      { href: '/finance', label: 'Ringkasan' },
      { href: '/finance/analytics', label: 'Analitik' },
      { href: '/finance/summary', label: 'Laporan Harian' }
    ]
  },
  {
    title: 'Transaksi',
    items: [
      { href: '/finance/pos', label: 'Pendapatan POS' },
      { href: '/finance/suppliers', label: 'Pembelian Supplier' },
      { href: '/finance/petty-cash', label: 'Kas Kecil' },
      { href: '/finance/expenses', label: 'Pengeluaran' },
      { href: '/finance/closing-cash', label: 'Closing Kas' }
    ]
  },
  {
    title: 'SDM',
    items: [
      { href: '/finance/payroll', label: 'Beban Gaji' }
    ]
  },
  {
    title: 'Kontrol',
    items: [
      { href: '/finance/alerts', label: 'Alert' },
      { href: '/finance/actions', label: 'Action Tracker' },
      { href: '/finance/settings', label: 'Pengaturan' },
      { href: '/finance/telegram', label: 'Telegram' }
    ]
  }
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
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
      <Toaster richColors position='top-right' />
      <aside className='w-56 border-r border-border bg-muted/50 p-3 flex flex-col'>
        <div className='mb-3'>
          <h2 className='text-sm font-bold'>YKP Finance</h2>
          <p className='text-[10px] text-muted-foreground'>{user.username} · {user.role}</p>
          <p className='text-[10px] font-medium text-amber-600 mt-0.5'>TESTING</p>
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
                      pathname === n.href || (n.href !== '/finance' && pathname.startsWith(n.href))
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
      <main className='flex-1 p-6'>
        {user.username === 'owner' && (
          <div className='mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800'>
            Anda login dengan akun default <b>owner/owner123</b>. Ganti password sebelum pilot production.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
