import Link from 'next/link';
import { Toaster } from 'sonner';
import { getSession } from '@/lib/session';
import { isMockForced } from '@/lib/aggregate';
import { LogoutButton } from '@/components/logout-button';

const NAV = [
  { href: '/owner', label: 'Beranda' },
  { href: '/owner/keuangan', label: 'Keuangan' },
  { href: '/owner/penjualan', label: 'Penjualan' },
  { href: '/owner/bukti', label: 'Bukti' },
  { href: '/owner/sdm', label: 'SDM' },
  { href: '/owner/gudang', label: 'Gudang' },
  { href: '/owner/operasional', label: 'Operasional' },
  { href: '/owner/investor', label: 'Investor' },
  { href: '/owner/activity', label: 'Aktivitas' },
  { href: '/owner/brief', label: 'Daily Brief' },
  { href: '/owner/health', label: 'Health' }
];

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const mock = isMockForced();
  return (
    <div className='min-h-screen bg-muted'>
      <header className='sticky top-0 z-10 border-b border-border bg-background'>
        <div className='mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2'>
          <div className='flex items-center gap-2'>
            <span className='text-sm font-bold'>YKP Owner</span>
            {mock && (
              <span className='rounded bg-gray-700 px-1.5 py-0.5 text-[10px] font-bold text-white'>
                MOCK
              </span>
            )}
          </div>
          <div className='flex items-center gap-2'>
            <span className='hidden text-[11px] text-muted-foreground sm:inline'>
              {session?.username} · {session?.role}
            </span>
            <LogoutButton />
          </div>
        </div>
        <nav className='mx-auto max-w-6xl overflow-x-auto px-3 pb-2'>
          <ul className='flex gap-1 text-xs'>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className='block whitespace-nowrap rounded px-2.5 py-1.5 font-medium text-foreground hover:bg-muted'
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className='mx-auto max-w-6xl space-y-4 px-3 py-4'>{children}</main>
      <Toaster richColors position='top-center' />
    </div>
  );
}
