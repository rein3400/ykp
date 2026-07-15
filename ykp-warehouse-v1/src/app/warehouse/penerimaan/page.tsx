import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ReceivingClient from './receiving-client';

export const dynamic = 'force-dynamic';

export default async function ReceivingPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [headers, items, suppliers, locations] = await Promise.all([
    readTab<Record<string, string>>(TABS.receiving),
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.suppliers),
    readTab<Record<string, string>>(TABS.locations)
  ]);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Receiving / Penerimaan Barang</h1>
        <p className='text-sm text-muted-foreground'>Header+detail per brief §12. Batch, expiry, condition, temperature. Discrepancy → auto alert.</p>
      </div>
      <ReceivingClient headers={headers} items={items} suppliers={suppliers} locations={locations} />
    </div>
  );
}
