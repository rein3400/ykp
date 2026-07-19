'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/investor', label: 'Dashboard' },
  { href: '/investor/portfolio', label: 'Portfolio' },
  { href: '/investor/capital', label: 'Capital' },
  { href: '/investor/dividend', label: 'Dividend' },
  { href: '/investor/returns', label: 'Returns' }
];

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ username?: string; role?: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((j) => {
      if (j.data) setUser(j.data); else router.push('/login');
    }).catch(() => router.push('/login'));
  }, [router]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (!user) return <div className='p-6 text-sm text-muted-foreground'>Loading…</div>;

  return (
    <div className='flex min-h-screen'>
      <aside className='w-56 border-r border-border bg-muted/50 p-4 flex flex-col'>
        <div className='mb-4'>
          <h2 className='text-sm font-bold'>YKP Investor</h2>
          <p className='text-[10px] text-muted-foreground'>{user.username} · {user.role}</p>
        </div>
        <nav className='flex-1 space-y-0.5'>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`block rounded px-2 py-1.5 text-xs font-medium ${
                pathname === n.href ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}>{n.label}</Link>
          ))}
          {user.role === 'owner' && (
            <Link href='/investor/admin'
              className={`block rounded px-2 py-1.5 text-xs font-medium ${
                pathname === '/investor/admin' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}>Admin</Link>
          )}
        </nav>
        <button onClick={logout}
          className='mt-4 w-full rounded border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted'>
          Logout
        </button>
      </aside>
      <main className='flex-1 p-6'>{children}</main>
    </div>
  );
}