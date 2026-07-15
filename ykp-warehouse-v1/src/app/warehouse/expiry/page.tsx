import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ExpiryClient from './expiry-client';

export const dynamic = 'force-dynamic';

export default async function ExpiryPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [batches, items, locations] = await Promise.all([
    readTab<Record<string, string>>(TABS.batchStock),
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.locations)
  ]);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Expiry Monitoring</h1>
        <p className='text-sm text-muted-foreground'>Batch stock FEFO. Near expiry / expired alerts. Brief §18.</p>
      </div>
      <ExpiryClient batches={batches} items={items} locations={locations} />
    </div>
  );
}
