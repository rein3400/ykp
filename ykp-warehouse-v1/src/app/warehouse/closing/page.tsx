import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ClosingClient from './closing-client';
import LegacyBanner from '@/components/legacy-banner';

export const dynamic = 'force-dynamic';

export default async function ClosingPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [rows, items, outlets] = await Promise.all([
    readTab<Record<string, string>>(TABS.legacyClosing),
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.outlets)
  ]);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>F5 — Stock Opname Harian (Closing)</h1>
        <p className='text-sm text-muted-foreground'>Diisi tiap malam jam 22:00. Selisih &gt; 5% = investigasi 24 jam.</p>
      </div>
      <LegacyBanner newFlow='Stock Opname (header+detail) — menu Transaksi › Stock Opname' />
      <ClosingClient rows={rows} items={items} outlets={outlets} />
    </div>
  );
}