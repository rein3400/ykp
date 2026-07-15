import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import OpnameClient from './opname-client';

export const dynamic = 'force-dynamic';

export default async function OpnamePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [headers, items, locations] = await Promise.all([
    readTab<Record<string, string>>(TABS.stockCount),
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.locations)
  ]);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Stock Opname</h1>
        <p className='text-sm text-muted-foreground'>Book vs Physical. Unexplained variance sebelum confirmed loss. Brief §17.</p>
      </div>
      <OpnameClient headers={headers} items={items} locations={locations} />
    </div>
  );
}
