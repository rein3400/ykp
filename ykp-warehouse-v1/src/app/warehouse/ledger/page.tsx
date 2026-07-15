import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import LedgerClient from './ledger-client';

export const dynamic = 'force-dynamic';

export default async function LedgerPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [movements, items, locations] = await Promise.all([
    readTab<Record<string, string>>(TABS.stockMovement),
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.locations)
  ]);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Stock Movement Ledger</h1>
        <p className='text-sm text-muted-foreground'>Auto immutable. Semua transaksi stok tercatat otomatis. Tidak bisa dihapus — hanya reversal.</p>
      </div>
      <LedgerClient movements={movements} items={items} locations={locations} />
    </div>
  );
}
