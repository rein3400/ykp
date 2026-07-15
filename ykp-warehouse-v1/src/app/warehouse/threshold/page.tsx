import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ThresholdClient from './threshold-client';

export const dynamic = 'force-dynamic';

export default async function ThresholdPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [thresholds, items, locations] = await Promise.all([
    readTab<Record<string, string>>(TABS.inventoryThreshold),
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.locations)
  ]);
  const canWrite = session.role === 'owner' || session.role === 'super_admin' || session.role === 'warehouse_admin';
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Inventory Threshold</h1>
        <p className='text-sm text-muted-foreground'>Batas warning/high/critical per item/lokasi untuk alert engine.</p>
      </div>
      <ThresholdClient thresholds={thresholds} items={items} locations={locations} canWrite={canWrite} />
    </div>
  );
}
