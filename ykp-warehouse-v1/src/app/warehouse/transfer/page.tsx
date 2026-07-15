import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import TransferClient from './transfer-client';

export const dynamic = 'force-dynamic';

export default async function TransferPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [headers, items, locations] = await Promise.all([
    readTab<Record<string, string>>(TABS.transfer),
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.locations)
  ]);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Transfer Stock</h1>
        <p className='text-sm text-muted-foreground'>Dispatch -stock, receive +stock. Discrepancy → auto alert. Brief §14.</p>
      </div>
      <TransferClient headers={headers} items={items} locations={locations} />
    </div>
  );
}
